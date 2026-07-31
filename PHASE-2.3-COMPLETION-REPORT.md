# Phase 2.3: Kafka Event Streaming for Analytics — Completion Report

**Project**: Suggestify
**Phase**: 2.3 — Kafka Event Streaming for Analytics
**Status**: ✅ COMPLETE
**Date Completed**: July 31, 2026

---

## Executive Summary

Phase 2.3 introduced Kafka as a dedicated event-streaming transport for analytics. All five existing producer services (`auth-service`, `suggestion-service`, `favorite-service`, `file-service`, `history-service`) emit user-activity events to a single `user.activity` topic. A new `analytics-service` microservice (internal port 3007) consumes that topic via kafkajs and persists every event as a row in its own `analytics_events` PostgreSQL table. The `api-gateway` gained `/v1/analytics/*` proxy routes, exposing five REST endpoints (paginated event log, suggestions by category, favorites by category, files summary, top users) for the Phase 3.1 Admin UI.

A shared `libs/backend/kafka` library provides `UserActivityProducerService` (kafkajs-based, `isConnected` guard, non-blocking startup) and the `UserActivityType` enum (11 event types), eliminating per-service duplication. kafkajs is used directly — not `ClientKafka` — to avoid the cold Observable dispatch bug seen with RabbitMQ in Phase 2.2.

Post-step-12 fixes: analytics-service consumer made non-blocking on startup (Kafka `UNKNOWN_TOPIC_OR_PARTITION` error crashed health checks before any producer had published); Docker container naming conflicts resolved; frontend container rebuilt to restore Phase 2.2 toast styling.

---

## Accomplishments

### Step 1: Install kafkajs ✅

kafkajs was already a transitive dependency of `@nestjs/microservices`; pinned explicitly in the monorepo root:

```bash
npm install kafkajs
```

### Step 2: Kafka in docker-compose ✅

Added Kafka (KRaft mode, `confluentinc/cp-kafka:7.5.0`) and `kafka-ui` to `infrastructure/docker-compose.yml`. Single-node, no ZooKeeper. `KAFKA_AUTO_CREATE_TOPICS_ENABLE: true` — topics are created on first publish. kafka-ui accessible at `http://localhost:8090`.

Kafka health check uses `kafka-broker-api-versions --bootstrap-server localhost:9092` with `start_period: 30s` and 10 retries to allow KRaft leader election on first boot.

### Step 3: Shared `libs/backend/kafka` library ✅

New buildable Nx library at `libs/backend/kafka/`:

**`user-activity.events.ts`** — `UserActivityType` enum with 11 values:
`USER_REGISTERED`, `USER_LOGGED_IN`, `USER_LOGGED_OUT`, `SUGGESTION_SEARCHED`, `HISTORY_VIEWED`, `FAVORITES_VIEWED`, `FAVORITE_ADDED`, `FAVORITE_REMOVED`, `FILE_UPLOADED`, `FILE_DOWNLOADED`, `FILE_DELETED`.

**`user-activity-producer.service.ts`** — `UserActivityProducerService`:

- Wraps kafkajs `Producer` directly (not `ClientKafka`) — plain `async/await`, no Observable contract
- `onModuleInit()` connects with try/catch; sets `isConnected = false` on failure — service starts without Kafka
- `emit()` is a no-op when `isConnected` is false — analytics failure never blocks the main operation
- Message key = `userId` — ensures all events for a user land on the same partition
- Includes `eventId` (UUID), `timestamp` (ISO 8601), and binary headers on every message

**`kafka.module.ts`** — `@Module({ imports: [ConfigModule], providers: [UserActivityProducerService], exports: [UserActivityProducerService] })`

### Step 4: Scaffold `analytics-service` ✅

New NestJS application at `apps/analytics-service/`, internal port 3007.

**`analytics-event.entity.ts`** — `analytics_events` table with `id`, `eventId`, `eventType` (indexed), `userId` (indexed), `username`, `payload` (JSONB), `eventDate` (date, indexed), `createdAt`.

**`analytics-kafka-consumer.service.ts`** — kafkajs Consumer; `groupId: 'analytics-consumer'`; subscribes to `user.activity` with `fromBeginning: false`. Consumer startup is non-blocking: `onModuleInit()` calls `startConsumer()` with `.catch()` so the HTTP server starts even when Kafka is unavailable (see Post-Step-12 Fixes).

**`analytics.service.ts`** — `record(event)` persists each incoming Kafka message as an `AnalyticsEventEntity` row. Query methods: `getEvents()` (paginated), `getSuggestionsByCategory()`, `getFavoritesByCategory()`, `getFilesSummary()`, `getTopUsers()`.

**`analytics-query.controller.ts`** — five REST endpoints:

| Method | Path                                 | Description                            |
| ------ | ------------------------------------ | -------------------------------------- |
| `GET`  | `/analytics/events`                  | Paginated raw event log                |
| `GET`  | `/analytics/suggestions/by-category` | Suggestion search counts by category   |
| `GET`  | `/analytics/favorites/by-category`   | Favorite add/remove counts by category |
| `GET`  | `/analytics/files/summary`           | Upload/download/delete counts + size   |
| `GET`  | `/analytics/users/top`               | Most active users by event count       |

No auth guard — `RoleGuard` is added in Phase 3.1.

**`infrastructure/Dockerfile.analytics-service`** — multi-stage build, `SERVICE_PORT=3007`.

### Step 5: `auth-service` — Kafka producer ✅

`auth.module.ts` imports `KafkaModule`. `auth.service.ts` injects `UserActivityProducerService` and emits:

- `USER_REGISTERED` after `register()` with `{ username }`
- `USER_LOGGED_IN` after `login()` with `username` passed as the optional param
- `USER_LOGGED_OUT` after `logout()`

### Step 6: `suggestion-service` — Kafka producer ✅

`suggestion.module.ts` imports `KafkaModule`. `suggestion.service.ts` emits `SUGGESTION_SEARCHED` after returning suggestions with `{ category, count }`.

### Step 7: `favorite-service` — Kafka producer ✅

`favorite.module.ts` imports `KafkaModule` (alongside existing `NOTIFICATION_CLIENT`). `favorite.controller.ts` emits:

- `FAVORITE_ADDED` after `addFavorite()` with `{ favoriteId, category, title }`
- `FAVORITE_REMOVED` after `removeFavorite()` with `{ favoriteId, title }`
- `FAVORITES_VIEWED` after `getFavorites()` with `{ count }`

### Step 8: `file-service` — Kafka producer ✅

`file.module.ts` imports `KafkaModule`. Emits are split between service and controller:

- `FILE_UPLOADED` — `file.service.ts` after `repo.save()`, with `{ fileId, originalName, mimeType, size }`
- `FILE_DELETED` — `file.service.ts` after `repo.delete()`, with `{ fileId, originalName }`
- `FILE_DOWNLOADED` — `file.controller.ts` in `download()`, not `stream()` — `stream()` is the browser navigation endpoint with no `X-User-Id` header; `download()` (which creates a signed download token) receives `userId` from the header

### Step 9: `history-service` — Kafka producer ✅

`history.module.ts` imports `KafkaModule`. `history.controller.ts` emits `HISTORY_VIEWED` in `getAll()` with `{ count: result.length }`.

`history.controller.spec.ts` — added `UserActivityProducerService` mock provider to prevent test failures from the new dependency.

### Step 10: `api-gateway` — analytics proxy routes ✅

**`proxy.controller.ts`** — added analytics catch-all:

```typescript
@All(['analytics', 'analytics/*path'])
async proxyAnalytics(@Req() req: Request, @Res() res: Response) {
  return this.proxyService.forward(req, res, 'analytics-service');
}
```

**`proxy.service.ts`** — `buildResponseLinks()` extended with analytics HATEOAS links:

- Auth/sessions response includes `analytics: '/v1/analytics/events'`
- Analytics responses include `suggestions`, `favorites`, `history` back-links

### Step 11: Docker Compose — `analytics-service` + env vars ✅

Added to `infrastructure/docker-compose.yml`:

- `postgres-analytics` container (port 5436, `analytics_db`) with health check
- `postgres-analytics-data` volume
- `KAFKA_BROKERS=kafka:9092` and `SERVICE_NAME=<service>` env vars to all 5 producer services (auth, suggestion, favorite, file, history)
- `kafka: condition: service_healthy` added to `depends_on` of all 5 producer services
- `analytics-service` container with Dockerfile, port 3007 (internal only), depends on postgres-analytics + kafka + consul
- `analytics-service: condition: service_healthy` added to `api-gateway` depends_on

### Step 12: Build and Verification ✅

All 8 affected projects built with 0 TypeScript errors. Docker images rebuilt; all 22 containers started and reached healthy state. End-to-end verification:

| Scenario                                                    | Result                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `POST /v1/auth/users` → `user.registered` in analytics      | ✅ event stored with correct `eventId`, `userId`, `eventDate` |
| `POST /v1/auth/sessions` → `user.logged_in` in analytics    | ✅                                                            |
| `DELETE /v1/auth/sessions` → `user.logged_out` in analytics | ✅                                                            |
| `GET /v1/suggestion?category=books` → `suggestion.searched` | ✅                                                            |
| `GET /v1/history` → `history.viewed`                        | ✅                                                            |
| `GET /v1/favorite` → `favorites.viewed`                     | ✅                                                            |
| `POST /v1/favorite` → `favorite.added`                      | ✅                                                            |
| `DELETE /v1/favorite/:id` → `favorite.removed`              | ✅                                                            |
| `POST /v1/files` (PNG) → `file.uploaded`                    | ✅                                                            |
| `GET /v1/files/:id/download` → `file.downloaded`            | ✅ HTTP 200; event stored                                     |
| `DELETE /v1/files/:id` → `file.deleted`                     | ✅                                                            |
| `GET /v1/analytics/events` → paginated event log            | ✅ 15 events, correct schema                                  |
| `GET /v1/analytics/suggestions/by-category`                 | ✅ `[{ category: "books", searchCount: "1" }]`                |
| `GET /v1/analytics/favorites/by-category`                   | ✅ add/remove counts per category                             |
| `GET /v1/analytics/files/summary`                           | ✅ upload/download/delete counts + `totalUploadSize`          |
| `GET /v1/analytics/users/top`                               | ✅ event counts per user                                      |

---

## Post-Step-12 Fixes

These were not in the original plan but addressed during verification:

| Fix                              | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-blocking consumer startup    | `onModuleInit()` originally awaited `consumer.connect()` / `subscribe()` / `run()` directly. On first boot, `user.activity` topic does not yet exist (no producer has published), causing kafkajs `UNKNOWN_TOPIC_OR_PARTITION` error. This uncaught exception crashed the process before the HTTP server started, so the health check always failed. Fixed by moving consumer logic to a private `startConsumer()` method wrapped in try/catch, called with `.catch()` from `onModuleInit()` — HTTP server starts regardless of Kafka state. |
| Docker container naming conflict | Old containers built with the previous compose project (`nest-project-*` image prefix) were still running under the same container names as the new ones (`infrastructure-*`). Docker refused to start new containers. Fixed with `docker rm -f file-service favorite-service frontend`.                                                                                                                                                                                                                                                     |
| Frontend container rebuild       | The Phase 2.2 toast CSS fix (`position: fixed; top: 80px; right: 24px`) was committed after the frontend Docker image was last built (image: 08:08, commit: 12:59 on the same day). Notifications reverted to rendering as full-width block elements. Fixed by rebuilding the frontend image: `docker compose build frontend`.                                                                                                                                                                                                               |

---

## Verification Checklist

### Kafka infrastructure

- ✅ `kafka` container healthy; `kafka-ui` accessible at `http://localhost:8090`
- ✅ `user.activity` topic auto-created on first publish
- ✅ Consumer group `analytics-consumer` connected; logs show `memberAssignment: {"user.activity":[0]}`
- ✅ Resilience: Kafka stop → all services remain healthy → Kafka restart → events resume (tested July 31, 2026)

### analytics-service

- ✅ Container starts and registers with Consul as `analytics-service`
- ✅ Kafka consumer connected and subscribed to `user.activity`
- ✅ HTTP server healthy at internal port 3007
- ✅ `GET /analytics/events` returns paginated events with `eventId`, `eventType`, `userId`, `payload`, `eventDate`

### Producers — all 5 services

- ✅ `auth-service` — `user.registered`, `user.logged_in`, `user.logged_out`
- ✅ `suggestion-service` — `suggestion.searched`
- ✅ `favorite-service` — `favorite.added`, `favorite.removed`, `favorites.viewed`
- ✅ `file-service` — `file.uploaded`, `file.downloaded`, `file.deleted`
- ✅ `history-service` — `history.viewed`

### api-gateway analytics proxy

- ✅ `GET /v1/analytics/suggestions/by-category` returns data via api-gateway proxy
- ✅ `GET /v1/analytics/favorites/by-category` returns data
- ✅ `GET /v1/analytics/files/summary` returns data
- ✅ `GET /v1/analytics/users/top` returns data
- ✅ Analytics HATEOAS links present in auth and analytics responses

### Tests

- ✅ `history-service` — `history.controller.spec.ts` passes with `UserActivityProducerService` mock

---

## Known Limitations / Future Work

| Item                         | Detail                                                                                                                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users/top` duplicate rows   | Endpoint groups by `(userId, username)`. Events emitted by non-auth services include no `username`, resulting in two rows for the same user — one with `username: null` and one with the actual name. Fix in Phase 3.1: group by `userId` only and use `MAX(username)`. |
| Single-node KRaft (dev only) | The `confluentinc/cp-kafka:7.5.0` KRaft setup is not suitable for production. Phase 6.2 replaces it with managed Kafka (AWS MSK, Confluent Cloud). Only `KAFKA_BROKERS` env var needs updating in all 6 services (analytics-service + 5 producers).                     |
| Kafka topic retention        | Retention defaults (`log.retention.hours=168`). Phase 6.2 sets `retention.ms` to match analytics needs (e.g. 3 days). Do not use log compaction on `user.activity` — it keeps only the latest message per key (userId), destroying the event log.                       |

---

## Plan vs Actual Comparison

| Step                                           | Plan Estimate      | Status        | Notes                                                                                               |
| ---------------------------------------------- | ------------------ | ------------- | --------------------------------------------------------------------------------------------------- |
| 1 — Install `kafkajs`                          | 30 min             | ✅            |                                                                                                     |
| 2 — Kafka (KRaft) + kafka-ui in docker-compose | 1.5–2 hours        | ✅            |                                                                                                     |
| 3 — `libs/backend/kafka` shared library        | 1–1.5 hours        | ✅            |                                                                                                     |
| 4 — Scaffold `analytics-service`               | 4–5 hours          | ✅            |                                                                                                     |
| 5 — `auth-service` producer                    | 1 hour             | ✅            |                                                                                                     |
| 6 — `suggestion-service` producer              | 1 hour             | ✅            |                                                                                                     |
| 7 — `favorite-service` producer                | 1 hour             | ✅            |                                                                                                     |
| 8 — `file-service` producer                    | 1.5–2 hours        | ✅            | `FILE_DOWNLOADED` moved to controller (not service) — `stream()` has no `userId`; `download()` does |
| 9 — `history-service` producer                 | 1 hour             | ✅            | Emit in controller (has `userId` from header); added mock to controller spec                        |
| 10 — `api-gateway` analytics proxy             | 1–1.5 hours        | ✅            |                                                                                                     |
| 11 — Docker Compose additions                  | 1 hour             | ✅            | Per-service `postgres-analytics` container (port 5436), not shared postgres                         |
| 12 — Build, Docker rebuild, verification       | 3–4 hours          | ✅            | Includes post-verification fixes: non-blocking consumer, container conflicts, frontend rebuild      |
| **Total**                                      | **~18.5–23 hours** | **~14 hours** |                                                                                                     |

---

## Files Created

| File                                                                       | Description                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `libs/backend/kafka/`                                                      | New shared Nx library (entire directory)                            |
| `libs/backend/kafka/src/lib/user-activity.events.ts`                       | `UserActivityType` enum — 11 event types                            |
| `libs/backend/kafka/src/lib/user-activity-producer.service.ts`             | kafkajs Producer wrapper; `isConnected` guard; non-blocking startup |
| `libs/backend/kafka/src/lib/kafka.module.ts`                               | `KafkaModule` exporting `UserActivityProducerService`               |
| `libs/backend/kafka/src/index.ts`                                          | Public API barrel                                                   |
| `apps/analytics-service/`                                                  | New NestJS microservice (entire directory)                          |
| `apps/analytics-service/src/main.ts`                                       | HTTP-only startup on port 3007                                      |
| `apps/analytics-service/src/analytics/analytics-event.entity.ts`           | `analytics_events` TypeORM entity                                   |
| `apps/analytics-service/src/analytics/analytics.service.ts`                | `record()` + 4 query methods                                        |
| `apps/analytics-service/src/analytics/analytics-query.controller.ts`       | 5 REST endpoints                                                    |
| `apps/analytics-service/src/analytics/analytics-kafka-consumer.service.ts` | kafkajs Consumer; non-blocking `startConsumer()`                    |
| `apps/analytics-service/src/analytics/analytics.module.ts`                 | Module wiring consumer, service, controller, TypeORM                |
| `apps/analytics-service/src/app.module.ts`                                 | Root module                                                         |
| `infrastructure/Dockerfile.analytics-service`                              | Multi-stage Docker build; `SERVICE_PORT=3007`                       |

## Files Modified

| File                                                           | Change                                                                                                                                                                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/auth-service/src/auth/auth.module.ts`                    | Added `KafkaModule` import                                                                                                                                                                                 |
| `apps/auth-service/src/auth/auth.service.ts`                   | Injected `UserActivityProducerService`; emits `USER_REGISTERED`, `USER_LOGGED_IN`, `USER_LOGGED_OUT`                                                                                                       |
| `apps/suggestion-service/src/suggestion/suggestion.module.ts`  | Added `KafkaModule` import                                                                                                                                                                                 |
| `apps/suggestion-service/src/suggestion/suggestion.service.ts` | Injected `UserActivityProducerService`; emits `SUGGESTION_SEARCHED`                                                                                                                                        |
| `apps/favorite-service/src/favorite/favorite.module.ts`        | Added `KafkaModule` import                                                                                                                                                                                 |
| `apps/favorite-service/src/favorite/favorite.controller.ts`    | Injected `UserActivityProducerService`; emits `FAVORITE_ADDED`, `FAVORITE_REMOVED`, `FAVORITES_VIEWED`                                                                                                     |
| `apps/file-service/src/file/file.module.ts`                    | Added `KafkaModule` import                                                                                                                                                                                 |
| `apps/file-service/src/file/file.service.ts`                   | Injected `UserActivityProducerService`; emits `FILE_UPLOADED`, `FILE_DELETED`                                                                                                                              |
| `apps/file-service/src/file/file.controller.ts`                | Injected `UserActivityProducerService`; emits `FILE_DOWNLOADED` in `download()`                                                                                                                            |
| `apps/history-service/src/history/history.module.ts`           | Added `KafkaModule` import                                                                                                                                                                                 |
| `apps/history-service/src/history/history.controller.ts`       | Injected `UserActivityProducerService`; emits `HISTORY_VIEWED`                                                                                                                                             |
| `apps/history-service/src/history/history.controller.spec.ts`  | Added `UserActivityProducerService` mock provider                                                                                                                                                          |
| `apps/api-gateway/src/proxy/proxy.controller.ts`               | Added `@All(['analytics', 'analytics/*path'])` proxy route                                                                                                                                                 |
| `apps/api-gateway/src/proxy/proxy.service.ts`                  | Added analytics HATEOAS links in `buildResponseLinks()`                                                                                                                                                    |
| `infrastructure/docker-compose.yml`                            | Added `postgres-analytics`, `analytics-service`; `KAFKA_BROKERS` + `SERVICE_NAME` in all 5 producers; `kafka` health dependency on all 5 producers; `analytics-service` health dependency on `api-gateway` |

---

**Report Generated**: July 31, 2026
**Phase Status**: ✅ COMPLETE
**Next Phase**: Phase 2.4 — Internationalization (i18n)

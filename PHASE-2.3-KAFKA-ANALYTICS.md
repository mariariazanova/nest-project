# Phase 2.3: Kafka Event Streaming for Analytics — Implementation Plan

## Overview

Introduces Kafka as a dedicated event-streaming layer for analytics. All five existing services (`auth-service`, `suggestion-service`, `favorite-service`, `file-service`, `history-service`) become Kafka producers, publishing user-activity events to a single `user.activity` topic. A new `analytics-service` microservice consumes that topic and persists raw events to its own PostgreSQL database. The `api-gateway` gains proxy routes to `analytics-service` so the future Admin UI (Phase 3.1) can query analytics without crossing service boundaries.

A shared `libs/backend/kafka` library provides `UserActivityProducerService` (kafkajs-based, with non-blocking startup) and the `UserActivityType` enum — eliminating the per-service duplication seen in the reference implementation.

RabbitMQ continues to own command/notification delivery (Phase 2.2). Kafka owns analytics event streaming. The two are parallel transports — producers emit to both independently.

## Scope

✅ **In Scope:**

- `infrastructure/docker-compose.yml` — add Kafka (KRaft mode, `confluentinc/cp-kafka:7.5.0`) + `kafka-ui` management console
- `libs/backend/kafka/` — new shared library: `UserActivityType` enum (11 event types), `UserActivityProducerService` (kafkajs-based, `isConnected` guard, non-blocking startup)
- `apps/analytics-service/` — new NestJS microservice (internal port 3007): kafkajs consumer of `user.activity`, PostgreSQL (`analytics_db`) for raw event storage, REST API for analytics queries
- `apps/auth-service/src/` — inject `UserActivityProducerService`; emit `user.registered`, `user.logged_in`, `user.logged_out`
- `apps/suggestion-service/src/` — inject `UserActivityProducerService`; emit `suggestion.searched`
- `apps/favorite-service/src/` — inject `UserActivityProducerService`; emit `favorite.added`, `favorite.removed`, `favorites.viewed`
- `apps/file-service/src/` — inject `UserActivityProducerService`; emit `file.uploaded`, `file.downloaded`, `file.deleted`
- `apps/history-service/src/` — inject `UserActivityProducerService`; emit `history.viewed`
- `apps/api-gateway/src/` — add `/v1/analytics/*` proxy routes to `analytics-service`

❌ **Out of Scope:**

- Frontend analytics dashboard — analytics are consumed by the Phase 3.1 Admin UI, not the current user-facing frontend
- Kafka Streams / ksqlDB / windowed aggregations — current phase stores raw events only; aggregations are done at query time in analytics-service
- Confluent Schema Registry / Avro — using JSON envelopes for now; Schema Registry deferred to when payload schemas stabilise
- `file.metadata` event sourcing topic — the reference uses a second topic for file event sourcing; deferred here as no consumer for that data exists yet
- Multi-instance consumer groups — analytics-service runs as a single instance; horizontal scaling deferred to Phase 6
- Kafka topic compaction / retention policies — defaults for now; tune in Phase 6 when data volumes are known

## Deviations from ENHANCEMENT-PLAN.md

`ENHANCEMENT-PLAN.md` Phase 2.3 is a high-level sketch. The following decisions document implementation details beyond what the sketch specifies.

---

### 1. KRaft mode — no ZooKeeper container

**Original:** "Add Kafka + Zookeeper to docker-compose."

**Decision:** Use `confluentinc/cp-kafka:7.5.0` in KRaft mode (single-node). No ZooKeeper container.

**Why:** Kafka 3.x ships KRaft as production-stable. ZooKeeper adds a second container to manage, a second failure point, and extra memory in a dev environment that already runs 9+ containers. KRaft simplifies the setup to one container. Using the Confluent image (`cp-kafka`) aligns with the reference implementation and has well-documented KRaft config.

---

### 2. Single `user.activity` topic — not per-domain topics

**Original:** "Stream all user activity events."

**Decision:** One Kafka topic: `user.activity`. All 5 producer services publish to it. Event type is encoded as `eventType` in the message value and as a Kafka header.

**Why:** The reference uses this approach and it works cleanly. A single topic is simpler to manage (one consumer subscription, one offset to track). The `eventType` field allows analytics-service to route or filter without topic proliferation. If a future consumer needs only a subset of events, it filters by `eventType` after consuming — or a topic-per-event-type can be introduced via Kafka routing later.

---

### 3. kafkajs directly — not NestJS `ClientKafka`

**Original:** No mechanism specified.

**Decision:** All producers use a shared `UserActivityProducerService` that wraps kafkajs `Producer` directly. The analytics-service consumer is a standalone `AnalyticsKafkaConsumerService` that wraps kafkajs `Consumer` directly.

**Why:** `ClientKafka` (from `@nestjs/microservices`) returns a cold Observable from `emit()` — the same bug that silently dropped RabbitMQ messages in Phase 2.2 until `.subscribe()` was added. With kafkajs directly, `producer.send()` is a plain `async/await` call — no hidden Observable contract. The reference confirms this pattern works reliably. kafkajs also makes the `isConnected` guard and non-blocking startup straightforward to implement.

---

### 4. Shared `libs/backend/kafka` library — not per-service duplication

**Original:** No mention of shared libraries.

**Decision:** `UserActivityType` enum and `UserActivityProducerService` live in `libs/backend/kafka`. All five producer services import from there.

**Why:** The reference duplicates `user-activity.events.ts` across all 5 services (identical files). Our monorepo makes sharing trivial. A shared library ensures event type names are consistent (a typo in one service would otherwise silently create a new event type that analytics-service never handles).

---

### 5. Non-blocking startup — `isConnected` guard

**Original:** No resilience requirement specified.

**Decision:** `UserActivityProducerService.onModuleInit()` catches connection errors and sets `isConnected = false` instead of throwing. All `emit()` calls are no-ops when `isConnected` is false. Services start and serve their primary function even if Kafka is unavailable.

**Why:** Analytics events are fire-and-forget side-effects. If Kafka is down during startup, the service must still process user requests — a missing analytics event is acceptable; a failed service start is not.

---

### 6. Raw event log — no pre-aggregation on ingest

**Original:** "Store aggregated analytics in separate database."

**Decision:** `analytics-service` writes every event as a row in `analytics_events` (id, event_id, event_type, user_id, username, payload JSONB, event_date, created_at). Aggregations are computed at query time by the REST endpoints.

**Why:** Pre-aggregating on ingest couples the ingestion path to the query shape. Raw storage lets you recompute without re-processing Kafka if query needs change. For current data volumes, query-time aggregation over an indexed JSONB table is fast enough.

---

### 7. Separate `analytics-service` — not embedded in file-service

**Original:** Not specified. Reference embeds analytics in `file-service`.

**Decision:** Dedicated `analytics-service` microservice at `apps/analytics-service/`.

**Why:** The reference embeds analytics in file-service for simplicity (single codebase, shared DB), but it couples two unrelated concerns: file storage and cross-service analytics. In our monorepo, adding a new NestJS app costs little. A dedicated service keeps `file-service` focused, allows analytics to scale independently, and lets the Phase 3.1 Admin UI query analytics without routing through file-service.

---

### 8. Separate PostgreSQL container for analytics

**Original:** "Store aggregated analytics in separate database."

**Decision:** `analytics-service` gets its own `postgres-analytics` container (`analytics_db`). The actual docker-compose uses one postgres container per service (not a single shared instance), so analytics follows the same pattern.

**Why:** Consistent with the existing per-service database isolation in docker-compose. No cross-service table access. If analytics needs to be extracted to a managed cloud DB later, only the connection string changes.

---

## Why This Matters

### Why Kafka instead of RabbitMQ for analytics

RabbitMQ is a message queue: messages are consumed and deleted. It is designed for commands and notifications where each message is processed exactly once and then gone. Analytics needs an event log: events are retained for hours or days, multiple consumers (future ones included) can replay from any offset, and high-throughput ordered delivery is expected.

Kafka is a distributed log. Consumers track their own offsets and can re-read past events. This makes it the right tool for analytics, audit trails, and event sourcing — none of which RabbitMQ's queue model supports cleanly.

### Why a shared producer library

All 5 services emit to the same topic with the same envelope. Without a shared library, a typo in one service's `eventType` string silently creates a new unhandled event type. The shared `UserActivityType` enum makes invalid event types a compile error, not a silent data quality issue.

---

## Message Envelope

All events published to `user.activity` use this structure:

**Message value (JSON):**

```typescript
{
  eventId: string;      // UUID — unique per event
  eventType: UserActivityType;
  userId: string;
  username?: string;    // optional — include when available
  timestamp: string;    // ISO 8601
  // plus event-specific fields (fileId, category, count, etc.)
}
```

**Message key:** `userId` — ensures all events for a user land on the same partition (ordering per user).

**Headers (binary):**

```
eventType: <string>
eventId:   <string>
timestamp: <ISO string>
```

---

## Implementation Steps

### Step 1: Install kafkajs (30 min)

kafkajs is already a transitive dependency of `@nestjs/microservices`, but pin it explicitly:

```bash
npm install kafkajs
```

**Verify:**

```bash
node -e "require('kafkajs'); console.log('ok')"
```

---

### Step 2: Kafka in docker-compose (1.5–2 hours)

**`infrastructure/docker-compose.yml`** — add Kafka (KRaft) and kafka-ui:

```yaml
kafka:
  image: confluentinc/cp-kafka:7.5.0
  container_name: kafka
  environment:
    KAFKA_NODE_ID: 1
    KAFKA_PROCESS_ROLES: broker,controller
    KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
    KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
    KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
    CLUSTER_ID: MkU3OEVBNTcwNTJENDM2Qk
  networks: [microservices-network]
  healthcheck:
    test:
      [
        'CMD',
        'kafka-broker-api-versions',
        '--bootstrap-server',
        'localhost:9092',
      ]
    interval: 10s
    timeout: 5s
    retries: 10
    start_period: 30s
  restart: unless-stopped
  # Port NOT exposed — only internal services connect
  # ports:
  #   - "9092:9092"

kafka-ui:
  image: provectuslabs/kafka-ui:latest
  container_name: kafka-ui
  environment:
    KAFKA_CLUSTERS_0_NAME: local
    KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
  ports:
    - '8090:8080'
  networks: [microservices-network]
  depends_on:
    kafka:
      condition: service_healthy
  restart: unless-stopped
```

`KAFKA_AUTO_CREATE_TOPICS_ENABLE: true` — topics created on first publish. In production set to `false` and create topics explicitly.

---

### Step 3: Shared `libs/backend/kafka` library (1–1.5 hours)

Generate with Nx:

```bash
npm exec nx g @nx/nest:library kafka --directory=libs/backend/kafka --buildable
```

**`libs/backend/kafka/src/lib/user-activity.events.ts`:**

```typescript
export enum UserActivityType {
  USER_REGISTERED = 'user.registered',
  USER_LOGGED_IN = 'user.logged_in',
  USER_LOGGED_OUT = 'user.logged_out',
  SUGGESTION_SEARCHED = 'suggestion.searched',
  HISTORY_VIEWED = 'history.viewed',
  FAVORITES_VIEWED = 'favorites.viewed',
  FAVORITE_ADDED = 'favorite.added',
  FAVORITE_REMOVED = 'favorite.removed',
  FILE_UPLOADED = 'file.uploaded',
  FILE_DOWNLOADED = 'file.downloaded',
  FILE_DELETED = 'file.deleted',
}
```

**`libs/backend/kafka/src/lib/user-activity-producer.service.ts`:**

```typescript
@Injectable()
export class UserActivityProducerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly producer: Producer;
  private isConnected = false;
  private readonly logger = new Logger(UserActivityProducerService.name);

  constructor(private readonly config: ConfigService) {
    const kafka = new Kafka({
      clientId: config.get('SERVICE_NAME', 'service'),
      brokers: config.get('KAFKA_BROKERS', 'kafka:9092').split(','),
    });
    this.producer = kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log('Kafka producer connected');
    } catch (error) {
      this.logger.error('Failed to connect Kafka producer', error);
      // Don't throw — service starts without Kafka
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isConnected) await this.producer.disconnect();
  }

  async emit(
    eventType: UserActivityType,
    userId: string,
    payload: Record<string, unknown>,
    username?: string,
  ): Promise<void> {
    if (!this.isConnected) return;
    const eventId = randomUUID();
    const timestamp = new Date().toISOString();
    try {
      await this.producer.send({
        topic: 'user.activity',
        messages: [
          {
            key: userId,
            value: JSON.stringify({
              eventId,
              eventType,
              userId,
              username,
              timestamp,
              ...payload,
            }),
            headers: {
              eventType: Buffer.from(eventType),
              eventId: Buffer.from(eventId),
              timestamp: Buffer.from(timestamp),
            },
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Failed to emit ${eventType}`, error);
      // Don't throw — analytics failure must not block the main operation
    }
  }
}
```

**`libs/backend/kafka/src/lib/kafka.module.ts`:**

```typescript
@Module({
  imports: [ConfigModule],
  providers: [UserActivityProducerService],
  exports: [UserActivityProducerService],
})
export class KafkaModule {}
```

Export both `KafkaModule` and `UserActivityType` from `libs/backend/kafka/src/index.ts`.

---

### Step 4: Scaffold `analytics-service` (4–5 hours)

New NestJS application at `apps/analytics-service/`. Internal port 3007. Uses kafkajs consumer directly — no NestJS microservice transport.

**`main.ts`** — HTTP only (Kafka consumer starts via `onModuleInit`):

```typescript
const app = await NestFactory.create(AppModule);
await app.listen(process.env.PORT ?? 3007);
```

**`analytics-event.entity.ts`:**

```typescript
@Entity('analytics_events')
export class AnalyticsEventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() eventId: string;
  @Index() @Column() eventType: string;
  @Index() @Column() userId: string;
  @Column({ nullable: true }) username: string;
  @Column('jsonb') payload: Record<string, unknown>;
  @Index() @Column({ type: 'date' }) eventDate: string;
  @CreateDateColumn() createdAt: Date;
}
```

**`analytics-kafka-consumer.service.ts`** — kafkajs consumer, `fromBeginning: false`:

```typescript
@Injectable()
export class AnalyticsKafkaConsumerService
  implements OnModuleInit, OnModuleDestroy
{
  private consumer: Consumer;
  private readonly logger = new Logger(AnalyticsKafkaConsumerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const kafka = new Kafka({
      clientId: 'analytics-service',
      brokers: this.config.get('KAFKA_BROKERS', 'kafka:9092').split(','),
    });
    this.consumer = kafka.consumer({ groupId: 'analytics-consumer' });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: ['user.activity'],
      fromBeginning: false,
    });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const event = JSON.parse(message.value!.toString());
        await this.analyticsService.record(event);
      },
    });
    this.logger.log('Kafka consumer connected, subscribed to user.activity');
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
```

**`analytics-query.controller.ts`** — HTTP REST API for queries (Phase 3.1 Admin UI):

| Method | Path                                 | Description                              |
| ------ | ------------------------------------ | ---------------------------------------- |
| `GET`  | `/analytics/events`                  | Paginated raw event log                  |
| `GET`  | `/analytics/suggestions/by-category` | Suggestion counts by category            |
| `GET`  | `/analytics/favorites/by-category`   | Favorite add/remove counts by category   |
| `GET`  | `/analytics/files/summary`           | Upload counts, total size, delete counts |
| `GET`  | `/analytics/users/top`               | Most active users by event count         |

No auth guard in this phase — `api-gateway` adds `RoleGuard` in Phase 3.1.

**Config files:** `project.json`, `tsconfig*.json`, `webpack.config.js`, `jest.config.ts`, `nest-cli.json`, `eslint.config.mjs` — same pattern as `notification-service`.

**Dockerfile:** `infrastructure/Dockerfile.analytics-service` — same multi-stage pattern, `SERVICE_PORT=3007`.

---

### Step 5: `auth-service` — Kafka producer (1 hour)

**`apps/auth-service/src/auth/auth.module.ts`** — import `KafkaModule` from `libs/backend/kafka`.

**`apps/auth-service/src/auth/auth.service.ts`** — inject `UserActivityProducerService`; emit after register and login/logout:

```typescript
// register()
await this.kafka.emit(UserActivityType.USER_REGISTERED, userId, { username });

// login()
await this.kafka.emit(UserActivityType.USER_LOGGED_IN, userId, {}, username);

// logout()
await this.kafka.emit(UserActivityType.USER_LOGGED_OUT, userId, {});
```

---

### Step 6: `suggestion-service` — Kafka producer (1 hour)

**`apps/suggestion-service/src/suggestion/suggestion.module.ts`** — import `KafkaModule`.

**`apps/suggestion-service/src/suggestion/suggestion.service.ts`** — inject `UserActivityProducerService`; emit after returning suggestions:

```typescript
await this.kafka.emit(UserActivityType.SUGGESTION_SEARCHED, userId, {
  category,
  count,
});
```

---

### Step 7: `favorite-service` — Kafka producer (1 hour)

**`apps/favorite-service/src/favorite/favorite.module.ts`** — import `KafkaModule` (alongside existing `NOTIFICATION_CLIENT`).

**`apps/favorite-service/src/favorite/favorite.controller.ts`** — emit after each mutation:

```typescript
// addFavorite
await this.kafka.emit(UserActivityType.FAVORITE_ADDED, userId, {
  favoriteId,
  category,
  title,
});

// removeFavorite
await this.kafka.emit(UserActivityType.FAVORITE_REMOVED, userId, {
  favoriteId,
  title,
});

// getFavorites (list view)
await this.kafka.emit(UserActivityType.FAVORITES_VIEWED, userId, {
  count: favorites.length,
});
```

---

### Step 8: `file-service` — Kafka producer (1.5–2 hours)

**`apps/file-service/src/file/file.module.ts`** — import `KafkaModule`.

**`apps/file-service/src/file/file.service.ts`** — emit after upload and delete:

```typescript
// upload() — after repo.save()
await this.kafka.emit(UserActivityType.FILE_UPLOADED, userId, {
  fileId,
  originalName,
  mimeType,
  size,
});

// download() — after streaming the file
await this.kafka.emit(UserActivityType.FILE_DOWNLOADED, userId, {
  fileId,
  originalName,
});

// delete() — after repo.delete()
await this.kafka.emit(UserActivityType.FILE_DELETED, userId, {
  fileId,
  originalName,
});
```

---

### Step 9: `history-service` — Kafka producer (1 hour)

**`apps/history-service/src/history/history.module.ts`** — import `KafkaModule`.

**`apps/history-service/src/history/history.service.ts`** — emit when a user fetches their history:

```typescript
await this.kafka.emit(UserActivityType.HISTORY_VIEWED, userId, {
  count: records.length,
});
```

---

### Step 10: `api-gateway` — proxy analytics routes (1–1.5 hours)

**`apps/api-gateway/src/analytics/analytics.module.ts`** — new module; registers `ANALYTICS_SERVICE` HTTP client (Consul discovery or direct `ANALYTICS_SERVICE_URL`).

**`apps/api-gateway/src/analytics/analytics.controller.ts`** — proxies `GET /v1/analytics/*` to `analytics-service`. Same pattern as existing proxy controllers.

Add `AnalyticsModule` to `apps/api-gateway/src/app.module.ts` imports.

---

### Step 11: Docker Compose — `analytics-service` + env vars (1 hour)

**`infrastructure/docker-compose.yml`** — add `analytics-service`:

```yaml
analytics-service:
  build:
    context: ..
    dockerfile: infrastructure/Dockerfile.analytics-service
  container_name: analytics-service
  environment:
    PORT: 3007
    SERVICE_NAME: analytics-service
    KAFKA_BROKERS: kafka:9092
    DATABASE_URL: postgresql://analytics_user:analytics_pass@postgres:5432/analytics_db
    CONSUL_HOST: consul
    SERVICE_HOST: analytics-service
    SERVICE_PORT: 3007
  networks: [microservices-network]
  depends_on:
    kafka:
      condition: service_healthy
    postgres:
      condition: service_healthy
    consul:
      condition: service_healthy
  restart: unless-stopped
  # Port NOT exposed — only api-gateway connects here on the internal network
  # ports:
  #   - "3007:3007"
```

Add to existing services:

```yaml
# api-gateway
ANALYTICS_SERVICE_URL: http://analytics-service:3007

# auth-service, suggestion-service, favorite-service, file-service, history-service
KAFKA_BROKERS: kafka:9092
SERVICE_NAME: <service-name> # used as kafkajs clientId
```

**Postgres `analytics_db`** — add init script `infrastructure/postgres/init-analytics-db.sql`:

```sql
CREATE DATABASE analytics_db;
CREATE USER analytics_user WITH PASSWORD 'analytics_pass';
GRANT ALL PRIVILEGES ON DATABASE analytics_db TO analytics_user;
```

Mount it in the `postgres` container:

```yaml
postgres:
  volumes:
    - ./postgres/init-analytics-db.sql:/docker-entrypoint-initdb.d/02-analytics.sql
```

---

### Step 12: Build and verification (3–4 hours)

```bash
# Build all affected projects
npm exec nx run-many --target=build \
  --projects=kafka,analytics-service,api-gateway,auth-service,suggestion-service,favorite-service,file-service,history-service

# Rebuild and restart containers
docker compose -f infrastructure/docker-compose.yml build \
  analytics-service api-gateway auth-service suggestion-service favorite-service file-service history-service
docker compose -f infrastructure/docker-compose.yml up -d

# Verify Kafka started
docker logs kafka --tail 20

# Verify analytics-service connected
docker logs analytics-service --tail 30

# Open kafka-ui
open http://localhost:8090
```

**Manual verification:**

1. Log in → kafka-ui `user.activity` topic → `user.logged_in` message with correct `userId`, `eventId`, headers
2. Get suggestions → `suggestion.searched` message
3. Add a favorite → `favorite.added` message
4. Remove a favorite → `favorite.removed` message
5. Upload a file → `file.uploaded` message
6. Delete a file → `file.deleted` message
7. View history → `history.viewed` message
8. `GET http://localhost:3000/v1/analytics/users/top` → returns activity counts
9. Stop `analytics-service` → perform actions → restart → consumer processes the backlog

---

## Verification Checklist

### Kafka infrastructure

- [ ] `kafka` container healthy; `kafka-ui` accessible at `http://localhost:8090`
- [ ] `user.activity` topic visible in kafka-ui (auto-created on first publish)
- [ ] Consumer group `analytics-consumer` visible in kafka-ui under Consumer Groups with lag = 0

### analytics-service

- [ ] Container starts, registers with Consul as `analytics-service`
- [ ] Kafka consumer connected (`docker logs analytics-service | grep "connected"`)
- [ ] HTTP server responding at internal port 3007
- [ ] `GET /analytics/events` returns paginated raw events after activity
- [ ] `analytics_events` rows contain `eventId`, `eventType`, `userId`, `payload`, `eventDate`

### Producers (all 5 services)

- [ ] `auth-service` — `user.logged_in` message in `user.activity` after login
- [ ] `suggestion-service` — `suggestion.searched` after `GET /suggestions`
- [ ] `favorite-service` — `favorite.added` / `favorite.removed` after mutations
- [ ] `file-service` — `file.uploaded` / `file.downloaded` / `file.deleted` after file operations
- [ ] `history-service` — `history.viewed` after `GET /history`
- [ ] All messages have `eventId` UUID, `timestamp`, and binary headers

### Services start without Kafka

- [ ] Stop kafka container → restart all producer services → they start healthy with warning logs
- [ ] Start kafka → producer services reconnect (or restart them) → events flow again

### api-gateway analytics proxy

- [ ] `GET /v1/analytics/suggestions/by-category` returns data
- [ ] `GET /v1/analytics/users/top` returns data

### Build

- [ ] `npm exec nx build kafka` — 0 errors
- [ ] `npm exec nx build analytics-service` — 0 errors
- [ ] `npm exec nx build api-gateway` — 0 errors
- [ ] `npm exec nx build auth-service` — 0 errors
- [ ] `npm exec nx build suggestion-service` — 0 errors
- [ ] `npm exec nx build favorite-service` — 0 errors
- [ ] `npm exec nx build file-service` — 0 errors
- [ ] `npm exec nx build history-service` — 0 errors

---

## Rollback Strategy

```bash
# 1. Remove analytics-service and shared kafka lib
git checkout apps/analytics-service/
git checkout libs/backend/kafka/
git checkout infrastructure/Dockerfile.analytics-service

# 2. Revert all producers
git checkout apps/auth-service/src/auth/
git checkout apps/suggestion-service/src/suggestion/
git checkout apps/favorite-service/src/favorite/
git checkout apps/file-service/src/file/
git checkout apps/history-service/src/history/

# 3. Revert api-gateway analytics proxy
git checkout apps/api-gateway/src/analytics/
git checkout apps/api-gateway/src/app.module.ts

# 4. Remove Kafka from docker-compose
git checkout infrastructure/docker-compose.yml
git checkout infrastructure/postgres/init-analytics-db.sql

docker compose -f infrastructure/docker-compose.yml up -d
```

Rollback is code-only. `analytics_db` and `analytics_events` rows can be left in place — no other service reads them.

---

## Timeline Summary

| Step      | Task                                                                           | Time               |
| --------- | ------------------------------------------------------------------------------ | ------------------ |
| 1         | Install `kafkajs`                                                              | 30 min             |
| 2         | Kafka (KRaft, `cp-kafka:7.5.0`) + kafka-ui in docker-compose                   | 1.5–2 hours        |
| 3         | `libs/backend/kafka` — `UserActivityType` enum + `UserActivityProducerService` | 1–1.5 hours        |
| 4         | Scaffold `analytics-service` — kafkajs consumer, entity, REST API              | 4–5 hours          |
| 5         | `auth-service` — emit `user.registered/logged_in/logged_out`                   | 1 hour             |
| 6         | `suggestion-service` — emit `suggestion.searched`                              | 1 hour             |
| 7         | `favorite-service` — emit `favorite.added/removed/favorites.viewed`            | 1 hour             |
| 8         | `file-service` — emit `file.uploaded/downloaded/deleted`                       | 1.5–2 hours        |
| 9         | `history-service` — emit `history.viewed`                                      | 1 hour             |
| 10        | `api-gateway` — proxy `/v1/analytics/*` to `analytics-service`                 | 1–1.5 hours        |
| 11        | Docker Compose — `analytics-service`, env vars, `analytics_db` init script     | 1 hour             |
| 12        | Build, Docker rebuild, manual verification                                     | 3–4 hours          |
| **Total** |                                                                                | **~18.5–23 hours** |

---

## Notes on Dependencies

- **Phase 1.1 (Database Migrations)** — Phase 1.1 replaces `synchronize: true` with TypeORM migrations for all PostgreSQL services. `analytics-service` introduces a new `analytics_events` table in `analytics_db`. If Phase 1.1 is complete before Phase 2.3, create a TypeORM migration for the initial schema instead of using `synchronize: true`. If Phase 1.1 has not run yet, use `synchronize: true` temporarily and convert it when Phase 1.1 is executed.
- **Phase 2.2 (WebSocket Notifications)** — `suggestion-service`, `favorite-service`, and `file-service` already emit to RabbitMQ `notifications_queue` via `NOTIFICATION_CLIENT`. Adding Kafka emits is additive — both run independently after the same operation. RabbitMQ for real-time user notifications; Kafka for analytics. Not either/or.
- **Phase 3.1 (RBAC Admin UI)** — ENHANCEMENT-PLAN.md Phase 3.1 mentions "Create admin-service with analytics endpoints". That analytics API is built here in Phase 2.3 (`analytics-service` REST endpoints). Phase 3.1 does **not** need to create a separate admin-service for analytics — it only needs to add `RoleGuard` to the existing `GET /analytics/*` routes in `analytics-service` and wire those routes into the admin dashboard UI.
- **Phase 3.4 (Secrets Management)** — Phase 3.4 replaces hardcoded docker-compose credentials with Docker Secrets or env files. Phase 2.3 introduces new hardcoded values: `analytics_user:analytics_pass` (postgres) and `KAFKA_BROKERS: kafka:9092` across all 6 services (analytics-service + 5 producers). All of these must be included in the Phase 3.4 secrets sweep.
- **Phase 6.2 (Terraform / Production Kafka)** — the single-node KRaft setup (`cp-kafka:7.5.0`) is dev-only. Production deployment requires managed Kafka (AWS MSK, Confluent Cloud) or a multi-broker cluster. No application code changes — only the `KAFKA_BROKERS` env var needs updating in all 6 services (analytics-service + 5 producers). The `libs/backend/kafka` producer and the analytics-service consumer are fully reusable. The only addition needed for cloud Kafka is SASL/SSL config in the `Kafka` constructor in `UserActivityProducerService` and `AnalyticsKafkaConsumerService`:
  ```typescript
  const kafka = new Kafka({
    clientId: config.get('SERVICE_NAME'),
    brokers: config.get('KAFKA_BROKERS').split(','),
    ssl: config.get('KAFKA_SSL') === 'true',
    sasl: config.get('KAFKA_SASL_USERNAME')
      ? {
          mechanism: 'plain',
          username: config.get('KAFKA_SASL_USERNAME'),
          password: config.get('KAFKA_SASL_PASSWORD'),
        }
      : undefined,
  });
  ```
  New env vars (`KAFKA_SSL`, `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD`) default to unset in dev — no dev behaviour change. For horizontal scaling of `analytics-service`, the same `groupId: 'analytics-consumer'` across all instances is correct — Kafka load-balances partitions between them automatically, no code change needed.
- **`libs/backend/kafka` and Phase 0.5** — Phase 0.5 extracted shared infrastructure (health, consul, circuit-breaker, metrics) to `libs/backend/`. The new `libs/backend/kafka` follows the same pattern. If Phase 0.5 has not been completed yet, scaffold the library manually instead of using the shared lib generator.

---

**Phase 2.3 Status**: Ready to implement.
**Next Phase**: Phase 2.4 — Internationalization (i18n)

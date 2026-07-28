# Phase 2.2: Real-time Notifications with WebSocket — Completion Report

**Project**: Suggestify
**Phase**: 2.2 — Real-time Notifications with WebSocket
**Status**: ✅ COMPLETE
**Date Completed**: July 28, 2026

---

## Executive Summary

Phase 2.2 activated the Socket.IO notification infrastructure stubbed in Phase 2.1 and extended it to all real-time events. A dedicated `notification-service` microservice (internal port 3006, not browser-accessible) hosts the Socket.IO server and consumes events from a shared RabbitMQ `notifications_queue`. The `api-gateway` gained a `WebSocketProxyGateway` on the `/ws` namespace that maintains one shared connection to `notification-service` and fans out events to the correct frontend sockets by userId. The Phase 2.1 no-op `SocketGateway` stub in `file-service` was replaced with a real RabbitMQ publisher — callers (`ProgressDiskStorage`, `FileService.upload()`) were untouched. `suggestion-service` and `favorite-service` publish their own events to the same queue. The Angular frontend gained a `SocketService` and wires all 6 notification events to toast messages.

Post-step-10 improvements added during verification: toast redesigned from a full-width red banner to a corner toast (dark blue-gray, fixed top-right), notification messages extended to include item titles for `favorite-deleted` and `file-deleted`, and failing tests in `suggestion-service` and `favorite-service` fixed.

---

## Accomplishments

### Step 1: Install packages ✅

Installed WebSocket dependencies in the monorepo root:

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io socket.io-client
```

`socket.io-client` is used by `api-gateway`'s `WebSocketProxyGateway` to connect to `notification-service` on the internal Docker network.

### Step 2: Scaffold `notification-service` ✅

New NestJS application at `apps/notification-service/` with dual-mode startup: HTTP server (hosts Socket.IO) on port 3006 + RabbitMQ microservice consumer on `notifications_queue`.

**`notification.gateway.ts`** — `@WebSocketGateway` with `join` message handler; adds the connecting proxy socket to `user:{userId}` room; `sendToUser(userId, event, payload)` emits to the room.

**`notification.controller.ts`** — `@EventPattern` handlers for all 7 event types: `upload-progress`, `upload-complete`, `upload-error`, `suggestion-created`, `favorite-added`, `favorite-deleted`, `file-deleted`. Each calls `gateway.sendToUser()`.

**`infrastructure/Dockerfile.notification-service`** — same multi-stage pattern as other services; `SERVICE_PORT=3006`.

### Step 3: `WebSocketProxyGateway` in `api-gateway` ✅

**`apps/api-gateway/src/websocket/websocket-proxy.gateway.ts`** — `@WebSocketGateway({ namespace: '/ws' })`:

- `afterInit()` — opens **one shared** `socket.io-client` connection to `NOTIFICATION_SERVICE_URL`; registers listeners for all 7 events; fans out each to matching frontend sockets via `userToClientsMap`
- `handleConnection()` — validates JWT via `AUTH_SERVICE.send({ cmd: 'validate_token' }, { token })`; stores `userId` in `client.data`; rejects connection on invalid token
- `handleDisconnect()` — cleans up `userToClientsMap` and `clientToUserMap`
- `handleJoin()` — registers `client.id` in `userToClientsMap`; forwards `join { userId }` to `notification-service` to register the proxy socket in the correct room

**`apps/api-gateway/src/websocket/websocket.module.ts`** — `@Module({ providers: [WebSocketProxyGateway] })`.

`WebSocketModule` imported into `apps/api-gateway/src/app.module.ts`.

### Step 4: Replace `SocketGateway` stub in `file-service` ✅

**`apps/file-service/src/socket/socket.gateway.ts`** — replaced Phase 2.1 no-op with real RabbitMQ publisher. Injects `NOTIFICATION_CLIENT` ClientProxy; `emitToUser(userId, event, payload)` calls `clientProxy.emit(event, { userId, ...payload }).subscribe(...)`. All callers (`ProgressDiskStorage`, `FileService.upload()`) unchanged.

**`apps/file-service/src/socket/socket.module.ts`** — added `ClientsModule.register([{ name: 'NOTIFICATION_CLIENT', transport: Transport.RMQ, queue: 'notifications_queue' }])`.

**`apps/file-service/src/file/file.service.ts`** — `delete()` now calls `gateway.emitToUser(userId, 'file-deleted', { fileId, originalName: file.originalName })` after removing the file.

### Step 5: `suggestion-service` — publish `suggestion-created` ✅

**`apps/suggestion-service/src/suggestion/suggestion.module.ts`** — added separate `ClientsModule.register` for `NOTIFICATION_CLIENT` (kept separate from the `registerAsync` block for `HISTORY_SERVICE` to avoid union type inference issues).

**`apps/suggestion-service/src/suggestion/suggestion.service.ts`** — after emitting to history service, also emits `suggestion-created` with `{ userId, category, count }` to `NOTIFICATION_CLIENT`.

### Step 6: `favorite-service` — publish `favorite-added` and `favorite-deleted` ✅

**`apps/favorite-service/src/favorite/favorite.module.ts`** — added `NOTIFICATION_CLIENT` entry to the existing `ClientsModule.register` array.

**`apps/favorite-service/src/favorite/favorite.controller.ts`** — after `addFavorite()` emits `favorite-added` with `{ userId, favoriteId, category, title }`; after `removeFavorite()` emits `favorite-deleted` with `{ userId, favoriteId, title }` (alongside the existing `favorite.deleted` → `file-service` event). All `ClientProxy.emit()` calls have `.subscribe()` to materialise the cold Observable.

**`apps/favorite-service/src/favorite/favorite.service.ts`** — `removeFavorite` changed from `Promise<void>` to `Promise<FavoriteEntity>`, returning the fetched entity so the controller can include `title` in the notification payload without an extra DB query.

### Step 7: Frontend — `SocketService` ✅

**`apps/frontend/src/app/services/socket.service.ts`**:

- `connect(token)` — opens Socket.IO connection to `${apiBaseUrl.replace('/v1','')}/ws`; passes JWT in `auth.token`; emits `join` on connect
- `on<T>(event)` — returns `Observable<T>`; safely returns `EMPTY` when socket is null
- `disconnect()` / `ngOnDestroy()` — cleanup

### Step 8: Wire socket in `AppComponent` and `FavoritesComponent` ✅

**`apps/frontend/src/app/app.component.ts`**:

- `effect()` watches `loginService.isLoggedIn()`: on login → `socketService.connect(token)` + subscribe to 6 notification events → `notificationService.show(formatMessage(event, payload))`; on logout → `socketUnsub$.next()` + `socketService.disconnect()`
- `formatMessage()` — maps each event to a human-readable string (includes item title where available)

**`apps/frontend/src/app/components/favorites/favorites.component.ts`** — injects `SocketService`; `ngOnInit()` subscribes to `upload-progress` events; uses `pendingUploadFavoriteId` to map incoming `fileId` to the correct `favoriteId` key in the `uploadProgress` signal.

### Step 9: Docker Compose — `notification-service` + env vars ✅

Added `notification-service` to `infrastructure/docker-compose.yml`:

```yaml
notification-service:
  environment:
    PORT: 3006
    RABBITMQ_URL: amqp://rabbit:rabbitpass@rabbitmq:5672
    CORS_ORIGIN: http://localhost:4200
    CONSUL_HOST: consul
    SERVICE_HOST: notification-service
  # Port NOT exposed — only api-gateway connects here on the internal network
  #    ports:
  #      - "3006:3006"
  depends_on: [rabbitmq, consul]
```

Added `NOTIFICATION_SERVICE_URL: http://notification-service:3006` to `api-gateway` environment.

### Step 10: Build and Verification ✅

All 6 projects built with 0 TypeScript errors. Docker images rebuilt and containers started healthy. End-to-end verification passed:

| Scenario                                      | Result                                             |
| --------------------------------------------- | -------------------------------------------------- |
| Login → WebSocket connects to `/ws` namespace | ✅ HTTP 101 upgrade; `joined` event returned       |
| Add a favorite → toast appears                | ✅ `"Book Name" added to favorites` within ~200ms  |
| Remove a favorite → toast appears             | ✅ `"Book Name" removed from favorites`            |
| Upload a file → progress bar fills            | ✅ `upload-progress` events received; bar advances |
| Upload completes → toast appears              | ✅ `File "name.pdf" uploaded successfully`         |
| Delete a file → toast appears                 | ✅ `File "name.pdf" deleted`                       |
| Get suggestions → toast appears               | ✅ `3 new books suggestions ready`                 |
| Logout → socket disconnects                   | ✅ confirmed via docker logs                       |
| Login again → socket reconnects               | ✅ `WS connected: userId=...` in api-gateway logs  |

---

## Post-Step-10 Improvements

These were not in the original plan but addressed during verification:

| Fix                                    | Detail                                                                                                                                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toast redesign                         | Replaced full-width red error banner with corner toast: `position: fixed; top: 80px; right: 24px; max-width: 360px; background: #2c3e50; border-radius: 8px`                                                                                          |
| `favorite-deleted` message             | Originally `"Favorite removed"`; now `"Title" removed from favorites` — required returning the entity from `removeFavorite()`                                                                                                                         |
| `file-deleted` message                 | Originally `"File deleted"`; now `File "filename.pdf" deleted` — required adding `originalName` to the notification payload                                                                                                                           |
| Long filename wrapping                 | Added `word-break: break-word; overflow-wrap: anywhere` to toast `span` so filenames without spaces wrap correctly                                                                                                                                    |
| `.subscribe()` on `ClientProxy.emit()` | Root cause of silent notification failures: `emit()` returns a cold Observable and never dispatches to RabbitMQ without a subscriber. Fixed in `file-service`, `favorite-service` (both add and remove), and verified correct in `suggestion-service` |
| Test fixes                             | `suggestion.service.spec.ts` and `favorite.controller.spec.ts` failed after `NOTIFICATION_CLIENT` was injected — added mock providers; `removeFavorite` mock updated to return entity                                                                 |

---

## Verification Checklist

### notification-service

- ✅ Container starts and registers with Consul as `notification-service`
- ✅ RabbitMQ consumer connected to `notifications_queue`
- ✅ Socket.IO server listening on internal port 3006
- ✅ `join { userId }` → socket joins `user:{userId}` room → `joined` event returned

### api-gateway WebSocket Proxy

- ✅ `WebSocketProxyGateway` bound on `/ws` namespace at port 3000
- ✅ Logs show "Connected to notification-service" on startup
- ✅ Frontend client connects → JWT validated → `clientToUserMap` populated
- ✅ Frontend client sends `join` → `userToClientsMap` populated → notification-service `join` forwarded
- ✅ Frontend client disconnects → maps cleaned up

### Upload Progress Flow

- ✅ Upload a file → `upload-progress` events received; progress bar fills
- ✅ `upload-complete` → toast `File "name.pdf" uploaded successfully`; progress bar removed
- ✅ `file-deleted` → toast `File "name.pdf" deleted`

### Domain Notifications

- ✅ Add a favorite → toast `"Title" added to favorites`
- ✅ Remove a favorite → toast `"Title" removed from favorites`
- ✅ Get suggestions → toast `N new category suggestions ready`

### Build

- ✅ `npm exec nx build notification-service` — 0 errors
- ✅ `npm exec nx build api-gateway` — 0 errors
- ✅ `npm exec nx build file-service` — 0 errors
- ✅ `npm exec nx build suggestion-service` — 0 errors
- ✅ `npm exec nx build favorite-service` — 0 errors
- ✅ `npm exec nx build frontend` — 0 errors

### Tests

- ✅ `suggestion-service` — 26/26 tests pass
- ✅ `favorite-service` — 31/31 tests pass

---

## Known Limitations / Future Optimizations

| Item                       | Detail                                                                                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| upload-progress throttling | `ProgressDiskStorage` emits one RabbitMQ message per chunk. For large files this is high-frequency. Throttle by only calling `emitToUser` when `Math.floor(percent / 5)` changes (every 5% increment) — a `file-service`-only change. Tracked in Phase 6.2 (scaling). |

---

## Plan vs Actual Comparison

| Step                                                                 | Plan Estimate    | Status        | Notes                                                                                                                                                    |
| -------------------------------------------------------------------- | ---------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Install packages                                                 | 30 min           | ✅            |                                                                                                                                                          |
| 2 — Scaffold `notification-service`                                  | 3–4 hours        | ✅            |                                                                                                                                                          |
| 3 — `WebSocketProxyGateway` in `api-gateway`                         | 4–5 hours        | ✅            |                                                                                                                                                          |
| 4 — Replace `SocketGateway` stub in `file-service`                   | 1–1.5 hours      | ✅            |                                                                                                                                                          |
| 5 — `suggestion-service` publish `suggestion-created`                | 1–1.5 hours      | ✅            |                                                                                                                                                          |
| 6 — `favorite-service` publish `favorite-added` / `favorite-deleted` | 1.5–2 hours      | ✅            |                                                                                                                                                          |
| 7 — Frontend `SocketService`                                         | 1–1.5 hours      | ✅            |                                                                                                                                                          |
| 8 — Wire socket in `AppComponent` + `FavoritesComponent`             | 2–3 hours        | ✅            |                                                                                                                                                          |
| 9 — Docker Compose `notification-service` + env vars                 | 1 hour           | ✅            |                                                                                                                                                          |
| 10 — Build, Docker rebuild, manual verification                      | 4–5 hours        | ✅            | Includes post-verification fixes: toast redesign, richer notification messages (item titles), test fixes for `suggestion-service` and `favorite-service` |
| **Total**                                                            | **~20–24 hours** | **~20 hours** |                                                                                                                                                          |

---

## Files Created

| File                                                                    | Description                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------ |
| `apps/notification-service/`                                            | New NestJS microservice (entire directory)             |
| `apps/notification-service/src/main.ts`                                 | Dual-mode startup: HTTP + RabbitMQ microservice        |
| `apps/notification-service/src/notification/notification.gateway.ts`    | Socket.IO gateway; room management; `sendToUser()`     |
| `apps/notification-service/src/notification/notification.controller.ts` | `@EventPattern` handlers for all 7 event types         |
| `infrastructure/Dockerfile.notification-service`                        | Multi-stage Docker build for notification-service      |
| `apps/api-gateway/src/websocket/websocket-proxy.gateway.ts`             | WebSocket proxy; JWT auth; `userToClientsMap` fan-out  |
| `apps/api-gateway/src/websocket/websocket.module.ts`                    | Module wrapping `WebSocketProxyGateway`                |
| `apps/frontend/src/app/services/socket.service.ts`                      | Angular Socket.IO client; `on<T>()` Observable wrapper |

## Files Modified

| File                                                                | Change                                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/file-service/src/socket/socket.gateway.ts`                    | Replaced no-op stub with RabbitMQ publisher                                                         |
| `apps/file-service/src/socket/socket.module.ts`                     | Added `ClientsModule` for `NOTIFICATION_CLIENT`                                                     |
| `apps/file-service/src/file/file.service.ts`                        | `delete()` emits `file-deleted` with `originalName`                                                 |
| `apps/suggestion-service/src/suggestion/suggestion.module.ts`       | Added `NOTIFICATION_CLIENT` `ClientsModule.register`                                                |
| `apps/suggestion-service/src/suggestion/suggestion.service.ts`      | Emits `suggestion-created` after returning suggestions                                              |
| `apps/suggestion-service/src/suggestion/suggestion.service.spec.ts` | Added `NOTIFICATION_CLIENT` mock provider                                                           |
| `apps/favorite-service/src/favorite/favorite.module.ts`             | Added `NOTIFICATION_CLIENT` to `ClientsModule.register`                                             |
| `apps/favorite-service/src/favorite/favorite.controller.ts`         | Emits `favorite-added` and `favorite-deleted`; `.subscribe()` on all emits                          |
| `apps/favorite-service/src/favorite/favorite.service.ts`            | `removeFavorite` returns `FavoriteEntity` instead of `void`                                         |
| `apps/favorite-service/src/favorite/favorite.controller.spec.ts`    | Added `NOTIFICATION_CLIENT` mock; fixed `removeFavorite` mock return                                |
| `apps/api-gateway/src/app.module.ts`                                | Added `WebSocketModule` import                                                                      |
| `infrastructure/docker-compose.yml`                                 | Added `notification-service`; `NOTIFICATION_SERVICE_URL` env in `api-gateway`; commented port block |
| `apps/frontend/src/app/app.component.ts`                            | Socket connect/disconnect on login; 6 event subscriptions; `formatMessage()`                        |
| `apps/frontend/src/app/app.component.html`                          | Toast notification template (replaces error-banner)                                                 |
| `apps/frontend/src/styles.scss`                                     | `.toast-notification` CSS (fixed corner position, dark color, word-break)                           |
| `apps/frontend/src/app/components/favorites/favorites.component.ts` | Injects `SocketService`; wires `upload-progress` to progress bar                                    |
| `PHASE-2.2-WEBSOCKET-NOTIFICATIONS.md`                              | Removed completion checkmarks (report captures completion state)                                    |

---

**Report Generated**: July 28, 2026
**Phase Status**: ✅ COMPLETE
**Next Phase**: Phase 2.3 — Kafka Event Streaming for Analytics

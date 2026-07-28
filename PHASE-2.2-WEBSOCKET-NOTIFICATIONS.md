# Phase 2.2: Real-time Notifications with WebSocket — Implementation Plan

## Overview

Activates the Socket.IO infrastructure stubbed in Phase 2.1 and extends it to all real-time notification events. A dedicated `notification-service` microservice (internal, not exposed to the browser) hosts the real Socket.IO server and consumes events from a RabbitMQ `notifications_queue`. The `api-gateway` gains a `WebSocketProxyGateway` on the `/ws` namespace that maintains one shared connection to `notification-service` and forwards events to the right frontend clients by userId. The `SocketGateway` no-op stub in `file-service` is replaced with a RabbitMQ publisher to `notifications_queue` — callers (`ProgressDiskStorage`, `FileService`) are untouched. `suggestion-service` and `favorite-service` publish their own events to the same queue. The frontend gets a `SocketService` and wires all notification events to the existing toast system (`NotificationService.show()`).

## Scope

✅ **In Scope:**

- `apps/notification-service/` — new NestJS microservice (internal port 3006): `NotificationWebSocketGateway` (Socket.IO server), `NotificationController` (RabbitMQ consumers for all event types)
- `apps/api-gateway/src/websocket/` — new `WebSocketProxyGateway` (`/ws` namespace, proxies frontend ↔ notification-service, JWT auth on connect via `AUTH_SERVICE` ClientProxy, `userToClientsMap` routing)
- `apps/file-service/src/socket/socket.gateway.ts` — replace no-op stub with RabbitMQ publisher to `notifications_queue`; same `emitToUser()` interface, callers unchanged; also emit `file-deleted` on direct user delete
- `apps/suggestion-service/src/` — add `NOTIFICATION_CLIENT`; publish `suggestion-created` to `notifications_queue` after returning suggestions
- `apps/favorite-service/src/` — add `NOTIFICATION_CLIENT`; publish `favorite-added` and `favorite-deleted` to `notifications_queue`
- `apps/frontend/src/app/services/socket.service.ts` — new Angular service; Socket.IO client on `/ws`, JWT in `auth.token`, `on<T>(event)` Observable wrapper, returns `EMPTY` when not connected
- `apps/frontend/src/app/app.component.ts` — connect socket on login, subscribe to all 6 notification events, show each as toast via existing `NotificationService.show()`
- `apps/frontend/src/app/components/favorites/favorites.component.ts` — wire `uploadProgress` signal to real `upload-progress` Socket.IO events via `SocketService`

❌ **Out of Scope:**

- Persistent notification center / unread badge — notifications are transient toasts only; history clears on dismiss
- Browser Push Notifications (service workers / `Notification` API) — requires HTTPS + service worker, deferred to Phase 6
- WebSocket horizontal scaling — the proxy pattern works on a single `api-gateway` instance; multi-instance scaling requires the Socket.IO Redis adapter on `notification-service`, deferred to Phase 6
- Upload chunked via WebSocket (upload-bridge pattern) — our project uses HTTP POST + `ProgressDiskStorage`; no change to that mechanism
- Notification preferences / per-user muting
- history-service WebSocket events — history writes are async side-effects; no real-time user notification needed

## Deviations from ENHANCEMENT-PLAN.md

`ENHANCEMENT-PLAN.md` Phase 2.2 is a high-level sketch. The following decisions document implementation details beyond what the sketch specifies.

---

### 1. Dedicated `notification-service` (not inlined in `api-gateway`)

**Original:** "Create notification-service or add to API Gateway."

**Decision:** New `notification-service` microservice on internal port 3006 (not exposed to the browser).

**Why:** The reference implementation (another Suggestify variant) uses this separation, and the reasons hold for our project too. The `api-gateway` is a routing layer — it should not own domain logic for managing user rooms or dispatching typed notifications. A dedicated service keeps concerns separate: `notification-service` owns the Socket.IO server and the room membership model; `api-gateway` just proxies the WebSocket frames. If `notification-service` needs to be replaced with a managed real-time service (Ably, Pusher) in production, the change is isolated to one service.

---

### 2. `api-gateway` as WebSocket proxy (not a direct Socket.IO server)

**Original:** No proxy pattern mentioned.

**Decision:** `api-gateway` runs `WebSocketProxyGateway` on `/ws` namespace. It maintains **one shared socket connection** to `notification-service` (not one per frontend client). When a frontend client sends `join`, the proxy forwards `join { userId }` to `notification-service`, which adds the proxy socket to the `user:{userId}` room. When `notification-service` emits an event to that room, the proxy receives it, looks up `userToClientsMap.get(userId)`, and emits to each matching frontend socket.

**Why:** The browser can only reach `api-gateway:3000`. The `notification-service` is on the internal Docker network. Proxying is necessary. One shared backend connection (vs one per client) avoids O(n) backend socket overhead as concurrent users grow.

---

### 3. RabbitMQ for service → notification-service (not Redis pub/sub)

**Original:** No delivery mechanism specified.

**Decision:** All services publish to a single `notifications_queue` via RabbitMQ. `notification-service` consumes with `@EventPattern`.

**Why:** RabbitMQ is already the project's async messaging layer. Routing a new class of events through it keeps the architecture uniform — no new infrastructure dependencies. RabbitMQ also provides durable delivery: if `notification-service` restarts during an upload, in-flight events are redelivered when it comes back up.

---

### 4. `SocketGateway` interface unchanged — callers need no modification

**Original:** Phase 2.1 plan: "Phase 2.2 replaces the stub with the real Socket.IO gateway; no backend changes needed."

**Decision:** The replacement `SocketGateway` in `file-service` keeps `emitToUser(userId, event, payload): void` (synchronous, void). Internally it calls `ClientProxy.emit()` (fire-and-forget). `ProgressDiskStorage` and `FileService.upload()` are untouched.

**Why:** `ProgressDiskStorage._handleFile` calls `emitToUser` inside a stream `data` event handler. The method must remain synchronous-looking (void) at the call site.

---

### 5. JWT verified via `AUTH_SERVICE` ClientProxy (not `JwtService` directly)

**Original:** No auth mechanism specified for WebSocket.

**Decision:** `WebSocketProxyGateway.handleConnection()` sends `{ cmd: 'validate_token' }` to the `AUTH_SERVICE` ClientProxy, which is already global in `api-gateway` via `GlobalClientsModule`. Extracts `userId` from the response and stores it in `client.data.userId`. The `join` message from the frontend triggers room registration using the verified `userId`, not any userId the client claims.

**Why:** Consistent with `AuthMiddleware` in `api-gateway` — same pattern, same service. Avoids introducing `JwtService` as a second verification mechanism for the same token.

---

### 6. Notifications are toasts only — no persistent center

**Original:** "Send notifications for: new suggestions, favorites added, system alerts, file upload progress and completion."

**Decision:** All notification events route to the existing `NotificationService.show()` toast. No bell icon, no unread badge, no notification list. `upload-progress` drives the `FavoritesComponent` progress bar only (not a toast).

**Why:** Toasts are already wired in `app.component.html` and work. A notification center would add UI complexity (bell, dropdown, unread count, mark-all-read) for marginal benefit in the current phase. Can be revisited if needed.

---

## Why This Matters

### Why a dedicated notification-service instead of a module in api-gateway

The `api-gateway` is already responsible for JWT validation, rate limiting, circuit breaking, Consul discovery, and HTTP proxying. Adding Socket.IO room management and typed notification dispatch there increases its surface area. A dedicated service has a single responsibility: receive events from RabbitMQ, maintain user rooms, emit to connected clients.

### Why the proxy pattern (shared backend connection)

If `api-gateway` opened a socket to `notification-service` for each frontend client, 1000 concurrent users would create 1000 backend sockets. The proxy pattern uses one connection: `api-gateway` joins all necessary rooms on that one connection, and `notification-service` emits to rooms. The proxy maintains the `userToClientsMap` (userId → Set of frontend socket IDs) to fan out to the right clients.

---

## Implementation Steps

### Step 1: Install packages (30 min)

**Backend** (root `package.json`):

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io socket.io-client
```

**Frontend** (`apps/frontend`):

```bash
npm install socket.io-client
```

---

### Step 2: Scaffold `notification-service` (3–4 hours)

New NestJS app at `apps/notification-service/`. Key files:

**`main.ts`** — dual-mode: HTTP (for Socket.IO) + RabbitMQ microservice on `notifications_queue`.

**`notification.gateway.ts`** — `@WebSocketGateway({ cors: { origin: '*' } })`, handles `join` message (adds proxy socket to `user:{userId}` room), exposes `sendToUser(userId, event, payload)`.

**`notification.controller.ts`** — `@EventPattern` handlers for all 7 events (`upload-progress`, `upload-complete`, `upload-error`, `suggestion-created`, `favorite-added`, `favorite-deleted`, `file-deleted`), each calling `gateway.sendToUser()`.

Config files: `project.json`, `tsconfig*.json`, `webpack.config.js`, `jest.config.ts`, `nest-cli.json`, `eslint.config.mjs`.

Dockerfile: `infrastructure/Dockerfile.notification-service` — same multi-stage pattern as other services, `SERVICE_PORT=3006`.

---

### Step 3: `WebSocketProxyGateway` in `api-gateway` (4–5 hours)

**`apps/api-gateway/src/websocket/websocket-proxy.gateway.ts`** — `@WebSocketGateway({ namespace: '/ws', cors: { origin: fn, credentials: true } })`:

- `afterInit()` — opens one shared socket.io-client connection to `NOTIFICATION_SERVICE_URL`; registers listeners for all 7 notification events; forwards each to matching frontend sockets via `userToClientsMap`
- `handleConnection()` — validates JWT via `AUTH_SERVICE.send({ cmd: 'validate_token' }, { token })`; stores `userId` in `client.data`
- `handleDisconnect()` — cleans up `userToClientsMap` and `clientToUserMap`
- `handleJoin()` — registers `client.id` in `userToClientsMap`, forwards `join { userId }` to notification-service

**`apps/api-gateway/src/websocket/websocket.module.ts`** — `@Module({ providers: [WebSocketProxyGateway] })`.

`WebSocketModule` added to `apps/api-gateway/src/app.module.ts` imports.

---

### Step 4: Replace `SocketGateway` stub in `file-service` (1–1.5 hours)

**`apps/file-service/src/socket/socket.gateway.ts`** — injects `NOTIFICATION_CLIENT` ClientProxy; `emitToUser(userId, event, payload)` calls `clientProxy.emit(event, { userId, ...payload })` (fire-and-forget).

**`apps/file-service/src/socket/socket.module.ts`** — adds `ClientsModule.register([{ name: 'NOTIFICATION_CLIENT', queue: 'notifications_queue' }])`.

**`apps/file-service/src/file/file.service.ts`** — `delete()` now calls `gateway.emitToUser(userId, 'file-deleted', { fileId })` after removing the file. All other callers (`ProgressDiskStorage`, `FileService.upload()`) unchanged.

---

### Step 5: `suggestion-service` — publish `suggestion-created` (1–1.5 hours)

**`apps/suggestion-service/src/suggestion/suggestion.module.ts`** — adds `ClientsModule.register([{ name: 'NOTIFICATION_CLIENT', queue: 'notifications_queue' }])` as a separate import alongside the existing `ClientsModule.registerAsync` for `HISTORY_SERVICE` (kept separate to avoid union type inference issue with `registerAsync`).

**`apps/suggestion-service/src/suggestion/suggestion.service.ts`** — injects `NOTIFICATION_CLIENT`; after emitting to history service, also emits `suggestion-created` with `{ userId, category, count }`.

---

### Step 6: `favorite-service` — publish `favorite-added` and `favorite-deleted` (1.5–2 hours)

**`apps/favorite-service/src/favorite/favorite.module.ts`** — adds `NOTIFICATION_CLIENT` entry to the existing `ClientsModule.register` array.

**`apps/favorite-service/src/favorite/favorite.controller.ts`** — injects `NOTIFICATION_CLIENT`; after `addFavorite()` emits `favorite-added` with `{ userId, favoriteId, category, title }`; after `removeFavorite()` emits `favorite-deleted` with `{ userId, favoriteId }` (alongside the existing `favorite.deleted` → file-service emit).

---

### Step 7: Frontend — `SocketService` (1–1.5 hours)

**`apps/frontend/src/app/services/socket.service.ts`**:

- `connect(token)` — opens Socket.IO connection to `${apiBaseUrl.replace('/v1','')}/ws`, passes JWT in `auth.token`, emits `join` on connect (no body — `userId` resolved server-side)
- `on<T>(event)` — returns `Observable<T>`; returns `EMPTY` if socket is null (safe to call before `connect()`)
- `disconnect()` / `ngOnDestroy()` — cleanup

Socket URL derived from `environment.apiBaseUrl` by stripping `/v1` suffix.

---

### Step 8: Wire socket in `AppComponent` and `FavoritesComponent` (2–3 hours)

**`apps/frontend/src/app/app.component.ts`**:

- `effect()` watches `loginService.isLoggedIn()`: on login → `socketService.connect(token)` + subscribe to 6 notification events → `notificationService.show(formatMessage(event, payload))`; on logout → unsubscribe (`socketUnsub$.next()`) + `socketService.disconnect()`
- `formatMessage()` — formats each event into a human-readable English string

**`apps/frontend/src/app/components/favorites/favorites.component.ts`**:

- Injects `SocketService`
- `ngOnInit()` subscribes to `upload-progress` events; uses `pendingUploadFavoriteId` (set in `onFileSelected()`, cleared on complete/error) to map WebSocket `fileId` to the component's `favoriteId` key in `uploadProgress` signal

---

### Step 9: Docker Compose — `notification-service` + env vars (1 hour)

`infrastructure/docker-compose.yml`:

```yaml
notification-service:
  build:
    context: ..
    dockerfile: infrastructure/Dockerfile.notification-service
  container_name: notification-service
  environment:
    PORT: 3006
    RABBITMQ_URL: amqp://rabbit:rabbitpass@rabbitmq:5672
    CORS_ORIGIN: http://localhost:4200
    CONSUL_HOST: consul
    SERVICE_NAME: notification-service
    SERVICE_PORT: 3006
  networks: [microservices-network]
  depends_on:
    rabbitmq:
      condition: service_healthy
    consul:
      condition: service_healthy
  restart: unless-stopped
  # Port NOT exposed — only api-gateway connects here on the internal network
```

Add to `api-gateway` environment:

```yaml
NOTIFICATION_SERVICE_URL: http://notification-service:3006
```

No new ports exposed. WebSocket upgrade happens on the existing `api-gateway:3000` via the `/ws` namespace.

---

### Step 10: Build and verification (4–5 hours)

```bash
# Build all affected projects
npm exec nx run-many --target=build \
  --projects=notification-service,api-gateway,file-service,suggestion-service,favorite-service,frontend

# Rebuild and restart containers
docker compose -f infrastructure/docker-compose.yml build \
  notification-service api-gateway file-service suggestion-service favorite-service
docker compose -f infrastructure/docker-compose.yml up -d

# Verify notification-service started
docker logs notification-service --tail 30

# Verify api-gateway proxy connected to notification-service
docker logs api-gateway --tail 30 | grep -i notification
```

**Manual browser test:**

1. Open http://localhost:4200 — log in
2. DevTools → Network → WS tab → verify `ws://localhost:3000/ws/socket.io` → status 101
3. Verify `joined` message in WS frames after connect
4. Navigate to Favorites → upload a file → verify `upload-progress` events in WS frames (ascending percent) and progress bar fills
5. Upload completes → progress bar disappears; toast "File X uploaded successfully" appears
6. Add a new favorite → toast "Title added to favorites" appears
7. Get suggestions → toast "N new category suggestions ready" appears
8. Log out → socket disconnects; log in again → reconnects with new token

---

## Verification Checklist

### notification-service

- [ ] Container starts, registers with Consul as `notification-service`
- [ ] RabbitMQ consumer connected to `notifications_queue` (visible in RabbitMQ management UI at http://localhost:15672)
- [ ] Socket.IO server listening on port 3006 (internal only)
- [ ] `join { userId }` → socket joins `user:{userId}` room → `joined` event returned

### api-gateway WebSocket Proxy

- [ ] `WebSocketProxyGateway` bound on `/ws` namespace at port 3000
- [ ] Logs show "Connected to notification-service" on startup
- [ ] Frontend client connects → JWT validated → `clientToUserMap` populated
- [ ] Frontend client sends `join` → `userToClientsMap` populated → notification-service `join` forwarded
- [ ] Frontend client disconnects → maps cleaned up
- [ ] Connection rejected when JWT missing or invalid

### Upload Progress Flow

- [ ] Upload a file → `upload-progress` events in browser DevTools WS frames (ascending percent)
- [ ] Progress bar in `FavoritesComponent` fills as events arrive
- [ ] `upload-complete` → toast "File X uploaded successfully"; progress bar removed
- [ ] `file-deleted` → toast "File deleted"

### Domain Notifications (toasts)

- [ ] Add a favorite → toast `"Title" added to favorites` within ~200ms
- [ ] Remove a favorite → toast `Favorite removed`
- [ ] Get suggestions → toast `N new category suggestions ready`

### RabbitMQ `notifications_queue`

- [ ] `notifications_queue` visible in RabbitMQ management UI with `durable: true`
- [ ] `notification-service` is the sole consumer
- [ ] Stopping `notification-service` → messages queue up → restart → messages delivered

### Build

- [ ] `npm exec nx build notification-service` — 0 errors
- [ ] `npm exec nx build api-gateway` — 0 errors
- [ ] `npm exec nx build file-service` — 0 errors
- [ ] `npm exec nx build suggestion-service` — 0 errors
- [ ] `npm exec nx build favorite-service` — 0 errors
- [ ] `npm exec nx build frontend` — 0 errors

---

## Rollback Strategy

```bash
# 1. Revert SocketGateway stub (restore no-op)
git checkout apps/file-service/src/socket/socket.gateway.ts
git checkout apps/file-service/src/socket/socket.module.ts
git checkout apps/file-service/src/file/file.service.ts

# 2. Remove notification-service
git checkout apps/notification-service/
git checkout infrastructure/Dockerfile.notification-service

# 3. Remove WebSocket module from api-gateway
git checkout apps/api-gateway/src/websocket/
git checkout apps/api-gateway/src/app.module.ts

# 4. Revert suggestion-service and favorite-service
git checkout apps/suggestion-service/src/suggestion/suggestion.module.ts
git checkout apps/suggestion-service/src/suggestion/suggestion.service.ts
git checkout apps/favorite-service/src/favorite/favorite.module.ts
git checkout apps/favorite-service/src/favorite/favorite.controller.ts

# 5. Revert frontend
git checkout apps/frontend/src/app/services/socket.service.ts
git checkout apps/frontend/src/app/app.component.ts
git checkout apps/frontend/src/app/components/favorites/favorites.component.ts

# 6. Revert docker-compose
git checkout infrastructure/docker-compose.yml

docker compose -f infrastructure/docker-compose.yml up -d
```

No database migrations — rollback is code-only.

---

## Timeline Summary

| Step      | Task                                                                                                     | Time             |
| --------- | -------------------------------------------------------------------------------------------------------- | ---------------- |
| 1         | Install `@nestjs/websockets`, `socket.io` (backend) + `socket.io-client` (frontend)                      | 30 min           |
| 2         | Scaffold `notification-service` — gateway + RabbitMQ controller for 7 event types                        | 3–4 hours        |
| 3         | `WebSocketProxyGateway` in `api-gateway` — `/ws` namespace, JWT auth, proxy to notification-service      | 4–5 hours        |
| 4         | Replace `SocketGateway` stub in `file-service`; emit `file-deleted` on user delete                       | 1–1.5 hours      |
| 5         | `suggestion-service` — emit `suggestion-created` to `notifications_queue`                                | 1–1.5 hours      |
| 6         | `favorite-service` — emit `favorite-added` and `favorite-deleted` to `notifications_queue`               | 1.5–2 hours      |
| 7         | Frontend `SocketService` — Socket.IO client, `on<T>()` Observable, safe when disconnected                | 1–1.5 hours      |
| 8         | Wire socket in `AppComponent` (connect/disconnect on login) + `FavoritesComponent` (upload-progress bar) | 2–3 hours        |
| 9         | Docker Compose — add `notification-service`, `NOTIFICATION_SERVICE_URL` env var in `api-gateway`         | 1 hour           |
| 10        | Build, Docker rebuild, manual verification                                                               | 4–5 hours        |
| **Total** |                                                                                                          | **~20–24 hours** |

---

## Notes on Dependencies

- **Phase 2.1 (File Uploads)** — `ProgressDiskStorage` and `FileService` already call `gateway.emitToUser()`. Replacing the no-op with the RabbitMQ publisher (Step 4) makes upload progress events flow automatically — no changes to those callers.
- **Phase 3.2 (Secure JWT / httpOnly Cookies)** — when JWTs move to httpOnly cookies, `SocketService.connect(token)` must be updated. With cookies, the browser sends them automatically on the WebSocket handshake (`withCredentials: true` is already set). `WebSocketProxyGateway.handleConnection()` would extract the JWT from `client.handshake.headers.cookie` instead of `client.handshake.auth.token`.
- **Phase 6.2 (Terraform / Horizontal Scaling)** — the proxy pattern works on a single `api-gateway` instance. If `api-gateway` scales horizontally, add the Socket.IO Redis adapter (`@socket.io/redis-adapter`) to `notification-service` and all gateway replicas.
- **Phase 3.6 (ClamAV Virus Scanning)** — after a virus scan rejection, `file-service` should call `gateway.emitToUser(userId, 'upload-error', { fileId, error: 'File rejected by virus scanner' })`. The toast handler in `AppComponent` already handles `upload-error`.
- **High-frequency upload-progress events** — for large files, `ProgressDiskStorage` emits one RabbitMQ message per chunk. If this generates too many messages, throttle by only calling `emitToUser` when `Math.floor(percent / 5)` changes (every 5% increment) — a `file-service`-only change.

---

**Phase 2.2 Status**: Ready to implement.
**Next Phase**: Phase 2.3 — Kafka Event Streaming for Analytics

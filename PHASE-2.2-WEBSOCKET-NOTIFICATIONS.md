# Phase 2.2: Real-time Notifications with WebSocket — Implementation Plan

## Overview

Activates the Socket.IO infrastructure stubbed in Phase 2.1 and extends it to all real-time notification events. A dedicated `notification-service` microservice (internal, not exposed to the browser) hosts the real Socket.IO server and consumes events from a RabbitMQ `notifications_queue`. The `api-gateway` gains a `WebSocketProxyGateway` on the `/ws` namespace that maintains one shared connection to `notification-service` and forwards events to the right frontend clients by userId. The `SocketGateway` no-op stub in `file-service` is replaced with a RabbitMQ publisher to `notifications_queue` — callers (`ProgressDiskStorage`, `FileService`) are untouched. `suggestion-service` and `favorite-service` publish their own events to the same queue. The frontend gets a `SocketService`, an enhanced `NotificationService` with an unread badge and notification center, and the upload progress bar in `FavoritesComponent` is wired to real events for the first time.

## Scope

✅ **In Scope:**

- `apps/notification-service/` — new NestJS microservice (internal port 3006): `NotificationWebSocketGateway` (Socket.IO server), `NotificationController` (RabbitMQ consumers for all event types)
- `apps/api-gateway/src/websocket/` — new `WebSocketProxyGateway` (`/ws` namespace, proxies frontend ↔ notification-service, JWT auth on connect, `userToClientsMap` routing)
- `apps/file-service/src/socket/socket.gateway.ts` — replace no-op stub with RabbitMQ publisher to `notifications_queue`; same `emitToUser()` interface, callers unchanged
- `apps/suggestion-service/src/` — `NotificationPublisher` service; publish `suggestion-created` to `notifications_queue` after saving suggestions
- `apps/favorite-service/src/` — `NotificationPublisher` service; publish `favorite-added` to `notifications_queue` after saving a favorite
- `apps/frontend/src/app/services/socket.service.ts` — new Angular service; Socket.IO client on `/ws`, JWT in `auth.token`, `on<T>(event)` Observable wrapper
- `apps/frontend/src/app/services/notification.service.ts` — extend existing toast-only service with `notifications` signal, `unreadCount` computed, `push()` / `markAllRead()` / `clear()`
- `apps/frontend/src/app/components/notification-center/` — new standalone component: bell icon with unread badge, dropdown list, mark-all-read
- `apps/frontend/src/app/components/favorites/favorites.component.ts` — wire `uploadProgress` signal to real `upload-progress` / `upload-complete` Socket.IO events

❌ **Out of Scope:**

- Persisting notifications in a database — session-only (Angular signal state); refresh clears history; DB persistence is a Phase 3+ concern
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

**Decision:** `api-gateway` runs `WebSocketProxyGateway` on `/ws` namespace. It maintains **one shared socket connection** to `notification-service` (not one per frontend client). When a frontend client sends `join { userId }`, the proxy forwards `join { userId }` to `notification-service`, which adds the proxy socket to the `user:{userId}` room. When `notification-service` emits an event to that room, the proxy receives it, looks up `userToClientsMap.get(userId)`, and emits to each matching frontend socket.

**Why:** The browser can only reach `api-gateway:3000`. The `notification-service` is on the internal Docker network. Proxying is necessary. One shared backend connection (vs one per client) avoids O(n) backend socket overhead as concurrent users grow.

---

### 3. RabbitMQ for service → notification-service (not Redis pub/sub)

**Original:** No delivery mechanism specified.

**Decision:** All services publish to a single `notifications_queue` via RabbitMQ. `notification-service` consumes with `@EventPattern`.

**Why:** RabbitMQ is already the project's async messaging layer. Routing a new class of events through it keeps the architecture uniform — no new infrastructure dependencies. Redis pub/sub would require a raw `ioredis` publisher in every producing service, which is a new dependency pattern not used elsewhere. RabbitMQ also provides durable delivery: if `notification-service` restarts during an upload, in-flight events are redelivered when it comes back up. Upload-progress events are high-frequency but small (< 200 bytes per chunk event) — RabbitMQ handles this volume comfortably within the Docker network.

---

### 4. `SocketGateway` interface unchanged — callers need no modification

**Original:** Phase 2.1 plan: "Phase 2.2 replaces the stub with the real Socket.IO gateway; no backend changes needed."

**Decision:** The replacement `SocketGateway` in `file-service` keeps `emitToUser(userId, event, payload): void` (synchronous, void). Internally it calls `ClientProxy.emit()` (fire-and-forget) with a `.subscribe({ error: logger })` to drain the Observable. `ProgressDiskStorage` and `FileService` are untouched.

**Why:** `ProgressDiskStorage._handleFile` calls `emitToUser` inside a stream `data` event handler. The method must remain synchronous-looking (void) at the call site; error handling stays inside `SocketGateway`.

---

### 5. Upload progress events flow through RabbitMQ (same path as domain events)

**Original:** No specification.

**Decision:** `upload-progress` (per-chunk, high-frequency), `upload-complete`, `suggestion-created`, and `favorite-added` all route through `notifications_queue`.

**Why:** Keeping one path for all events simplifies the architecture — no split between Redis pub/sub and RabbitMQ. Per-chunk events are small and frequent but well within RabbitMQ's throughput capacity on the internal Docker network. For very large files, consider throttling in `ProgressDiskStorage` (emit only when percent changes by ≥ 5%) — noted in Step 3, but not required for the implementation to be correct.

---

### 6. Upload events are transient; domain events go into the notification center

**Original:** "Send notifications for: new suggestions, favorites added, system alerts, file upload progress and completion."

**Decision:**

- `upload-progress` and `upload-complete` — drive the FavoritesComponent progress bar only; not stored in the notification center
- `suggestion-created` and `favorite-added` — stored in `NotificationService._notifications` signal; shown in the notification center with unread badge

**Why:** A notification center filling with "37% uploaded" entries would be noisy and meaningless once the upload finishes.

---

### 7. JWT verified on WebSocket connection at the `api-gateway` proxy level

**Original:** No auth mechanism specified for WebSocket.

**Decision:** Frontend sends JWT in `socket.handshake.auth.token`. `WebSocketProxyGateway.handleConnection()` verifies it with `JwtService`, extracts `userId`, and uses it to populate `clientToUserMap`. A `join` message from the frontend triggers the room join — the proxy joins on behalf of the client using the verified `userId` (not the userId the client claims in the payload), preventing room-squatting.

**Why:** Without JWT verification, any client could `join { userId: 'victim-uuid' }` and receive another user's notifications.

---

## Why This Matters

### Why a dedicated notification-service instead of a module in api-gateway

The `api-gateway` is already responsible for JWT validation, rate limiting, circuit breaking, Consul discovery, and HTTP proxying. Adding Socket.IO room management and typed notification dispatch there increases its surface area and makes it harder to reason about. A dedicated service has a single responsibility: receive events from RabbitMQ, maintain user rooms, emit to connected clients. The only coupling point is the `notifications_queue` queue name and the payload schema — both stable contracts.

### Why the proxy pattern (shared backend connection)

If `api-gateway` opened a socket to `notification-service` for each frontend client, 1000 concurrent users would create 1000 backend sockets. The proxy pattern uses one connection: `api-gateway` joins all necessary rooms on that one connection, and `notification-service` emits to rooms. The proxy maintains the `userToClientsMap` (userId → Set of frontend socket IDs) to fan out to the right clients. This scales to many frontend clients without additional backend connections.

---

## Implementation Steps

### Step 1: Install packages (30 min)

**Backend** (root `package.json` or `backend/package.json`):

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

**Frontend** (`apps/frontend/package.json`):

```bash
npm install socket.io-client
```

Verify `socket.io` version matches `socket.io-client` (both `^4.x`).

---

### Step 2: Scaffold `notification-service` (2-3 hours)

Generate the NestJS application:

```bash
npm exec nx -- g @nx/nest:app notification-service --directory=apps/notification-service
```

Wire the same infrastructure pattern as existing services:

`apps/notification-service/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConsulModule } from '@suggestify/backend/consul';
import { MetricsModule } from '@suggestify/backend/metrics';
import { LoggerModule } from '@suggestify/backend/logger';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConsulModule.forRoot({
      serviceName: 'notification-service',
      servicePort: 3006,
      tags: ['notifications', 'microservice'],
    }),
    MetricsModule,
    LoggerModule.forRoot({ serviceName: 'notification-service' }),
    NotificationModule,
  ],
})
export class AppModule {}
```

`apps/notification-service/src/main.ts` — dual-mode: HTTP (for Socket.IO) + RabbitMQ microservice:

```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // RabbitMQ consumer for all notification events from other services
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'notifications_queue',
      queueOptions: { durable: true },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3006);
}

bootstrap();
```

`apps/notification-service/src/notification/notification.module.ts`:

```typescript
@Module({
  providers: [NotificationWebSocketGateway, NotificationController],
})
export class NotificationModule {}
```

`apps/notification-service/src/notification/notification.gateway.ts` — the real Socket.IO server (not exposed to the browser directly; only `api-gateway` connects here):

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } }) // all origins OK — only api-gateway connects here
@Injectable()
export class NotificationWebSocketGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationWebSocketGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const room = `user:${data.userId}`;
    client.join(room);
    client.emit('joined', { room, userId: data.userId });
    this.logger.log(`Socket ${client.id} joined room ${room}`);
  }

  // Called by NotificationController after receiving a RabbitMQ event.
  // userId is included in the payload so the api-gateway proxy can route to the right frontend clients.
  sendToUser(
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    this.server.to(`user:${userId}`).emit(event, { userId, ...payload });
  }
}
```

`apps/notification-service/src/notification/notification.controller.ts` — RabbitMQ consumers, one per event type:

```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationWebSocketGateway } from './notification.gateway';

interface NotificationPayload {
  userId: string;
  [key: string]: unknown;
}

@Controller()
export class NotificationController {
  constructor(private readonly gateway: NotificationWebSocketGateway) {}

  @EventPattern('upload-progress')
  handleUploadProgress(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'upload-progress', rest);
  }

  @EventPattern('upload-complete')
  handleUploadComplete(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'upload-complete', rest);
  }

  @EventPattern('upload-error')
  handleUploadError(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'upload-error', rest);
  }

  @EventPattern('suggestion-created')
  handleSuggestionCreated(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'suggestion-created', rest);
  }

  @EventPattern('favorite-added')
  handleFavoriteAdded(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'favorite-added', rest);
  }
}
```

`apps/notification-service/Dockerfile` — same multi-stage pattern as existing services.

---

### Step 3: `WebSocketProxyGateway` in `api-gateway` (2-3 hours)

Create `apps/api-gateway/src/websocket/websocket-proxy.gateway.ts`:

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: ['http://localhost:4200', 'http://localhost:80'],
    credentials: true,
  },
})
@Injectable()
export class WebSocketProxyGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WebSocketProxyGateway.name);

  // One shared connection to notification-service (not one per frontend client)
  private notificationClient: ClientSocket;

  // userId → Set of frontend socket IDs (one user may have multiple tabs open)
  private readonly userToClientsMap = new Map<string, Set<string>>();
  // frontend socket ID → userId
  private readonly clientToUserMap = new Map<string, string>();

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  afterInit() {
    const notificationUrl = this.config.get(
      'NOTIFICATION_SERVICE_URL',
      'http://notification-service:3006',
    );
    this.notificationClient = ioClient(notificationUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    this.notificationClient.on('connect', () =>
      this.logger.log('Connected to notification-service'),
    );
    this.notificationClient.on('disconnect', (reason) =>
      this.logger.warn(`Disconnected from notification-service: ${reason}`),
    );

    // Forward all notification events to the right frontend clients
    const events = [
      'upload-progress',
      'upload-complete',
      'upload-error',
      'suggestion-created',
      'favorite-added',
    ];
    events.forEach((eventName) => {
      this.notificationClient.on(eventName, (data: { userId: string }) => {
        const clientIds = this.userToClientsMap.get(data.userId);
        if (clientIds) {
          clientIds.forEach((clientId) =>
            this.server.to(clientId).emit(eventName, data),
          );
        }
      });
    });
  }

  handleConnection(client: Socket) {
    // Verify JWT on connection — extract userId without trusting the join payload
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Rejected connection (no token): ${client.id}`);
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwt.verify<{ userId: string }>(token);
      client.data.userId = payload.userId;
      this.logger.log(
        `Frontend client connected: userId=${payload.userId} socketId=${client.id}`,
      );
    } catch {
      this.logger.warn(`Rejected connection (invalid token): ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.clientToUserMap.get(client.id);
    if (userId) {
      const clients = this.userToClientsMap.get(userId);
      clients?.delete(client.id);
      if (clients?.size === 0) this.userToClientsMap.delete(userId);
      this.clientToUserMap.delete(client.id);
    }
    this.logger.log(`Frontend client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() _data: unknown, // payload userId ignored — use the JWT-verified one
  ) {
    const userId = client.data.userId as string;
    if (!userId) return;

    // Register in local routing maps
    if (!this.userToClientsMap.has(userId)) {
      this.userToClientsMap.set(userId, new Set());
    }
    this.userToClientsMap.get(userId)!.add(client.id);
    this.clientToUserMap.set(client.id, userId);

    // Tell notification-service to add our shared socket to this user's room
    this.notificationClient.emit('join', { userId });

    client.emit('joined', { room: `user:${userId}`, userId });
    this.logger.log(`Client ${client.id} registered for userId=${userId}`);
  }

  onModuleDestroy() {
    this.notificationClient.disconnect();
  }
}
```

Create `apps/api-gateway/src/websocket/websocket.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { WebSocketProxyGateway } from './websocket-proxy.gateway';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
  ],
  providers: [WebSocketProxyGateway],
})
export class WebSocketModule {}
```

Add `WebSocketModule` to `apps/api-gateway/src/app.module.ts` imports.

---

### Step 4: Replace `SocketGateway` stub in `file-service` (1 hour)

`apps/file-service/src/socket/socket.gateway.ts` — replace no-op with RabbitMQ publisher:

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { take } from 'rxjs';

@Injectable()
export class SocketGateway {
  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    @Inject('NOTIFICATION_CLIENT')
    private readonly notificationClient: ClientProxy,
  ) {}

  emitToUser(userId: string, event: string, payload: unknown): void {
    // Fire-and-forget — progress events are best-effort
    this.notificationClient
      .emit(event, { userId, ...(payload as Record<string, unknown>) })
      .pipe(take(1))
      .subscribe({
        error: (err) =>
          this.logger.error(`RabbitMQ emit failed for event=${event}`, err),
      });
  }
}
```

Add `ClientsModule` to `apps/file-service/src/app.module.ts` (alongside the existing `connectMicroservice` for `file_queue`):

```typescript
ClientsModule.register([
  {
    name: 'NOTIFICATION_CLIENT',
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'notifications_queue',
      queueOptions: { durable: true },
    },
  },
]),
```

**Callers unchanged:** `ProgressDiskStorage._handleFile` and `FileService.upload()` call `this.gateway.emitToUser(userId, event, payload)` — the method signature is identical to the stub; neither file is modified.

---

### Step 5: `suggestion-service` — publish `suggestion-created` (45 min)

`apps/suggestion-service/src/notification/notification.publisher.ts`:

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { take } from 'rxjs';

@Injectable()
export class NotificationPublisher {
  private readonly logger = new Logger(NotificationPublisher.name);

  constructor(
    @Inject('NOTIFICATION_CLIENT') private readonly client: ClientProxy,
  ) {}

  publish(
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    this.client
      .emit(event, { userId, ...payload })
      .pipe(take(1))
      .subscribe({
        error: (err) =>
          this.logger.error(`RabbitMQ emit failed for event=${event}`, err),
      });
  }
}
```

Add `ClientsModule` and `NotificationPublisher` to `apps/suggestion-service/src/app.module.ts`.

In the suggestion controller/service, after saving suggestions:

```typescript
this.notificationPublisher.publish(userId, 'suggestion-created', {
  count: suggestions.length,
  category: criteria.category,
});
```

---

### Step 6: `favorite-service` — publish `favorite-added` (45 min)

Copy `NotificationPublisher` to `apps/favorite-service/src/notification/notification.publisher.ts` (same pattern). Add `ClientsModule` and register the publisher in `apps/favorite-service/src/app.module.ts`.

In `favorite.controller.ts`, after saving a favorite:

```typescript
this.notificationPublisher.publish(userId, 'favorite-added', {
  favoriteId: created.id,
  title: created.title,
  category: created.category,
});
```

---

### Step 7: Frontend — `SocketService` (1-2 hours)

`apps/frontend/src/app/services/socket.service.ts`:

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket?: Socket;

  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io(environment.wsUrl, {
      auth: { token },
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.debug('[SocketService] Connected:', this.socket?.id);
      this.socket?.emit('join', {}); // userId resolved server-side from JWT
    });
    this.socket.on('disconnect', (reason) =>
      console.debug('[SocketService] Disconnected:', reason),
    );
    this.socket.on('connect_error', (err) =>
      console.warn('[SocketService] Connection error:', err.message),
    );
  }

  on<T>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const handler = (data: T) => subscriber.next(data);
      this.socket?.on(event, handler);
      return () => this.socket?.off(event, handler);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
```

**`apps/frontend/src/environments/environment.ts`** — add `wsUrl`:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/v1',
  wsUrl: 'http://localhost:3000/ws', // /ws namespace in api-gateway
};
```

**Call `connect()` after login** — in the component or service that handles auth success (wherever the JWT is received, inject `SocketService` and call `socketService.connect(token)`). Call `disconnect()` on logout.

---

### Step 8: Enhanced `NotificationService` (1 hour)

Extend `apps/frontend/src/app/services/notification.service.ts`:

```typescript
import { Injectable, computed, signal } from '@angular/core';

export interface AppNotification {
  id: string;
  event: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  // existing toast
  readonly message = signal<string | null>(null);

  show(text: string, durationMs = 5000): void {
    this.message.set(text);
    setTimeout(() => this.message.set(null), durationMs);
  }

  // notification center
  private readonly _notifications = signal<AppNotification[]>([]);
  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(
    () => this._notifications().filter((n) => !n.read).length,
  );

  push(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
    const entry: AppNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };
    this._notifications.update((ns) => [entry, ...ns].slice(0, 50));
    this.show(notification.title);
  }

  markAllRead(): void {
    this._notifications.update((ns) => ns.map((n) => ({ ...n, read: true })));
  }

  clear(): void {
    this._notifications.set([]);
  }
}
```

**Wire domain events in `AppComponent`:**

```typescript
// apps/frontend/src/app/app.component.ts
ngOnInit(): void {
  this.socketService
    .on<{ count: number; category: string }>('suggestion-created')
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(({ count, category }) =>
      this.notificationService.push({
        event: 'suggestion-created',
        title: 'Nowe sugestie',
        message: `${count} nowe sugestie w kategorii ${category}`,
      }),
    );

  this.socketService
    .on<{ title: string }>('favorite-added')
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(({ title }) =>
      this.notificationService.push({
        event: 'favorite-added',
        title: 'Dodano do ulubionych',
        message: title,
      }),
    );
}
```

---

### Step 9: `NotificationCenterComponent` (2-3 hours)

`apps/frontend/src/app/components/notification-center/notification-center.component.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-center.component.html',
  styleUrls: ['./notification-center.component.scss'],
})
export class NotificationCenterComponent {
  readonly notificationService = inject(NotificationService);
  readonly isOpen = signal(false);

  toggle(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) this.notificationService.markAllRead();
  }
}
```

`notification-center.component.html`:

```html
<div class="notification-bell" (click)="toggle()">
  <span class="bell-icon">🔔</span>
  @if (notificationService.unreadCount() > 0) {
  <span class="badge">{{ notificationService.unreadCount() }}</span>
  }
</div>

@if (isOpen()) {
<div class="notification-panel">
  <div class="panel-header">
    <span>Powiadomienia</span>
    <button class="clear-btn" (click)="notificationService.clear()">
      Wyczyść
    </button>
  </div>
  @if (notificationService.notifications().length === 0) {
  <div class="empty-state">Brak powiadomień</div>
  } @else { @for (n of notificationService.notifications(); track n.id) {
  <div class="notification-item" [class.unread]="!n.read">
    <div class="notif-title">{{ n.title }}</div>
    <div class="notif-message">{{ n.message }}</div>
    <div class="notif-time">{{ n.timestamp | date:'HH:mm' }}</div>
  </div>
  } }
</div>
}
```

`notification-center.component.scss`:

```scss
.notification-bell {
  position: relative;
  cursor: pointer;
  display: inline-flex;
  align-items: center;

  .bell-icon {
    font-size: 1.4rem;
  }

  .badge {
    position: absolute;
    top: -6px;
    right: -8px;
    background: #e53e3e;
    color: white;
    border-radius: 50%;
    min-width: 18px;
    height: 18px;
    font-size: 0.7rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }
}

.notification-panel {
  position: absolute;
  top: 100%;
  right: 0;
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 1000;

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
    font-weight: 600;

    .clear-btn {
      font-size: 0.75rem;
      color: #718096;
      background: none;
      border: none;
      cursor: pointer;
      &:hover {
        color: #e53e3e;
      }
    }
  }

  .empty-state {
    padding: 24px;
    text-align: center;
    color: #a0aec0;
    font-size: 0.875rem;
  }

  .notification-item {
    padding: 12px 16px;
    border-bottom: 1px solid #f7fafc;
    &.unread {
      background: #ebf8ff;
    }

    .notif-title {
      font-weight: 600;
      font-size: 0.875rem;
      margin-bottom: 2px;
    }
    .notif-message {
      font-size: 0.8rem;
      color: #4a5568;
      margin-bottom: 4px;
    }
    .notif-time {
      font-size: 0.7rem;
      color: #a0aec0;
    }
  }
}
```

Add `<app-notification-center />` to the navigation area of the app shell (the header or `AppComponent` template). Import `NotificationCenterComponent` in that component's `imports` array. Wrap the trigger element with `position: relative` so the panel anchors correctly.

---

### Step 10: Wire `uploadProgress` in `FavoritesComponent` (1 hour)

Inject `SocketService` into `FavoritesComponent` and subscribe in `ngOnInit`:

```typescript
ngOnInit(): void {
  this.loadFavorites(); // existing

  this.socketService
    .on<{ fileId: string; percent: number }>('upload-progress')
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(({ fileId, percent }) =>
      this.uploadProgress.update((p) => ({ ...p, [fileId]: percent })),
    );

  this.socketService
    .on<{ fileId: string }>('upload-complete')
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(({ fileId }) =>
      this.uploadProgress.update((p) => {
        const next = { ...p };
        delete next[fileId];
        return next;
      }),
    );

  this.socketService
    .on<{ fileId: string; error: string }>('upload-error')
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(({ fileId, error }) => {
      this.uploadProgress.update((p) => {
        const next = { ...p };
        delete next[fileId];
        return next;
      });
      this.notificationService.show(`Błąd przesyłania: ${error}`);
    });
}
```

The progress bar template was already written in Phase 2.1 and is wired to `uploadProgress` signal — no template changes needed.

---

### Step 11: Docker Compose — `notification-service` + env vars (45 min)

`infrastructure/docker-compose.yml`:

```yaml
notification-service:
  build:
    context: ..
    dockerfile: apps/notification-service/Dockerfile
  container_name: notification-service
  environment:
    PORT: 3006
    RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
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
  # Port NOT exposed — only api-gateway connects here
```

Add `NOTIFICATION_SERVICE_URL` to `api-gateway`:

```yaml
api-gateway:
  environment:
    # ... existing vars ...
    NOTIFICATION_SERVICE_URL: http://notification-service:3006
```

Add `RABBITMQ_URL` (for `notifications_queue` publisher) to the services that now need it for the notification client. `favorite-service` already has `RABBITMQ_URL` from Phase 2.1. Verify `suggestion-service` has it; add if missing.

No new ports need to be exposed — `notification-service:3006` is internal only. WebSocket upgrade happens on the existing `api-gateway:3000` port via the `/ws` namespace.

---

### Step 12: Build and verification (2-3 hours)

```bash
# Build all affected projects
pnpm nx run-many --target=build \
  --projects=notification-service,api-gateway,file-service,suggestion-service,favorite-service,frontend

# Rebuild and restart
docker compose -f infrastructure/docker-compose.yml build --no-cache=false \
  notification-service api-gateway file-service suggestion-service favorite-service
docker compose -f infrastructure/docker-compose.yml up -d

# Verify notification-service started and connected to RabbitMQ
docker logs notification-service --tail 30

# Verify api-gateway proxy connected to notification-service
docker logs api-gateway --tail 30 | grep -i "notification"

# Verify notifications_queue exists in RabbitMQ
# Open http://localhost:15672 → Queues tab → confirm notifications_queue present

# Manual browser test:
# 1. Open http://localhost:4200 — log in
# 2. Open DevTools → Network → WS tab
# 3. Verify ws://localhost:3000/ws/socket.io connection → status 101
# 4. Verify 'joined' message received in WS frames after connect
# 5. Navigate to Favorites → upload a file
# 6. Verify upload-progress events in WS frames (percent 0→100)
# 7. Verify progress bar fills in UI and disappears after upload-complete
# 8. Add a new favorite → notification bell badge shows 1
# 9. Get suggestions → badge shows 2
# 10. Click bell → panel shows both entries; badge resets to 0
# 11. Clear notifications → panel shows "Brak powiadomień"
# 12. Log out → socket disconnects; log in again → reconnects with new token
```

---

## Verification Checklist

### notification-service

- [ ] Container starts, registers with Consul as `notification-service`
- [ ] RabbitMQ consumer connected to `notifications_queue` (visible in RabbitMQ management UI)
- [ ] `@WebSocketGateway` listening on port 3006 (internal only)
- [ ] `join { userId }` message → socket joins `user:{userId}` room → `joined` event returned
- [ ] `sendToUser()` emits event to correct room with `userId` in payload

### api-gateway WebSocket Proxy

- [ ] `WebSocketProxyGateway` bound on `/ws` namespace at port 3000
- [ ] `docker logs api-gateway` shows "Connected to notification-service" on startup
- [ ] Frontend client connects → JWT verified → `clientToUserMap` populated
- [ ] Frontend client sends `join` → `userToClientsMap` populated → notification-service `join` forwarded
- [ ] Frontend client disconnects → maps cleaned up
- [ ] Connection rejected when JWT missing → logged "Rejected connection (no token)"
- [ ] Connection rejected when JWT invalid/expired → logged "Rejected connection (invalid token)"

### Upload Progress Flow

- [ ] Upload a file → `upload-progress` events visible in browser DevTools WS frames (ascending percent)
- [ ] Progress bar in `FavoritesComponent` fills as events arrive
- [ ] `upload-complete` event → progress bar removed from UI
- [ ] Upload validation error (`.exe` renamed `.jpg`) → `upload-error` event → toast shown; no progress bar
- [ ] Full message path traceable in logs: `file-service` → RabbitMQ → `notification-service` → `api-gateway` → browser

### Domain Notifications

- [ ] Add a favorite → `favorite-added` event received by frontend within ~200ms
- [ ] Notification bell badge increments to 1
- [ ] Get suggestions → `suggestion-created` event received; badge becomes 2
- [ ] Open notification panel → both entries visible; badge resets to 0 (markAllRead on open)
- [ ] "Wyczyść" button empties the notification list
- [ ] Refreshing the page clears notification history (session-only — expected)

### RabbitMQ `notifications_queue`

- [ ] `notifications_queue` visible in RabbitMQ management UI with `durable: true`
- [ ] All four publishers (`file-service`, `suggestion-service`, `favorite-service`, and the proxy itself) visible as producers in RabbitMQ management
- [ ] `notification-service` visible as the sole consumer
- [ ] Stopping `notification-service` → messages queue up in RabbitMQ → restart → messages delivered

### Frontend

- [ ] `SocketService.connect()` called after login; `disconnect()` called after logout
- [ ] `on()` observables unsubscribe on component destroy (`takeUntilDestroyed`)
- [ ] `NotificationCenterComponent` toggles open/closed on bell click
- [ ] Panel does not overflow viewport on small screens
- [ ] `pnpm nx build frontend` — 0 TypeScript errors
- [ ] All existing frontend tests pass (update mocks in `notification.service.mock.ts` if needed)

### Build

- [ ] `pnpm nx build notification-service` — 0 errors
- [ ] `pnpm nx build api-gateway` — 0 errors
- [ ] `pnpm nx build file-service` — 0 errors
- [ ] `pnpm nx build suggestion-service` — 0 errors
- [ ] `pnpm nx build favorite-service` — 0 errors
- [ ] `pnpm nx build frontend` — 0 errors

---

## Rollback Strategy

```bash
# 1. Revert SocketGateway stub (restore no-op)
git checkout apps/file-service/src/socket/socket.gateway.ts
git checkout apps/file-service/src/app.module.ts  # remove NOTIFICATION_CLIENT ClientsModule

# 2. Remove notification-service
git checkout apps/notification-service/   # or delete if new

# 3. Remove WebSocket module from api-gateway
git checkout apps/api-gateway/src/websocket/
git checkout apps/api-gateway/src/app.module.ts

# 4. Remove notification publishers from suggestion-service and favorite-service
git checkout apps/suggestion-service/src/notification/
git checkout apps/suggestion-service/src/app.module.ts
git checkout apps/favorite-service/src/notification/
git checkout apps/favorite-service/src/app.module.ts

# 5. Revert frontend changes
git checkout apps/frontend/src/app/services/socket.service.ts
git checkout apps/frontend/src/app/services/notification.service.ts
git checkout apps/frontend/src/app/components/notification-center/
git checkout apps/frontend/src/app/components/favorites/favorites.component.ts
git checkout apps/frontend/src/environments/environment.ts

# 6. Revert docker-compose
git checkout infrastructure/docker-compose.yml

docker compose -f infrastructure/docker-compose.yml up -d
```

No database migrations — rollback is code-only. The `notifications_queue` in RabbitMQ will be automatically removed once no service declares it.

---

## Timeline Summary

| Step      | Task                                                                                                                                  | Time                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1         | Install `@nestjs/websockets`, `socket.io` (backend) + `socket.io-client` (frontend)                                                   | 30 min                       |
| 2         | Scaffold `notification-service` — `NotificationWebSocketGateway` + `NotificationController` (RabbitMQ consumers for all event types)  | 2-3 hours                    |
| 3         | `WebSocketProxyGateway` in `api-gateway` — `/ws` namespace, JWT auth, `userToClientsMap`, shared connection to `notification-service` | 2-3 hours                    |
| 4         | Replace `SocketGateway` stub in `file-service` with RabbitMQ publisher; add `ClientsModule` for `notifications_queue`                 | 1 hour                       |
| 5         | `suggestion-service` — `NotificationPublisher` + emit `suggestion-created` after save                                                 | 45 min                       |
| 6         | `favorite-service` — `NotificationPublisher` + emit `favorite-added` after save                                                       | 45 min                       |
| 7         | Frontend `SocketService` — Socket.IO client on `/ws`, JWT in `auth.token`, auto-join on connect                                       | 1-2 hours                    |
| 8         | Enhanced `NotificationService` — `notifications` signal, `unreadCount`, `push`, `markAllRead`, `clear`                                | 1 hour                       |
| 9         | `NotificationCenterComponent` — bell + badge + dropdown panel + wire to `AppComponent`                                                | 2-3 hours                    |
| 10        | Wire `uploadProgress` in `FavoritesComponent` to real Socket.IO events                                                                | 1 hour                       |
| 11        | Docker Compose — add `notification-service`, `NOTIFICATION_SERVICE_URL` env var in `api-gateway`                                      | 45 min                       |
| 12        | Build, Docker rebuild, manual verification                                                                                            | 2-3 hours                    |
| **Total** |                                                                                                                                       | **~15-20 hours (~2-3 days)** |

---

## Notes on Dependencies

- **Phase 2.1 (File Uploads)** — `ProgressDiskStorage` and `FileService` already call `gateway.emitToUser()` on each chunk and on save. Replacing the no-op with the RabbitMQ publisher (Step 4) makes upload progress events flow automatically — no changes to those callers.
- **Phase 3.2 (Secure JWT / httpOnly Cookies)** — when JWTs move to httpOnly cookies, `SocketService.connect(token)` must be updated. With cookies, the browser sends them automatically on the WebSocket handshake (`withCredentials: true` is already set). `WebSocketProxyGateway.handleConnection()` would extract the JWT from `client.handshake.headers.cookie` instead of `client.handshake.auth.token`.
- **Phase 6.2 (Terraform / Horizontal Scaling)** — the proxy pattern works on a single `api-gateway` instance. If `api-gateway` scales horizontally, each replica has its own `userToClientsMap` and own connection to `notification-service`. A user connected to replica A will not receive notifications forwarded by replica B. Fix: add the Socket.IO Redis adapter (`@socket.io/redis-adapter`) to `notification-service` and all gateway replicas — they share rooms via Redis. The `notifications_queue` RabbitMQ path is already correct for multi-instance.
- **Phase 3.6 (ClamAV Virus Scanning)** — after a virus scan rejection, `file-service` should call `gateway.emitToUser(userId, 'upload-error', { fileId, error: 'File rejected by virus scanner' })`. The `upload-error` handler in `FavoritesComponent` (Step 10) already handles this. No changes needed to the notification pipeline.
- **High-frequency upload-progress events** — for files uploaded at high bandwidth, `ProgressDiskStorage` emits one RabbitMQ message per chunk. If this generates too many messages in production, throttle inside `ProgressDiskStorage`: only call `emitToUser` when `Math.floor(percent / 5)` changes (i.e., every 5% increment). This is a `file-service`-only change, not a notification pipeline change.

---

**Phase 2.2 Status**: Ready to implement
**Next Phase**: Phase 2.3 — Kafka Event Streaming for Analytics

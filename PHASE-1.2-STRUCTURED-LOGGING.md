# Phase 1.2: Structured Logging with Correlation IDs — Implementation Plan

## Overview

Replace the NestJS built-in logger with **Pino** across all five services and introduce a `x-correlation-id` header that flows from the API Gateway through every downstream service. Every log line will carry the correlation ID automatically via **Continuation-Local Storage (CLS)**, making it possible to trace a single user request across service boundaries in any log aggregator (Grafana Loki, Datadog, ELK).

## Scope — Phase 1.2 Only

✅ **In Scope:**

- Install `nestjs-pino`, `nestjs-cls`, and supporting packages
- Create `libs/backend/logger` shared library (mirrors existing `libs/backend/consul`, `metrics`, etc.)
- `LoggerModule.forRoot()` — configures Pino globally per service
- `CorrelationMiddleware` — generates/extracts `x-correlation-id`, stores in CLS
- Update all 5 services to use the new logger
- API Gateway generates correlation ID on every inbound request
- Downstream services extract it from the `x-correlation-id` header
- API Gateway proxy forwards `x-correlation-id` to all upstream calls
- Remove the existing `LoggingMiddleware` in api-gateway (superseded)
- Unit tests for the new library
- `pino-pretty` for human-readable dev output; raw JSON in production

❌ **Out of Scope (Future Phases):**

- Request/response body logging with field masking (Phase 1.3)
- Log aggregation pipeline setup (Loki, ELK, Datadog)
- Log rotation or file transport

## Configuration Decisions

| Decision                | Choice                                                        | Reason                                                                                                  |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Logger library          | **Pino** via `nestjs-pino`                                    | JSON by default, ~5× faster than Winston, first-class NestJS integration                                |
| Request context         | **`nestjs-cls`**                                              | Continuation-Local Storage — propagates correlation ID without threading it through every function call |
| Correlation ID format   | **UUID v4**                                                   | Standard, collision-free, widely recognised                                                             |
| Header name             | **`x-correlation-id`**                                        | Industry convention; already reserved in CORS `allowedHeaders`                                          |
| Dev formatting          | **`pino-pretty`**                                             | Human-readable coloured output locally; stripped in production                                          |
| Sensitive field masking | `authorization`, `password`, `cookie` redacted in serializers | Phase 1.3 will add request body masking                                                                 |
| Lib location            | `libs/backend/logger`                                         | Follows existing `libs/backend/*` pattern                                                               |

## Target Log Format

**Production (JSON to stdout):**

```json
{
  "level": "info",
  "time": "2026-07-07T10:00:00.000Z",
  "service": "auth-service",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "pid": 7,
  "context": "AuthService",
  "msg": "User signed up successfully"
}
```

**Development (pino-pretty):**

```
[10:00:00.000] INFO (auth-service/7): User signed up successfully
    context: "AuthService"
    correlationId: "550e8400-e29b-41d4-a716-446655440000"
```

## Target Library Structure

```
libs/backend/logger/
├── src/
│   ├── lib/
│   │   ├── logger.module.ts         ← DynamicModule: wires nestjs-pino + CLS
│   │   ├── logger.options.ts        ← LoggerModuleOptions interface
│   │   ├── correlation.middleware.ts ← Extracts/generates x-correlation-id → CLS
│   │   ├── logger.module.spec.ts
│   │   └── correlation.middleware.spec.ts
│   └── index.ts                     ← Public API
├── project.json
├── package.json
├── tsconfig.json
├── tsconfig.lib.json
└── tsconfig.spec.json
```

## Implementation Steps

### Step 1: Install Logging Dependencies (20 min)

```bash
npm install nestjs-pino pino-http nestjs-cls uuid
npm install --save-dev pino-pretty @types/uuid
```

| Package       | Role                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `nestjs-pino` | NestJS wrapper for Pino — provides `Logger` implementing `LoggerService`                                         |
| `pino-http`   | HTTP request logging integration (used internally by `nestjs-pino`)                                              |
| `nestjs-cls`  | Continuation-Local Storage — stores correlation ID in request scope (package is `nestjs-cls`, not `@nestjs/cls`) |
| `uuid`        | UUID v4 generation for correlation IDs                                                                           |
| `pino-pretty` | Dev-only formatter (devDependency)                                                                               |

### Step 2: Scaffold `libs/backend/logger` (30 min)

**`libs/backend/logger/project.json`:**

```json
{
  "name": "logger",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/backend/logger/src",
  "projectType": "library",
  "tags": [],
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/libs/backend/logger"],
      "options": {
        "jestConfig": "libs/backend/logger/jest.config.js"
      }
    },
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/backend/logger",
        "tsConfig": "libs/backend/logger/tsconfig.lib.json",
        "packageJson": "libs/backend/logger/package.json",
        "main": "libs/backend/logger/src/index.ts",
        "assets": ["libs/backend/logger/*.md"]
      }
    }
  }
}
```

**`libs/backend/logger/package.json`:**

```json
{
  "name": "@suggestify/backend/logger",
  "version": "0.0.1",
  "peerDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0"
  }
}
```

**`libs/backend/logger/tsconfig.json`** — copy structure from `libs/backend/consul/tsconfig.json`, updating paths to `logger`.

**`libs/backend/logger/tsconfig.lib.json`** and **`tsconfig.spec.json`** — same pattern as the consul lib.

**`libs/backend/logger/jest.config.js`** — copy from `libs/backend/consul/jest.config.js`, update `displayName` and `rootDir`.

### Step 3: Implement `logger.options.ts` (10 min)

**`libs/backend/logger/src/lib/logger.options.ts`:**

```typescript
export interface LoggerModuleOptions {
  serviceName: string;
}
```

### Step 4: Implement `correlation.middleware.ts` (30 min)

**`libs/backend/logger/src/lib/correlation.middleware.ts`:**

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const CORRELATION_ID_KEY = 'correlationId';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) || uuidv4();

    this.cls.set(CORRELATION_ID_KEY, correlationId);
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
```

**Key behaviours:**

- If the incoming request already has `x-correlation-id` (forwarded from api-gateway), preserve it.
- If absent (direct calls, or api-gateway itself), generate a new UUID v4.
- Echo the correlation ID back in the response header so clients can trace requests.

### Step 5: Implement `logger.module.ts` (1 hour)

**`libs/backend/logger/src/lib/logger.module.ts`:**

```typescript
import {
  DynamicModule,
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ClsModule, ClsService } from 'nestjs-cls';
import {
  CorrelationMiddleware,
  CORRELATION_ID_KEY,
} from './correlation.middleware';
import { LoggerModuleOptions } from './logger.options';

export const LOGGER_OPTIONS = Symbol('LOGGER_OPTIONS');

@Global()
@Module({})
export class LoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }

  static forRoot(options: LoggerModuleOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        ClsModule.forRoot({ middleware: { mount: false } }),

        PinoLoggerModule.forRootAsync({
          useFactory: (cls: ClsService) => ({
            pinoHttp: {
              level:
                process.env['NODE_ENV'] !== 'production' ? 'debug' : 'info',
              transport:
                process.env['NODE_ENV'] !== 'production'
                  ? {
                      target: 'pino-pretty',
                      options: { colorize: true, singleLine: true },
                    }
                  : undefined,
              serializers: {
                req: (req) => ({
                  method: req.method,
                  url: req.url,
                }),
                res: (res) => ({ statusCode: res.statusCode }),
              },
              redact: {
                paths: ['req.headers.authorization', 'req.headers.cookie'],
                censor: '[REDACTED]',
              },
              mixin: () => ({
                service: options.serviceName,
                correlationId: cls.get(CORRELATION_ID_KEY),
              }),
            },
          }),
          inject: [ClsService],
        }),
      ],
      providers: [
        { provide: LOGGER_OPTIONS, useValue: options },
        CorrelationMiddleware,
      ],
      exports: [ClsModule],
    };
  }
}
```

**Notes:**

- `ClsModule.forRoot({ middleware: { mount: false } })` — CLS setup without auto-mounting its own middleware; our `CorrelationMiddleware` handles mounting via `configure()`.
- `mixin` — called on every log statement; pulls `correlationId` from the active CLS context and injects it into the log record.
- `redact` — strips `authorization` and `cookie` headers from logged request objects.
- `@Global()` — makes the module available everywhere without re-importing.

### Step 6: Update `index.ts` Public API (5 min)

**`libs/backend/logger/src/index.ts`:**

```typescript
export { LoggerModule } from './lib/logger.module';
export { LoggerModuleOptions } from './lib/logger.options';
export {
  CorrelationMiddleware,
  CORRELATION_ID_KEY,
  CORRELATION_ID_HEADER,
} from './lib/correlation.middleware';
```

### Step 7: Register Path Mapping in `tsconfig.base.json` (5 min)

Add to the `paths` object:

```json
"@suggestify/backend/logger": ["./libs/backend/logger/src/index.ts"]
```

### Step 8: Update All Five Services — `app.module.ts` (45 min)

For each service (`api-gateway`, `auth-service`, `suggestion-service`, `history-service`, `favorite-service`), add the import and register the module.

**Pattern (example for `auth-service`):**

```typescript
import { LoggerModule } from '@suggestify/backend/logger';

@Module({
  imports: [
    // ... existing imports ...
    LoggerModule.forRoot({ serviceName: 'auth-service' }),
  ],
})
export class AppModule {}
```

Service name values:

| Service              | `serviceName`          |
| -------------------- | ---------------------- |
| `api-gateway`        | `'api-gateway'`        |
| `auth-service`       | `'auth-service'`       |
| `suggestion-service` | `'suggestion-service'` |
| `history-service`    | `'history-service'`    |
| `favorite-service`   | `'favorite-service'`   |

### Step 9: Update All Five Services — `main.ts` (30 min)

`nestjs-pino` requires two changes in `main.ts`:

- `bufferLogs: true` — captures logs emitted during bootstrap before Pino is initialised.
- `app.useLogger(app.get(Logger))` — replaces NestJS's default logger with Pino.

**Pattern:**

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // ... rest of existing bootstrap code (helmet, cors, pipes, etc.) ...

  await app.listen(PORT);
}

bootstrap();
```

The `new Logger('BootstrapContext')` calls in the existing `main.ts` files should be removed — Pino is now the logger.

### Step 10: Forward `x-correlation-id` in API Gateway Proxy (30 min)

The proxy service currently builds headers for upstream calls. Add `x-correlation-id` from the incoming request:

**`apps/api-gateway/src/proxy/proxy.service.ts`** — update the `headers` block in `forward()`:

```typescript
// Add ClsService to constructor
constructor(
  private readonly httpService: HttpService,
  private readonly consulService: ConsulService,
  private readonly circuitBreaker: CircuitBreakerService,
  private readonly cls: ClsService,
  @Inject(CACHE_MANAGER) private cacheManager: Cache,
) {}

// In forward(), update the headers object:
const headers = {
  ...this.filterHeaders(req.headers),
  'cache-control': 'no-cache, no-store, must-revalidate',
  pragma: 'no-cache',
  'x-correlation-id': this.cls.get(CORRELATION_ID_KEY) ?? '',
};
```

Import `ClsService` from `nestjs-cls` and `CORRELATION_ID_KEY` from `@suggestify/backend/logger`.

This ensures every proxied request to auth-service, suggestion-service, history-service, and favorite-service carries the same correlation ID as the original inbound request.

### Step 11: Remove the Old `LoggingMiddleware` from API Gateway (15 min)

`apps/api-gateway/src/middleware/logging.middleware.ts` logs `METHOD URL STATUS DURATION` using the NestJS built-in logger. `nestjs-pino`'s `pino-http` integration does this automatically (with the correlation ID included), so the old middleware is now redundant.

1. Delete `apps/api-gateway/src/middleware/logging.middleware.ts`
2. Delete `apps/api-gateway/src/middleware/logging.middleware.spec.ts`
3. Remove `LoggingMiddleware` from wherever it is registered in `apps/api-gateway/src/app.module.ts`

### Step 12: RabbitMQ Cleanup + Correlation ID Propagation (1 hour)

All RabbitMQ work in suggestion-service's `main.ts` is done in one step: remove the dead listener first, then wire correlation IDs through the two live message flows.

**12a — Remove dead `suggestion_queue` from suggestion-service**

Suggestion-service connects to `suggestion_queue` in `main.ts` and calls `startAllMicroservices()`, but there is not a single `@MessagePattern` or `@EventPattern` decorator anywhere in suggestion-service, and no other service publishes to this queue. It opens a live RabbitMQ connection and declares a durable queue on every startup for nothing.

Changes to `apps/suggestion-service/src/main.ts`:

1. Remove the `connectMicroservice()` block for `suggestion_queue`
2. Remove `await app.startAllMicroservices()` — suggestion-service has no other microservice transports
3. Remove the now-unused `MicroserviceOptions`, `Transport` imports and `rabbitMQUrl` variable

```typescript
// Remove entirely:
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

// Remove entirely:
const rabbitMQUrl = process.env.RABBITMQ_URL;
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.RMQ,
  options: {
    urls: [rabbitMQUrl],
    queue: 'suggestion_queue',
    queueOptions: { durable: true },
  },
});
await app.startAllMicroservices();
```

Note: the `ClientsModule.registerAsync` for `HISTORY_SERVICE` in `suggestion.module.ts` is **not** touched — it is the outbound publisher for `suggestion_created` events and is still needed.

**12b — Sender side: include `correlationId` in payload**

Two active RabbitMQ patterns must carry the correlation ID through their payloads so that consuming services can restore the CLS context and include it in their logs:

| Publisher                    | Pattern                           | Consumer        |
| ---------------------------- | --------------------------------- | --------------- |
| API Gateway `AuthMiddleware` | `send({ cmd: 'validate_token' })` | Auth Service    |
| Suggestion Service           | `emit('suggestion_created')`      | History Service |

`apps/api-gateway/src/middleware/auth.middleware.ts` — inject `ClsService` and add the ID to the send payload:

```typescript
constructor(
  @Inject('AUTH_SERVICE') private authClient: ClientProxy,
  private readonly cls: ClsService,
) {}

// In use():
const result = await firstValueFrom(
  this.authClient.send(
    { cmd: 'validate_token' },
    { token, correlationId: this.cls.get(CORRELATION_ID_KEY) },
  ),
);
```

`apps/suggestion-service/src/suggestion/suggestion.service.ts` — inject `ClsService` and add the ID to the emit payload:

```typescript
this.historyClient.emit('suggestion_created', {
  userId,
  criteria: dto.criteria,
  suggestions: items.map(...),
  timestamp: suggestion.recommendedAt.toISOString(),
  correlationId: this.cls.get(CORRELATION_ID_KEY),
})
```

**12c — Receiver side: restore CLS context with `cls.run()`**

RabbitMQ message handlers have no HTTP context, so there is no CLS store active. `cls.run()` creates one for the duration of the handler.

`apps/auth-service/src/auth/auth.controller.ts`:

```typescript
@MessagePattern({ cmd: 'validate_token' })
async validateToken(
  @Payload() data: { token: string; correlationId?: string },
) {
  return this.cls.run(async () => {
    if (data.correlationId) {
      this.cls.set(CORRELATION_ID_KEY, data.correlationId);
    }
    return this.authService.validateToken(data.token);
  });
}
```

`apps/history-service/src/history/history.controller.ts`:

```typescript
@EventPattern('suggestion_created')
async handleSuggestionCreated(
  @Payload() data: { userId: string; criteria: any; suggestions: any[]; timestamp: string; correlationId?: string },
) {
  await this.cls.run(async () => {
    if (data.correlationId) {
      this.cls.set(CORRELATION_ID_KEY, data.correlationId);
    }
    return this.historyService.createHistoryEntry(data);
  });
}
```

`ClsService` is available in both services via the global `LoggerModule`. Import `CORRELATION_ID_KEY` from `@suggestify/backend/logger`.

After this step, a single user request produces correlated logs in api-gateway → suggestion-service → history-service (for suggestion flow) and api-gateway → auth-service (for every token validation).

### Step 13: Unit Tests for the Logger Library (1.5 hours)

**`libs/backend/logger/src/lib/correlation.middleware.spec.ts`:**

Test cases:

- Uses existing `x-correlation-id` header if present (does not overwrite)
- Generates a new UUID v4 if `x-correlation-id` header is absent
- Sets `x-correlation-id` on the response
- Stores correlation ID in CLS via `cls.set()`

**`libs/backend/logger/src/lib/logger.module.spec.ts`:**

Test cases:

- `LoggerModule.forRoot()` compiles without error
- `ClsService` is exported and injectable in consuming modules

### Step 14: Verify in Docker (1 hour)

1. **Rebuild affected services:**

   ```bash
   pnpm nx run-many --target=build --projects=api-gateway,auth-service,suggestion-service,history-service,favorite-service
   docker compose build api-gateway auth-service suggestion-service history-service favorite-service
   docker compose up -d
   ```

2. **Make a test request and capture the correlation ID:**

   ```bash
   curl -v http://localhost:3000/v1/health
   # Look for x-correlation-id in response headers
   ```

3. **Verify the ID appears in all service logs:**

   ```bash
   docker logs api-gateway 2>&1 | grep "<correlation-id>"
   docker logs auth-service 2>&1 | grep "<correlation-id>"
   ```

4. **Verify JSON format in production mode:**

   ```bash
   docker logs auth-service 2>&1 | head -5 | python -m json.tool
   # Should parse cleanly as JSON
   ```

5. **Verify dev mode formatting locally:**

   ```bash
   pnpm nx serve auth-service
   # Logs should be coloured, human-readable
   ```

6. **Send a request with a custom correlation ID:**
   ```bash
   curl -H "x-correlation-id: my-test-id-123" http://localhost:3000/v1/health
   # Verify "my-test-id-123" appears in both api-gateway and auth-service logs
   ```

---

## Verification Checklist

### Library

- [ ] `libs/backend/logger` builds: `pnpm nx build logger`
- [ ] Library tests pass: `pnpm nx test logger`
- [ ] `@suggestify/backend/logger` path resolves in all services (no TS errors)

### Correlation ID

- [ ] New UUID generated for requests without `x-correlation-id` header
- [ ] Existing `x-correlation-id` preserved when supplied by caller
- [ ] `x-correlation-id` echoed back in every HTTP response
- [ ] Same correlation ID appears in api-gateway, auth-service, suggestion-service, history-service, favorite-service logs for a single request chain
- [ ] `cls.get(CORRELATION_ID_KEY)` returns the ID in proxy service
- [ ] Auth-service `validate_token` logs carry the same correlation ID as the originating api-gateway request
- [ ] History-service `suggestion_created` handler logs carry the same correlation ID as the originating suggestion-service request

### Structured Logging

- [ ] All log lines are valid JSON in production (no stray text)
- [ ] Every log line includes `service`, `correlationId`, `level`, `time`, `msg`
- [ ] `authorization` and `cookie` headers redacted as `[REDACTED]`
- [ ] `pino-pretty` output in development (`NODE_ENV !== 'production'`)
- [ ] Bootstrap logs (before app starts listening) are captured and formatted

### Cleanup

- [ ] Old `LoggingMiddleware` deleted from api-gateway
- [ ] No remaining `new Logger(...)` from `@nestjs/common` in `main.ts` files
- [ ] All services compile with zero TypeScript errors: `pnpm nx run-many --target=build`

### Tests

- [ ] `correlation.middleware.spec.ts` — all cases pass
- [ ] `logger.module.spec.ts` — module compiles and CLS is injectable

---

## Known Limitations

**`pino-pretty` is a devDependency.**
The Dockerfile's `npm prune --omit=dev` step removes it. The production image will use raw JSON output. Do not add conditional `pino-pretty` requires that could fail in production.

---

## Rollback Strategy

If a service fails to start after the changes:

```bash
# Revert a single service's changes
git restore apps/<service-name>/src/main.ts
git restore apps/<service-name>/src/app.module.ts

# Revert the library entirely
git restore libs/backend/logger/
git restore tsconfig.base.json
```

The services fall back to NestJS built-in logging; no data is lost and no database schema changes are involved.

---

## Files to Create

| File                                                         | Description                     |
| ------------------------------------------------------------ | ------------------------------- |
| `libs/backend/logger/src/lib/logger.options.ts`              | Options interface               |
| `libs/backend/logger/src/lib/correlation.middleware.ts`      | Correlation ID middleware       |
| `libs/backend/logger/src/lib/logger.module.ts`               | DynamicModule wiring Pino + CLS |
| `libs/backend/logger/src/lib/correlation.middleware.spec.ts` | Middleware unit tests           |
| `libs/backend/logger/src/lib/logger.module.spec.ts`          | Module unit tests               |
| `libs/backend/logger/src/index.ts`                           | Public API exports              |
| `libs/backend/logger/project.json`                           | Nx project config               |
| `libs/backend/logger/package.json`                           | Peer dependencies               |
| `libs/backend/logger/tsconfig.json`                          | TS config                       |
| `libs/backend/logger/tsconfig.lib.json`                      | TS config (build)               |
| `libs/backend/logger/tsconfig.spec.json`                     | TS config (tests)               |
| `libs/backend/logger/jest.config.js`                         | Jest config                     |

## Files to Modify

| File                                                           | Change                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                 | Add `nestjs-pino`, `pino-http`, `nestjs-cls`, `uuid` to `dependencies`; `pino-pretty`, `@types/uuid` to `devDependencies` |
| `tsconfig.base.json`                                           | Add `@suggestify/backend/logger` path mapping                                                                             |
| `apps/api-gateway/src/app.module.ts`                           | Import `LoggerModule.forRoot`, remove `LoggingMiddleware`                                                                 |
| `apps/api-gateway/src/main.ts`                                 | `bufferLogs: true` + `app.useLogger(app.get(Logger))`                                                                     |
| `apps/api-gateway/src/proxy/proxy.service.ts`                  | Inject `ClsService`, forward `x-correlation-id` header                                                                    |
| `apps/api-gateway/src/middleware/auth.middleware.ts`           | Inject `ClsService`, include `correlationId` in `validate_token` payload                                                  |
| `apps/auth-service/src/auth/auth.controller.ts`                | Wrap `validate_token` handler in `cls.run()`, extract `correlationId` from payload                                        |
| `apps/suggestion-service/src/suggestion/suggestion.service.ts` | Include `correlationId` in `suggestion_created` emit payload                                                              |
| `apps/history-service/src/history/history.controller.ts`       | Wrap `handleSuggestionCreated` in `cls.run()`, extract `correlationId` from payload                                       |
| `apps/auth-service/src/app.module.ts`                          | Import `LoggerModule.forRoot`                                                                                             |
| `apps/auth-service/src/main.ts`                                | `bufferLogs: true` + `app.useLogger(app.get(Logger))`                                                                     |
| `apps/suggestion-service/src/app.module.ts`                    | Import `LoggerModule.forRoot`                                                                                             |
| `apps/suggestion-service/src/main.ts`                          | Remove dead `suggestion_queue` transport; `bufferLogs: true` + `app.useLogger(app.get(Logger))`                           |
| `apps/history-service/src/app.module.ts`                       | Import `LoggerModule.forRoot`                                                                                             |
| `apps/history-service/src/main.ts`                             | `bufferLogs: true` + `app.useLogger(app.get(Logger))`                                                                     |
| `apps/favorite-service/src/app.module.ts`                      | Import `LoggerModule.forRoot`                                                                                             |
| `apps/favorite-service/src/main.ts`                            | `bufferLogs: true` + `app.useLogger(app.get(Logger))`                                                                     |

## Files to Delete

| File                                                         | Reason                                             |
| ------------------------------------------------------------ | -------------------------------------------------- |
| `apps/api-gateway/src/middleware/logging.middleware.ts`      | Superseded by `pino-http` built into `nestjs-pino` |
| `apps/api-gateway/src/middleware/logging.middleware.spec.ts` | Test for deleted file                              |

---

## Timeline Summary

| Step      | Description                                   | Estimate                 |
| --------- | --------------------------------------------- | ------------------------ |
| 1         | Install logging dependencies                  | 20 min                   |
| 2         | Scaffold `libs/backend/logger` config files   | 30 min                   |
| 3         | Implement `logger.options.ts`                 | 10 min                   |
| 4         | Implement `correlation.middleware.ts`         | 30 min                   |
| 5         | Implement `logger.module.ts`                  | 1 hour                   |
| 6         | Update `index.ts` and `tsconfig.base.json`    | 10 min                   |
| 7         | Register path mapping in `tsconfig.base.json` | 5 min                    |
| 8         | Update all 5 `app.module.ts` files            | 45 min                   |
| 9         | Update all 5 `main.ts` files                  | 30 min                   |
| 10        | Forward correlation ID in api-gateway proxy   | 30 min                   |
| 11        | Remove old `LoggingMiddleware`                | 15 min                   |
| 12        | RabbitMQ cleanup + correlation ID propagation | 1 hour                   |
| 13        | Write unit tests                              | 1.5 hours                |
| 14        | Docker verification                           | 1 hour                   |
| **Total** |                                               | **~8–10 hours (2 days)** |

---

**Phase 1.2 Status**: Ready to implement
**Depends on**: Phase 1.1 complete ✅
**Next Phase**: Phase 1.3 — Request/Response Logging Middleware

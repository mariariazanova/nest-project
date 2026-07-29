# Phase 1.3: Request/Response Logging Middleware — Implementation Plan

## Overview

Extend the Phase 1.2 logging foundation with **request body and response body logging** across all five services. A new `LoggingInterceptor` in `libs/backend/logger` intercepts every HTTP request, masks sensitive fields in both the request body and response payload, and emits a structured audit log entry per request. A companion `maskSensitiveFields` utility handles recursive field redaction. Together they produce a complete per-request audit trail — method, URL, body, response, status code, duration — with passwords and tokens never appearing in plaintext in any log sink.

## Scope — Phase 1.3 Only

✅ **In Scope:**

- `maskSensitiveFields` utility — recursive object traversal that redacts values at sensitive keys
- `LoggingInterceptor` — NestJS interceptor that emits one structured audit log entry per HTTP request
- Register interceptor globally in all 5 services via `APP_INTERCEPTOR` multi-provider inside `LoggerModule.forRoot()` — no per-service code changes required
- Sensitive keys: `password`, `confirmPassword`, `newPassword`, `oldPassword`, `token`, `accessToken`, `refreshToken`, `idToken`, `resetToken`, `secret`, `apiKey`, `privateKey`, `authorization`
- Error path: log method, URL, masked body, error message, and duration on thrown exceptions
- Response truncation at 5 KB to prevent log bloat from list endpoints
- Unit tests for `maskSensitiveFields` and `LoggingInterceptor`
- Docker verification: confirm bodies appear in logs with sensitive fields masked

❌ **Out of Scope (Future Phases):**

- Log aggregation or forwarding pipeline (Loki, ELK, Datadog)
- File upload body logging (multipart/form-data bodies are skipped)
- Per-endpoint or per-service log level overrides
- Sampling or rate-limiting for high-throughput endpoints
- Service-level explicit audit events (`logger.log('user signed in')` in service methods)

## Configuration Decisions

| Decision                      | Choice                                                           | Reason                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Interception layer            | **NestJS `NestInterceptor`**                                     | Full access to request body and response data; testable DI component                                              |
| Logger in interceptor         | **`PinoLogger`** from `nestjs-pino`                              | Proper DI injection; available via `PinoLoggerModule` already imported in `LoggerModule`                          |
| Masking approach              | **Key-based recursive traversal**                                | Simple, predictable, case-insensitive — no regex fragility, no schema dependency                                  |
| Response truncation           | **5 KB limit**                                                   | Prevents megabyte entries from list/suggestion endpoints; original size recorded as `_originalSize`               |
| RabbitMQ handler skipping     | **`context.getType() !== 'http'`**                               | `@MessagePattern` / `@EventPattern` handlers in auth-service and history-service have no HTTP context             |
| Interceptor registration      | **`APP_INTERCEPTOR` multi-provider in `LoggerModule.forRoot()`** | No changes required in individual AppModules; one declaration covers all 5 services                               |
| Relationship to pino-http log | **Separate audit entry alongside pino-http access log**          | pino-http handles transport-level logging (headers, socket timing); interceptor adds application-level body audit |

## Target Log Format

**Successful POST (auth-service, user registers):**

```json
{
  "level": "info",
  "time": "2026-07-08T10:00:00.000Z",
  "service": "auth-service",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "msg": "Request completed",
  "method": "POST",
  "url": "/auth/users",
  "statusCode": 201,
  "duration": 87,
  "body": {
    "username": "alice",
    "email": "alice@example.com",
    "password": "[REDACTED]"
  },
  "response": { "data": { "id": "abc-123", "username": "alice" } }
}
```

**Failed POST (auth-service, wrong password):**

```json
{
  "level": "error",
  "time": "2026-07-08T10:00:00.000Z",
  "service": "auth-service",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "msg": "Request failed",
  "method": "POST",
  "url": "/auth/sessions",
  "duration": 43,
  "body": { "username": "alice", "password": "[REDACTED]" },
  "error": { "message": "Unauthorized", "statusCode": 401 }
}
```

**Successful GET (suggestion-service, large response truncated):**

```json
{
  "level": "info",
  "time": "2026-07-08T10:00:00.000Z",
  "service": "suggestion-service",
  "correlationId": "abc-def-123",
  "msg": "Request completed",
  "method": "GET",
  "url": "/suggestions",
  "statusCode": 200,
  "duration": 120,
  "body": {},
  "response": { "_truncated": true, "_originalSize": 18432 }
}
```

**Note:** `correlationId` appears in all entries automatically via the `mixin` configured in Phase 1.2 — the interceptor does not need to set it explicitly.

## New Library Structure

Two new source files and two new spec files added to `libs/backend/logger`:

```
libs/backend/logger/src/lib/
├── mask-sensitive-fields.ts         ← NEW
├── mask-sensitive-fields.spec.ts    ← NEW
├── logging.interceptor.ts           ← NEW
├── logging.interceptor.spec.ts      ← NEW
├── correlation.middleware.ts        ← unchanged (Phase 1.2)
├── correlation.middleware.spec.ts   ← unchanged (Phase 1.2)
├── logger.module.ts                 ← UPDATED (add interceptor provider)
├── logger.module.spec.ts            ← unchanged (Phase 1.2)
└── logger.options.ts                ← unchanged (Phase 1.2)
```

## Implementation Steps

### Step 1: Implement `maskSensitiveFields` (20 min)

**`libs/backend/logger/src/lib/mask-sensitive-fields.ts`:**

```typescript
const SENSITIVE_KEYS = new Set([
  'password',
  'confirmpassword',
  'newpassword',
  'oldpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'resettoken',
  'secret',
  'apikey',
  'privatekey',
  'authorization',
]);

const MAX_DEPTH = 6;

export function maskSensitiveFields(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveFields(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.has(key.toLowerCase())
      ? '[REDACTED]'
      : maskSensitiveFields(val, depth + 1);
  }
  return result;
}
```

Key behaviours:

- **Case-insensitive**: `password`, `PASSWORD`, `Password` all match
- **Recursive**: traverses nested objects and arrays to any depth up to `MAX_DEPTH`
- **Non-mutating**: returns a new object; the original `req.body` is unchanged
- **Safe**: `null`, `undefined`, and primitive values pass through as-is
- **Depth limit**: stops at 6 levels to prevent stack overflow on deeply nested data

### Step 2: Implement `LoggingInterceptor` (1 hour)

**`libs/backend/logger/src/lib/logging.interceptor.ts`:**

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { maskSensitiveFields } from './mask-sensitive-fields';

const MAX_RESPONSE_BYTES = 5_120; // 5 KB

function truncateResponse(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  try {
    const serialised = JSON.stringify(data);
    if (serialised.length <= MAX_RESPONSE_BYTES) return data;
    return { _truncated: true, _originalSize: serialised.length };
  } catch {
    return { _truncated: true, _originalSize: -1 };
  }
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @InjectPinoLogger(LoggingInterceptor.name)
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap((responseData: unknown) => {
        const response = context.switchToHttp().getResponse<Response>();
        this.logger.info({
          msg: 'Request completed',
          method: request.method,
          url: request.url,
          statusCode: response.statusCode,
          duration: Date.now() - startTime,
          body: maskSensitiveFields(request.body),
          response: truncateResponse(maskSensitiveFields(responseData)),
        });
      }),
      catchError((err: unknown) => {
        const error = err as { message?: string; status?: number };
        this.logger.error({
          msg: 'Request failed',
          method: request.method,
          url: request.url,
          duration: Date.now() - startTime,
          body: maskSensitiveFields(request.body),
          error: {
            message: error.message ?? 'Unknown error',
            statusCode: error.status ?? 500,
          },
        });
        return throwError(() => err);
      }),
    );
  }
}
```

Key notes:

- **`context.getType() !== 'http'`** — skips the `@MessagePattern({ cmd: 'validate_token' })` handler in auth-service and the `@EventPattern('suggestion_created')` handler in history-service. Both services handle HTTP routes and RabbitMQ in the same process; only HTTP routes should produce audit entries.
- **`startTime` before `next.handle()`** — duration captures the entire NestJS handler time including guards, pipes, and service calls.
- **`tap` for success, `catchError` for exceptions** — `catchError` re-throws via `throwError(() => err)` so NestJS exception filters (the 400/500 response formatters) still run normally.
- **`truncateResponse`** — wraps `JSON.stringify` in a try/catch to handle `StreamableFile` and circular objects without crashing the interceptor.
- **`@InjectPinoLogger(LoggingInterceptor.name)`** — creates a child Pino logger with `LoggingInterceptor` as the context, so log entries include `"context": "LoggingInterceptor"` alongside the service name and correlation ID.

### Step 3: Register `LoggingInterceptor` in `LoggerModule.forRoot()` (20 min)

Update **`libs/backend/logger/src/lib/logger.module.ts`** — add two imports and update the `providers` array in `forRoot()`:

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './logging.interceptor';

// Inside forRoot() return value:
providers: [
  { provide: LOGGER_OPTIONS, useValue: options },
  CorrelationMiddleware,
  LoggingInterceptor,
  { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
],
```

**Why this works:** `APP_INTERCEPTOR` is a NestJS globally-scoped multi-provider token (from `@nestjs/core`). Providers registered under this token in any module — including imported ones — are collected at application bootstrap and applied to all request handlers. Because `LoggerModule` is `@Global()` and already imported in all 5 services' `AppModule`, no per-service changes are needed.

`PinoLogger` is available to `LoggingInterceptor` because `PinoLoggerModule.forRootAsync(...)` is in `LoggerModule.forRoot()`'s `imports` array and its providers (including `PinoLogger`) are in scope for all providers declared in the same module.

### Step 4: Update `libs/backend/logger` Public API (5 min)

**`libs/backend/logger/src/index.ts`:**

```typescript
export { LoggerModule } from './lib/logger.module';
export { LoggerModuleOptions } from './lib/logger.options';
export {
  CorrelationMiddleware,
  CORRELATION_ID_KEY,
  CORRELATION_ID_HEADER,
} from './lib/correlation.middleware';
export { LoggingInterceptor } from './lib/logging.interceptor';
export { maskSensitiveFields } from './lib/mask-sensitive-fields';
```

`maskSensitiveFields` is exported so that services can use it in explicit audit logging calls (e.g., `logger.log({ msg: 'User signed in', user: maskSensitiveFields(payload) })`).

### Step 5: Write Unit Tests (1 hour)

**`libs/backend/logger/src/lib/mask-sensitive-fields.spec.ts`** — test cases:

- Returns primitive values (`string`, `number`, `boolean`) unchanged
- Returns `null` and `undefined` unchanged
- Redacts top-level sensitive key (`password`)
- Does not redact non-sensitive key (`username`)
- Redacts nested sensitive key (`user.token`)
- Traverses arrays of objects: `[{ password: 'x' }]` → `[{ password: '[REDACTED]' }]`
- Case-insensitive: `PASSWORD`, `Password`, `passWORD` all → `[REDACTED]`
- Does not mutate the original input object
- Stops at depth limit without throwing

**`libs/backend/logger/src/lib/logging.interceptor.spec.ts`** — test setup:

```typescript
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

function makeContext(overrides: { type?: string; body?: object } = {}) {
  return {
    getType: jest.fn().mockReturnValue(overrides.type ?? 'http'),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        method: 'POST',
        url: '/auth/sessions',
        body: overrides.body ?? { username: 'alice', password: 'secret' },
      }),
      getResponse: jest.fn().mockReturnValue({ statusCode: 200 }),
    }),
  };
}
```

Test cases:

- **Skips non-HTTP context**: `context.getType()` returns `'rmq'` → `logger.info` never called
- **Success path**: calls `logger.info` with `msg: 'Request completed'`, `method`, `url`, `statusCode`, `duration >= 0`, `body` with `password: '[REDACTED]'`, masked `response`
- **Error path**: `next.handle()` throws → calls `logger.error` with `msg: 'Request failed'`, `error.message`, `error.statusCode`
- **Error is re-thrown**: the error propagates out of the observable after logging
- **Large response truncated**: response body > 5 KB → `response: { _truncated: true, _originalSize: N }`
- **Undefined body safe**: `req.body = undefined` → does not throw

### Step 6: Docker Verification (45 min)

1. **Build and restart services:**

   ```bash
   docker compose build api-gateway auth-service suggestion-service history-service favorite-service
   docker compose up -d
   ```

2. **Register a user — confirm password is redacted in logs:**

   ```bash
   curl -s -X POST http://localhost:3000/v1/auth/users \
     -H "Content-Type: application/json" \
     -d '{"username":"logtest","email":"log@test.com","password":"Secret123!"}'

   docker logs auth-service 2>&1 | grep "Request completed" | tail -1
   # Expected: "body": { "password": "[REDACTED]" }
   ```

3. **Login — confirm accessToken is redacted in response log:**

   ```bash
   curl -s -X POST http://localhost:3000/v1/auth/sessions \
     -H "Content-Type: application/json" \
     -d '{"username":"logtest","password":"Secret123!"}'

   docker logs auth-service 2>&1 | grep "Request completed" | tail -1
   # Expected: "response": { "data": { "accessToken": "[REDACTED]" } }
   ```

4. **Bad credentials — confirm error path logging:**

   ```bash
   curl -s -X POST http://localhost:3000/v1/auth/sessions \
     -H "Content-Type: application/json" \
     -d '{"username":"logtest","password":"WrongPass"}'

   docker logs auth-service 2>&1 | grep "Request failed" | tail -1
   # Expected: "error": { "message": "Unauthorized", "statusCode": 401 }
   ```

5. **Suggestion list — confirm large response truncates:**

   ```bash
   TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/sessions \
     -H "Content-Type: application/json" \
     -d '{"username":"logtest","password":"Secret123!"}' | python -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

   curl -s "http://localhost:3000/v1/suggestion?category=books" \
     -H "Authorization: Bearer $TOKEN"

   docker logs suggestion-service 2>&1 | grep "Request completed" | tail -1
   # Check: if payload > 5 KB → "_truncated": true; else full response with masked fields
   ```

6. **Verify correlationId appears in interceptor entries:**

   ```bash
   docker logs auth-service 2>&1 | grep "Request completed" | tail -1
   # Expected: "correlationId" field present alongside "msg": "Request completed"
   ```

7. **Verify RabbitMQ handlers produce no interceptor entries:**

   ```bash
   # The validate_token pattern in auth-service is triggered by every proxied request.
   # Confirm there are no "Request completed" entries with url: undefined or rmq context.
   docker logs auth-service 2>&1 | grep "Request completed" | grep -v '"url"'
   # Expected: no output
   ```

---

## Verification Checklist

### Masking

- [ ] `password` in request body → `[REDACTED]`
- [ ] `accessToken` in response body → `[REDACTED]`
- [ ] Nested sensitive key (`user.token`) → `[REDACTED]`
- [ ] Non-sensitive fields (`username`, `email`, `id`) pass through unchanged
- [ ] `null` or empty body (GET requests) → no crash, `body: {}` or `body: null` in log

### Interceptor

- [ ] `msg: 'Request completed'` logged on every successful HTTP request in all 5 services
- [ ] `msg: 'Request failed'` logged on every thrown exception
- [ ] `duration` present and `>= 0` in all entries
- [ ] `correlationId` present (injected by Phase 1.2 pino mixin — no interceptor code needed)
- [ ] RabbitMQ handlers in auth-service and history-service produce no interceptor entries
- [ ] Response > 5 KB → `{ _truncated: true, _originalSize: N }`
- [ ] Original exception still propagates after error logging (HTTP status codes are correct)

### Tests

- [ ] `mask-sensitive-fields.spec.ts` — all cases pass
- [ ] `logging.interceptor.spec.ts` — all cases pass
- [ ] `npm exec nx test logger` — zero failures
- [ ] `npm exec nx run-many --target=test --all` — all projects still pass

### Build & Lint

- [ ] `npm exec nx build logger` — zero TypeScript errors
- [ ] `npm exec nx run-many --target=build` — all 5 services compile
- [ ] `npm run lint:all` — zero errors

---

## Known Limitations

**Two log entries per HTTP request.** Every HTTP request now produces two Pino entries: the `pino-http` transport-level entry from Phase 1.2 (method, url, status, duration measured from socket) and the interceptor audit entry (body, response, duration measured from NestJS handler). Duration values will differ slightly; the two entries are distinguished by `msg` field (`"request completed"` from pino-http vs `"Request completed"` from the interceptor).

**File upload requests.** For `multipart/form-data` requests (future Phase 2.8 file uploads), `req.body` contains only text fields — uploaded file buffers are in `req.file`/`req.files` and are not logged. This is the correct behavior (binary data in logs is not useful), but it means the body log entry will be incomplete for mixed file+field uploads.

**`StreamableFile` responses.** NestJS `StreamableFile` responses are streams, not plain objects. `JSON.stringify` on them throws — `truncateResponse` catches this and logs `{ _truncated: true, _originalSize: -1 }` instead of crashing the interceptor.

**api-gateway proxy requests.** The `ProxyController` in api-gateway catches all routes and calls `proxy.service.ts` which forwards them via HTTP. The interceptor logs the gateway-side body and response at this layer. The actual upstream service also logs its own body/response — so a full round trip will produce two sets of audit entries, one at the gateway and one at the service.

---

## Rollback Strategy

`LoggingInterceptor` is registered via `APP_INTERCEPTOR` inside `LoggerModule.forRoot()`. To disable body/response audit logging without reverting Phase 1.2:

```typescript
// In libs/backend/logger/src/lib/logger.module.ts, temporarily remove:
// { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }
```

All Phase 1.2 logging (correlation ID, pino-http access logs) remains intact.

---

## Files to Create

| File                                                        | Description                                         |
| ----------------------------------------------------------- | --------------------------------------------------- |
| `libs/backend/logger/src/lib/mask-sensitive-fields.ts`      | Recursive sensitive field masker utility            |
| `libs/backend/logger/src/lib/mask-sensitive-fields.spec.ts` | Unit tests — 9 cases                                |
| `libs/backend/logger/src/lib/logging.interceptor.ts`        | HTTP request/response interceptor with body logging |
| `libs/backend/logger/src/lib/logging.interceptor.spec.ts`   | Unit tests — 7 cases                                |

## Files to Modify

| File                                           | Change                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `libs/backend/logger/src/lib/logger.module.ts` | Import `APP_INTERCEPTOR`; add `LoggingInterceptor` and `APP_INTERCEPTOR` multi-provider to `forRoot()` providers |
| `libs/backend/logger/src/index.ts`             | Export `LoggingInterceptor` and `maskSensitiveFields`                                                            |

---

## Timeline Summary

| Step      | Description                                      | Estimate                                          |
| --------- | ------------------------------------------------ | ------------------------------------------------- |
| 1         | Implement `maskSensitiveFields` utility          | 20 min                                            |
| 2         | Implement `LoggingInterceptor`                   | 1 hour                                            |
| 3         | Register interceptor in `LoggerModule.forRoot()` | 20 min                                            |
| 4         | Update `libs/backend/logger` public API          | 5 min                                             |
| 5         | Write unit tests                                 | 1 hour                                            |
| 6         | Docker verification                              | 45 min                                            |
| **Total** |                                                  | **~3.5 hours (~1 day with review and iteration)** |

---

**Phase 1.3 Status**: Ready to implement
**Depends on**: Phase 1.2 complete ✅
**Next Phase**: Phase 1.4 — Swagger/OpenAPI Documentation

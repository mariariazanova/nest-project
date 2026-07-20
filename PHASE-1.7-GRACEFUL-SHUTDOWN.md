# Phase 1.7: Graceful Shutdown & Circuit Breaker — Implementation Plan

## Overview

Two reliability fixes for production. Enables NestJS graceful shutdown hooks in all 5 services so SIGTERM drains connections cleanly before Docker force-kills the container. Fixes a bug in `CircuitBreakerService` where a new breaker instance is created on every call, preventing failure history from ever accumulating and making the breaker impossible to open.

## Scope

✅ **In Scope:**

- `apps/*/src/main.ts` × 5 — `app.enableShutdownHooks()` added to all 5 bootstrap functions
- `libs/backend/circuit-breaker/src/lib/circuit-breaker.service.ts` — add `Map<string, CircuitBreaker>` instance cache so the same named breaker is reused across calls; add `volumeThreshold: 5` default so the breaker requires at least 5 calls before it can open

❌ **Out of Scope:**

- `onApplicationShutdown()` hooks in individual services — TypeORM, Mongoose, and the RabbitMQ client already implement the interface; NestJS calls them automatically when shutdown hooks are enabled
- Flush logs before exit — `nestjs-pino` writes synchronously to stdout; no explicit flush needed
- Flush metrics before exit — Prometheus is pull-based (scrapes `/metrics` on interval); there is no push buffer to drain
- Consul deregistration on shutdown — `ConsulService` already implements `onModuleDestroy()` which calls `deregisterService()` and clears the health-check interval; no changes needed

## Why This Matters

### Graceful Shutdown

None of the 5 `main.ts` files call `app.enableShutdownHooks()`. When Docker stops a container with SIGTERM (default before SIGKILL after 10 seconds), NestJS ignores the signal and the process is force-killed. This drops in-flight requests, leaves database connections open on the server side, and prevents RabbitMQ consumers from ACKing pending messages cleanly.

`app.enableShutdownHooks()` registers Node.js signal handlers for `SIGTERM` and `SIGINT` that trigger NestJS's `onApplicationShutdown` lifecycle — closing DB connections, draining queue consumers, and flushing logs before the process exits.

### Circuit Breaker Bug

`CircuitBreakerService.execute()` calls `getBreaker(name, action)` on every invocation, and `getBreaker()` creates a `new CircuitBreaker(action, options)` each time. The returned breaker object is not stored anywhere. This means:

1. **No history accumulates** — each request starts with a fresh breaker in CLOSED state with 0 call count.
2. **The breaker can never open** — `errorThresholdPercentage: 50` requires multiple failures to exceed the threshold, but the count resets on every call.
3. **`volumeThreshold` is missing** — Opossum's default `volumeThreshold` is 0, meaning a breaker _could_ open on the first failure if it were reused. Setting `volumeThreshold: 5` requires at least 5 calls before the breaker evaluates the error percentage.

Fix: add a `private readonly breakers = new Map<string, CircuitBreaker>()` and return or create from the map in `getBreaker()`.

---

## Implementation Steps

### Step 1: Graceful Shutdown — all 5 `main.ts` files (20 min)

Add `app.enableShutdownHooks()` to each bootstrap function, **before** `app.listen()`.

Files to update:

- `apps/auth-service/src/main.ts`
- `apps/suggestion-service/src/main.ts`
- `apps/history-service/src/main.ts`
- `apps/favorite-service/src/main.ts`
- `apps/api-gateway/src/main.ts`

In each file, add one line after `app.useLogger(...)` or after the pipe/CORS setup but before `app.listen()`:

```typescript
app.enableShutdownHooks();
```

Example diff for `auth-service/src/main.ts`:

```typescript
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
app.enableShutdownHooks(); // ← add this line

app.useGlobalPipes(
  new ValidationPipe({ ... }),
);
// ... rest unchanged
await app.listen(PORT);
```

Repeat identically for the other 4 services. No other changes to `main.ts` files.

---

### Step 2: Circuit Breaker instance cache (30 min)

**`libs/backend/circuit-breaker/src/lib/circuit-breaker.service.ts`** — two changes:

1. Add `private readonly breakers = new Map<string, CircuitBreaker>()` as a class property.
2. In `getBreaker()`: return from the map if found, otherwise create, store, and return.
3. Add `volumeThreshold: 5` to `defaultOptions` so the breaker requires at least 5 calls before evaluating the error percentage.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
  errorFilter?: (error: any) => boolean;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  getBreaker(
    name: string,
    action: (...args: any[]) => Promise<any>,
    options?: Partial<CircuitBreakerOptions>,
  ): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    this.logger.debug(`Creating circuit breaker: ${name}`);

    const defaultOptions: CircuitBreakerOptions = {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
      volumeThreshold: 5,
      ...options,
      errorFilter:
        options?.errorFilter ??
        ((error: any) => {
          if (error.response?.status) {
            const status = error.response.status;
            if (status >= 400 && status < 500) {
              this.logger.debug(
                `Ignoring 4xx error (${status}) for circuit breaker`,
              );
              return true;
            }
          }
          return false;
        }),
    };

    const breaker = new CircuitBreaker(action, defaultOptions);

    breaker.on('open', () =>
      this.logger.warn(`Circuit breaker ${name} opened`),
    );
    breaker.on('halfOpen', () =>
      this.logger.log(`Circuit breaker ${name} half-open`),
    );
    breaker.on('close', () =>
      this.logger.log(`Circuit breaker ${name} closed`),
    );

    this.breakers.set(name, breaker);
    return breaker;
  }

  async execute<T>(
    name: string,
    action: (...args: any[]) => Promise<T>,
    fallback?: () => T,
    ...args: any[]
  ): Promise<T> {
    const breaker = this.getBreaker(name, action);

    try {
      return (await breaker.fire(...args)) as T;
    } catch (error) {
      this.logger.error(`Circuit breaker ${name} failed:`, error);
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }
}
```

**Note on caching by name vs. action:** The `action` function passed to `getBreaker` on the first call is used for all subsequent calls. If callers pass a different `action` for the same `name`, only the first action is used. This is the expected contract — callers must use unique names per action. The `execute()` helper already follows this: it passes the same `action` and `name` together each time.

---

### Step 3: Build and verification (30 min)

```bash
# TypeScript + lint
npm run lint:all
npx nx run-many --target=build --projects=circuit-breaker

# Verify graceful shutdown
docker stop auth-service
# Should see NestJS shutdown lifecycle log lines before exit, not immediate SIGKILL
docker logs auth-service --tail 10

# Verify circuit breaker
# Log should show "Creating circuit breaker: X" once per named breaker, not on every call
docker logs api-gateway | grep "circuit breaker"
```

---

## Verification Checklist

### Graceful Shutdown

- [ ] `app.enableShutdownHooks()` added to `auth-service/src/main.ts`
- [ ] `app.enableShutdownHooks()` added to `suggestion-service/src/main.ts`
- [ ] `app.enableShutdownHooks()` added to `history-service/src/main.ts`
- [ ] `app.enableShutdownHooks()` added to `favorite-service/src/main.ts`
- [ ] `app.enableShutdownHooks()` added to `api-gateway/src/main.ts`
- [ ] `docker stop <service>` produces NestJS shutdown log lines (not immediate kill)

### Circuit Breaker

- [ ] `CircuitBreakerService` has `private readonly breakers = new Map<string, CircuitBreaker>()`
- [ ] `getBreaker()` returns existing breaker from map if `name` already present
- [ ] `defaultOptions` includes `volumeThreshold: 5`
- [ ] `CircuitBreakerOptions` interface includes `volumeThreshold?: number`
- [ ] "Creating circuit breaker: X" log appears once per unique name (not on every call)
- [ ] `nx build circuit-breaker` — 0 TypeScript errors
- [ ] `nx lint circuit-breaker` — 0 errors

---

## Rollback Strategy

```bash
# Revert graceful shutdown
git checkout apps/auth-service/src/main.ts
git checkout apps/suggestion-service/src/main.ts
git checkout apps/history-service/src/main.ts
git checkout apps/favorite-service/src/main.ts
git checkout apps/api-gateway/src/main.ts

# Revert circuit breaker
git checkout libs/backend/circuit-breaker/src/lib/circuit-breaker.service.ts
```

---

## Timeline Summary

| Step      | Task                                               | Time           |
| --------- | -------------------------------------------------- | -------------- |
| 1         | `app.enableShutdownHooks()` in 5 `main.ts` files   | 20 min         |
| 2         | Circuit breaker instance cache + `volumeThreshold` | 30 min         |
| 3         | Build, lint, Docker verification                   | 30 min         |
| **Total** |                                                    | **~1.5 hours** |

---

**Phase 1.7 Status**: Ready to implement
**Next Phase**: Phase 2 — TBD

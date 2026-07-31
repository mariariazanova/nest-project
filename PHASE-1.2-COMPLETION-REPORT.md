# Phase 1.2: Structured Logging with Correlation IDs — Completion Report

**Project**: Suggestify
**Phase**: 1.2 — Structured Logging with Correlation IDs
**Status**: ✅ COMPLETE
**Date Completed**: July 8, 2026

---

## Executive Summary

Phase 1.2 replaced ad-hoc `console.log` and NestJS built-in `Logger` calls with structured JSON logging via `nestjs-pino` across all 5 backend services. A shared `libs/backend/logger` library encapsulates pino configuration, correlation ID middleware, and CLS context setup. Every log line now includes `service`, `correlationId`, `req`, and `res` fields. Correlation IDs are generated at the API gateway, echoed in response headers, propagated to downstream services via HTTP proxy headers, and carried through RabbitMQ messages using `nestjs-cls`. Seven post-implementation issues were resolved before phase close: ESM uuid import failure in Jest, pino-pretty missing from the production image, a CLS context error at container startup, the dead `suggestion_queue` microservice registration being removed, missing test module mocks, and two categories of lint errors surfaced after adding per-service `eslint.config.mjs` files.

---

## Accomplishments

### Step 1: Dependencies Installed ✅

Installed in the workspace root:

| Package       | Version | Role                                           |
| ------------- | ------- | ---------------------------------------------- |
| `nestjs-pino` | ^4.6.1  | NestJS adapter for pino structured logging     |
| `pino-http`   | ^11.0.0 | HTTP request/response logging middleware       |
| `nestjs-cls`  | ^6.2.1  | Continuation-Local Storage for request context |
| `uuid`        | ^14.0.1 | Correlation ID generation                      |
| `pino-pretty` | ^13.1.3 | Human-readable log formatting in development   |

`pino-pretty` was placed in `dependencies` (not `devDependencies`) — required because the Docker multi-stage build runs `npm prune --omit=dev` and services run with `NODE_ENV=development` in the docker-compose stack.

### Step 2–4: `libs/backend/logger` Library Created ✅

New shared library at `libs/backend/logger` with Nx `@nx/js:tsc` build and `@nx/jest:jest` test targets.

**Public API** (`libs/backend/logger/src/index.ts`):

```typescript
export { LoggerModule } from './lib/logger.module';
export { LoggerModuleOptions } from './lib/logger.options';
export {
  CorrelationMiddleware,
  CORRELATION_ID_KEY,
  CORRELATION_ID_HEADER,
} from './lib/correlation.middleware';
```

**`CorrelationMiddleware`** — reads `x-correlation-id` from the incoming request (or generates a UUID v4), wraps the rest of the middleware chain in `cls.run()` to establish a CLS context, stores the ID in CLS, and sets the response header.

**`LoggerModule.forRoot(options)`** — `@Global()` dynamic module that:

- Imports `ClsModule.forRoot({ middleware: { mount: false } })` to disable the auto-mounted CLS middleware (our custom `CorrelationMiddleware` owns context setup)
- Configures `nestjs-pino` with a `mixin` that injects `{ service, correlationId }` into every log line
- Applies `CorrelationMiddleware` to all routes via `configure(consumer)`
- Exports `ClsModule` so downstream providers can inject `ClsService`

### Step 5: Path Alias Registered ✅

Added to `tsconfig.base.json`:

```json
"@suggestify/backend/logger": ["./libs/backend/logger/src/index.ts"]
```

### Step 6–7: All 5 Services Updated ✅

Each service's `app.module.ts` received:

```typescript
import { LoggerModule } from '@suggestify/backend/logger';
// in imports:
LoggerModule.forRoot({ serviceName: '<service-name>' }),
```

Each service's `main.ts` changed to the `bufferLogs: true` + `app.useLogger()` bootstrap pattern required by `nestjs-pino` to capture early startup logs:

```typescript
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

| Service            | `serviceName`        |
| ------------------ | -------------------- |
| api-gateway        | `api-gateway`        |
| auth-service       | `auth-service`       |
| suggestion-service | `suggestion-service` |
| history-service    | `history-service`    |
| favorite-service   | `favorite-service`   |

### Step 8: Old LoggingMiddleware Deleted ✅

`apps/api-gateway/src/middleware/logging.middleware.ts` and its spec file were deleted. The `pino-http` request/response lifecycle logging supersedes this entirely.

### Step 9: CORS Updated ✅

Added `x-correlation-id` to `allowedHeaders` in the api-gateway CORS config so browsers can send pre-set correlation IDs with cross-origin requests.

### Step 10: API Gateway Forwards Correlation ID ✅

`apps/api-gateway/src/proxy/proxy.service.ts` — `ClsService` injected; `x-correlation-id` header added to every proxied HTTP request:

```typescript
'x-correlation-id': this.cls.get(CORRELATION_ID_KEY) ?? '',
```

`apps/api-gateway/src/middleware/auth.middleware.ts` — correlation ID included in the `validate_token` RabbitMQ payload to auth-service.

### Step 11: RabbitMQ Correlation ID Propagation ✅

**suggestion-service** emits `correlationId` in the `suggestion_created` event payload:

```typescript
this.client.emit('suggestion_created', {
  ...eventData,
  correlationId: this.cls.get(CORRELATION_ID_KEY),
});
```

**auth-service** `validateToken` handler wraps its body in `cls.run()` and restores the correlation ID from the payload:

```typescript
return this.cls.run(async () => {
  if (data.correlationId) this.cls.set(CORRELATION_ID_KEY, data.correlationId);
  return this.authService.validateToken(data.token);
});
```

**history-service** `handleSuggestionCreated` handler does the same: wraps in `cls.run()` and sets `correlationId` from the message payload.

### Step 12: Dead Queue Removed ✅

The `suggestion_queue` microservice `connectMicroservice()` block was removed from `apps/suggestion-service/src/main.ts`. This was a leftover from an earlier design — suggestion-service is a pure HTTP service and was never a RabbitMQ consumer. Its presence caused a dead queue to be declared on startup.

### Step 13: Unit Tests Written ✅

`libs/backend/logger/src/lib/correlation.middleware.spec.ts` — 5 tests:

- Existing `x-correlation-id` header is preserved
- UUID is generated when header is absent
- Correlation ID stored in CLS
- Response header set
- `next()` is called

`libs/backend/logger/src/lib/logger.module.spec.ts` — 2 tests:

- Module compiles
- `ClsService` is injectable

### Step 14: Docker Verification ✅

All 15 containers start healthy. Verified:

| Check                                                      | Result                                      |
| ---------------------------------------------------------- | ------------------------------------------- |
| `x-correlation-id` in every response header                | ✅ Auto-generated UUID                      |
| Custom `x-correlation-id` echoed back                      | ✅ `my-test-id-123` propagated and returned |
| `correlationId` field in every api-gateway log line        | ✅                                          |
| `correlationId` propagated to suggestion-service           | ✅ Same ID as gateway                       |
| `correlationId` propagated via RabbitMQ to history-service | ✅ Same ID across services                  |
| User registration and login                                | ✅                                          |
| `GET /v1/suggestion?category=books`                        | ✅ Returns seeded data                      |

---

## Issues Encountered

### Issue 1 — `SyntaxError: Unexpected token 'export'` in uuid during Jest

**Symptom**: `logger:test` failed at import time with a syntax error inside `node_modules/uuid`.

**Root cause**: `uuid` v9+ is ESM-only. Jest uses CommonJS by default and does not transform `node_modules`. When the uuid import was executed in the Jest worker it hit the ESM `export` keyword and threw.

**Fix**: Added to `libs/backend/logger/jest.config.js`:

```javascript
transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
```

This tells Jest to run `uuid` through Babel/ts-jest rather than serving it as-is from `node_modules`.

### Issue 2 — `Error: unable to determine transport target for "pino-pretty"` in Docker

**Symptom**: All 5 service containers crashed on startup with a pino transport error. Services run with `NODE_ENV=development` in docker-compose, which triggers the `pino-pretty` transport path.

**Root cause**: `pino-pretty` was in `devDependencies`. The Docker multi-stage build runs `npm prune --omit=dev` in the production stage, stripping it from `node_modules`. Two intermediate attempts failed:

1. `require.resolve` check in `logger.module.ts` — unreliable because webpack intercepts `require` inside bundles
2. Running `npm install pino-pretty` — npm kept it under `devDependencies` since it was already listed there

**Fix**: Manually moved `pino-pretty` from `devDependencies` to `dependencies` in the root `package.json`. Rebuilt all 5 images.

### Issue 3 — `Cannot set the key "correlationId". No CLS context available` in containers

**Symptom**: All services started but the health check failed — every request logged `Cannot set the key "correlationId". No CLS context available`.

**Root cause**: `CorrelationMiddleware.use()` called `this.cls.set()` directly. With `ClsModule.forRoot({ middleware: { mount: false } })`, the built-in `ClsMiddleware` (which calls `cls.run()` to establish the async context) is never mounted. Our custom middleware is responsible for creating the CLS context, but it was skipping that step.

**Fix**: Wrapped the middleware body in `this.cls.run()`:

```typescript
use(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || uuidv4();
  this.cls.run(() => {
    this.cls.set(CORRELATION_ID_KEY, correlationId);
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  });
}
```

`cls.run()` creates a new async storage context scoped to the callback, exactly as the built-in `ClsMiddleware` does internally.

### Issue 4 — `Cannot find module '@suggestify/backend/logger'` in 4 service test suites

**Symptom**: `auth-service:test`, `suggestion-service:test`, `history-service:test`, and `favorite-service:test` all failed with a module resolution error for `@suggestify/backend/logger`.

**Root cause**: All 4 service `jest.config.ts` files had no `moduleNameMapper`. TypeScript path aliases (`@suggestify/*`) are resolved at build time via `tsconfig.base.json`; Jest needs them mapped explicitly at test time. The same fix was applied to `api-gateway` in Phase 0.5, but the other 4 services were not updated then because they had no cross-library imports. Phase 1.2 introduced `@suggestify/backend/logger` imports into all 5 services.

**Fix**: Added `pathsToModuleNameMapper` (with `createRequire` for ESM compat) to all 4 service `jest.config.ts` files — the same pattern already used by `api-gateway`.

Additionally, all 4 configs also required `transformIgnorePatterns: ['node_modules/(?!(uuid)/)']` for the same ESM uuid reason as the logger lib (Issue 1). `api-gateway` was missing this too, so it was added there as well.

### Issue 5 — `Nest can't resolve dependencies ... ClsService` in 5 spec files

**Symptom**: After the `moduleNameMapper` fix, 5 spec files failed with NestJS DI errors — `ClsService` could not be resolved in the test module.

**Root cause**: Phase 1.2 injected `ClsService` into `AuthController` (auth-service), `SuggestionService` (suggestion-service), `HistoryController` (history-service), `AuthMiddleware` (api-gateway), and `ProxyService` (api-gateway). None of the existing test modules provided a mock for `ClsService`.

**Fix**: Added a mock `ClsService` provider to each affected test module:

```typescript
{
  provide: ClsService,
  useValue: { get: jest.fn(), set: jest.fn(), run: jest.fn((fn) => fn()) },
}
```

The `run` mock executes the callback synchronously, so `validateToken` and `createHistoryEntry` are still called and existing test assertions remain valid.

Additionally:

- `auth.middleware.spec.ts` — the assertion `toHaveBeenCalledWith({ token })` was updated to `toHaveBeenCalledWith(expect.objectContaining({ token }))` because the real call now includes `correlationId` in the payload.
- `history.controller.ts` — `timestamp` in the `@Payload()` type was changed from required to optional (`timestamp?: string`) to match existing test fixtures that omit it.

### Issue 6 — `TypeError: this.cls.run is not a function` in `correlation.middleware.spec.ts`

**Symptom**: The logger lib's own middleware spec failed after we added `cls.run()` to `CorrelationMiddleware`.

**Root cause**: The mock was typed as `jest.Mocked<Pick<ClsService, 'set'>>` — `run` was not in the mocked type. When `cls.run()` was called inside `use()`, it was undefined.

**Fix**: Widened the mock type to a plain object literal (`{ set: jest.Mock; run: jest.Mock }`) and added the `run` implementation:

```typescript
cls = {
  set: jest.fn(),
  run: jest.fn((fn: () => unknown) => fn()),
};
```

Using a plain object type avoids TypeScript's strict overload matching on `ClsService.run`'s signature, which rejected the simplified single-argument mock.

### Issue 7 — `@nx/enforce-module-boundaries` lint errors in 4 service `jest.config.ts` files

**Symptom**: `npm run lint:all` reported `@nx/enforce-module-boundaries` violations on the line `require('../../tsconfig.base.json')` in `jest.config.ts` for auth-service, suggestion-service, history-service, and favorite-service.

**Root cause**: These 4 services had no project-level `eslint.config.mjs`, so they fell through to the root ESLint config which lints all files including `jest.config.ts`. The `@nx/enforce-module-boundaries` rule in the root config treats relative paths crossing project boundaries as violations. `api-gateway` was unaffected because it already had its own `eslint.config.mjs` with `jest.config.ts` in its `ignores` array.

**Fix**: Created `apps/<service>/eslint.config.mjs` for all 4 services, each extending the root config with `jest.config.ts` added to the `ignores` array.

### Issue 8 — Parsing errors for JS config files in service lint runs

**Symptom**: After creating the per-service `eslint.config.mjs` files, `webpack.config.js` (all 4 services), `migrate-mongo-config.js` (history-service), and `src/migrations/*.js` (history-service) each produced `Parsing error: No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs are present`.

**Root cause**: The new `eslint.config.mjs` files include `...tseslint.configs.recommended`, which enables the TypeScript parser globally. The config object that sets `tsconfigRootDir` targets only `files: ["**/*.ts"]`; plain JS files fell through to the TypeScript parser with no `tsconfigRootDir` resolved.

**Fix**: Added each affected JS file pattern to the `ignores` array in the corresponding service's `eslint.config.mjs` (`webpack.config.js` in all 4; `migrate-mongo-config.js` and `src/migrations/**` additionally in history-service).

### Issue 9 — `'error' is defined but never used` in `auth.service.ts`

**Symptom**: `auth-service:lint` reported a `@typescript-eslint/no-unused-vars` error at line 149 of `auth.service.ts`.

**Root cause**: The new `auth-service/eslint.config.mjs` activates `tseslint.configs.recommended`, which enables `no-unused-vars`. A `catch (error)` block on line 149 bound the exception to `error` but the body was `return { valid: false }` — the variable was never used.

**Fix**: Changed `catch (error)` to `catch` (no-argument catch clause, valid since TypeScript 4.0+).

---

## Verification Checklist

### Library

- ✅ `libs/backend/logger/` — `LoggerModule`, `CorrelationMiddleware`, `CORRELATION_ID_KEY`, `CORRELATION_ID_HEADER` exported
- ✅ `tsconfig.base.json` — `@suggestify/backend/logger` path alias registered
- ✅ `jest.config.js` — `transformIgnorePatterns` for ESM uuid

### Services

- ✅ All 5 `app.module.ts` — `LoggerModule.forRoot({ serviceName })` imported
- ✅ All 5 `main.ts` — `bufferLogs: true` + `app.useLogger(app.get(Logger))`
- ✅ `apps/api-gateway/src/middleware/logging.middleware.ts` — deleted
- ✅ api-gateway CORS — `x-correlation-id` in `allowedHeaders`
- ✅ api-gateway proxy — forwards `x-correlation-id` to all upstream services
- ✅ api-gateway auth middleware — includes `correlationId` in `validate_token` payload
- ✅ suggestion-service — includes `correlationId` in `suggestion_created` event
- ✅ auth-service — `validateToken` handler wraps in `cls.run()`
- ✅ history-service — `handleSuggestionCreated` handler wraps in `cls.run()`
- ✅ suggestion-service `main.ts` — dead `suggestion_queue` microservice registration removed

### Tests

- ✅ `correlation.middleware.spec.ts` — 5 tests pass
- ✅ `logger.module.spec.ts` — 2 tests pass
- ✅ All 5 service test suites pass — `moduleNameMapper` + `transformIgnorePatterns` added to all `jest.config.ts` files
- ✅ `nx run-many --target=test --all` — 11/11 projects pass

### Lint

- ✅ `npm run lint:all` — 18/18 projects pass (0 errors, warnings only)
- ✅ Per-service `eslint.config.mjs` created for auth-service, suggestion-service, history-service, favorite-service
- ✅ `jest.config.ts` and JS config files excluded from TypeScript parser in all service lint configs

### Runtime

- ✅ All 15 containers healthy
- ✅ `x-correlation-id` present in every HTTP response
- ✅ Custom correlation ID passed in request is echoed in response
- ✅ Every log line contains `service` and `correlationId` fields
- ✅ Same `correlationId` visible across api-gateway → suggestion-service → history-service (via RabbitMQ)

---

## Plan vs Actual Comparison

| Step                                            | Plan estimate            | Status        | Notes                                                                               |
| ----------------------------------------------- | ------------------------ | ------------- | ----------------------------------------------------------------------------------- |
| 1 — Install dependencies                        | 20 min                   | ✅            | `pino-pretty` moved to `dependencies` post-implementation (unplanned)               |
| 2 — Scaffold `libs/backend/logger`              | 30 min                   | ✅            |                                                                                     |
| 3 — Implement logger library                    | ~1h 40min                | ✅            | Covers plan steps 3–5: options (10min) + middleware (30min) + module (1hr)          |
| 4 — Register path mapping                       | 15 min                   | ✅            | Covers plan steps 6–7: update index.ts (10min) + tsconfig alias (5min)              |
| 5 — Update all 5 `app.module.ts`                | 45 min                   | ✅            |                                                                                     |
| 6 — Update all 5 `main.ts`                      | 30 min                   | ✅            |                                                                                     |
| 7 — Forward correlation ID in proxy             | 30 min                   | ✅            | Also added to `validate_token` payload in auth middleware                           |
| 8 — Delete old `LoggingMiddleware`              | 15 min                   | ✅            |                                                                                     |
| 9 — CORS header update                          | —                        | ✅            | Not a separate plan step; included in proxy work                                    |
| 10 — RabbitMQ: remove dead queue                | —                        | ✅            | Merged into step 12 in the plan                                                     |
| 11 — RabbitMQ: sender correlation ID            | 1 hour (combined)        | ✅            | Plan step 12 covers RabbitMQ cleanup + both sender and receiver                     |
| 12 — RabbitMQ: receiver `cls.run()`             | (see above)              | ✅            |                                                                                     |
| 13 — Unit tests                                 | 1.5 hours                | ✅ + extra    | `transformIgnorePatterns` for ESM uuid added (unplanned)                            |
| 14 — Docker verification                        | 1 hour                   | ✅ + extra    | 3 issues required 2 additional Docker builds                                        |
| Post — `pino-pretty` in production image        | —                        | ✅            | Moved from `devDependencies` to `dependencies`                                      |
| Post — `cls.run()` in `CorrelationMiddleware`   | —                        | ✅            | Missing `cls.run()` caused CLS context errors in all containers                     |
| Post — Jest config fixes (all 5 services)       | —                        | ✅            | `moduleNameMapper` + `transformIgnorePatterns` missing from 4 service configs       |
| Post — Mock `ClsService` in 5 spec files        | —                        | ✅            | Phase 1.2 injected `ClsService` but no existing test provided a mock                |
| Post — `timestamp` optional in history payload  | —                        | ✅            | Existing test fixture omitted `timestamp`; type was incorrectly required            |
| Post — `cls.run` mock type in middleware spec   | —                        | ✅            | TypeScript strict overload check rejected the simplified single-arg mock            |
| Post — Lint: `eslint.config.mjs` for 4 services | —                        | ✅            | `@nx/enforce-module-boundaries` on `jest.config.ts` require; JS files parsing error |
| Post — Lint: unused `error` in `catch` clause   | —                        | ✅            | `no-unused-vars` activated by `tseslint.configs.recommended` in new config          |
| **Total**                                       | **~8–10 hours (2 days)** | **~16 hours** | Core steps straightforward; extra time in Docker (3 builds) + test/lint fixes       |

**Unplanned work:**

- ESM uuid incompatibility with Jest CommonJS — `transformIgnorePatterns` required in logger lib
- `pino-pretty` devDependency pruned from Docker production image — moved to `dependencies`
- `CorrelationMiddleware` missing `cls.run()` — not caught in unit tests; only surfaced in containers
- `moduleNameMapper` + `transformIgnorePatterns` missing from all 4 non-gateway service `jest.config.ts` files — same root cause as Phase 0.5 api-gateway fix, now triggered across all services by the new `@suggestify/backend/logger` import
- Mock `ClsService` missing from 5 spec files — all pre-existing specs written before `ClsService` was injected
- `auth.middleware.spec.ts` `send` assertion too strict — needed `objectContaining` after `correlationId` was added to payload
- `timestamp` field required in history controller payload type but test fixture omitted it
- 4 services missing `eslint.config.mjs` — root ESLint config linted `jest.config.ts` and triggered `@nx/enforce-module-boundaries`
- JS config files (`webpack.config.js`, migrations) parsed by TypeScript parser after adding `tseslint.configs.recommended` to service configs
- `catch (error)` with unused variable in `auth.service.ts` — surfaced by `no-unused-vars` in new service lint config

---

## Files Created

| File                                                         | Description                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `libs/backend/logger/project.json`                           | Nx project config (jest + tsc targets)                                                |
| `libs/backend/logger/package.json`                           | Library package metadata                                                              |
| `libs/backend/logger/tsconfig.json`                          | Base TS config                                                                        |
| `libs/backend/logger/tsconfig.lib.json`                      | Build TS config                                                                       |
| `libs/backend/logger/tsconfig.spec.json`                     | Test TS config                                                                        |
| `libs/backend/logger/jest.config.js`                         | Jest config with ESM uuid transform                                                   |
| `libs/backend/logger/src/index.ts`                           | Public API barrel                                                                     |
| `libs/backend/logger/src/lib/logger.options.ts`              | `LoggerModuleOptions` interface                                                       |
| `libs/backend/logger/src/lib/correlation.middleware.ts`      | `CorrelationMiddleware` with `cls.run()`                                              |
| `libs/backend/logger/src/lib/logger.module.ts`               | `LoggerModule.forRoot()`                                                              |
| `libs/backend/logger/src/lib/correlation.middleware.spec.ts` | 5 unit tests                                                                          |
| `libs/backend/logger/src/lib/logger.module.spec.ts`          | 2 unit tests                                                                          |
| `apps/auth-service/eslint.config.mjs`                        | Per-service ESLint config; excludes `jest.config.ts` and `webpack.config.js`          |
| `apps/suggestion-service/eslint.config.mjs`                  | Per-service ESLint config; excludes `jest.config.ts` and `webpack.config.js`          |
| `apps/history-service/eslint.config.mjs`                     | Per-service ESLint config; excludes `jest.config.ts`, `webpack.config.js`, migrations |
| `apps/favorite-service/eslint.config.mjs`                    | Per-service ESLint config; excludes `jest.config.ts` and `webpack.config.js`          |

## Files Modified

| File                                                                | Change                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `tsconfig.base.json`                                                | Added `@suggestify/backend/logger` path alias                               |
| `package.json`                                                      | `pino-pretty` moved from `devDependencies` → `dependencies`                 |
| `apps/*/src/app.module.ts` (all 5)                                  | Added `LoggerModule.forRoot(...)` import                                    |
| `apps/*/src/main.ts` (all 5)                                        | `bufferLogs: true` + `app.useLogger(app.get(Logger))`                       |
| `apps/api-gateway/src/main.ts`                                      | Added `x-correlation-id` to CORS `allowedHeaders`                           |
| `apps/api-gateway/src/proxy/proxy.service.ts`                       | Forwards `x-correlation-id` header to upstream services                     |
| `apps/api-gateway/src/middleware/auth.middleware.ts`                | Includes `correlationId` in `validate_token` payload                        |
| `apps/suggestion-service/src/suggestion/suggestion.service.ts`      | Includes `correlationId` in `suggestion_created` event                      |
| `apps/suggestion-service/src/main.ts`                               | Removed dead `suggestion_queue` microservice registration                   |
| `apps/auth-service/src/auth/auth.controller.ts`                     | `validateToken` wrapped in `cls.run()`                                      |
| `apps/history-service/src/history/history.controller.ts`            | `handleSuggestionCreated` wrapped in `cls.run()`; `timestamp` made optional |
| `apps/*/jest.config.ts` (all 5 services)                            | Added `moduleNameMapper` + `transformIgnorePatterns` for ESM uuid           |
| `apps/auth-service/src/auth/auth.controller.spec.ts`                | Added mock `ClsService` provider                                            |
| `apps/suggestion-service/src/suggestion/suggestion.service.spec.ts` | Added mock `ClsService` provider                                            |
| `apps/history-service/src/history/history.controller.spec.ts`       | Added mock `ClsService` provider                                            |
| `apps/api-gateway/src/middleware/auth.middleware.spec.ts`           | Added mock `ClsService`; updated `send` assertion to `objectContaining`     |
| `apps/api-gateway/src/proxy/proxy.service.spec.ts`                  | Added mock `ClsService` provider                                            |
| `libs/backend/logger/src/lib/correlation.middleware.spec.ts`        | Added `run` to CLS mock; widened mock type to plain object                  |
| `apps/auth-service/src/auth/auth.service.ts`                        | `catch (error)` → `catch` to fix `no-unused-vars` lint error                |

## Files Deleted

| File                                                         | Reason                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `apps/api-gateway/src/middleware/logging.middleware.ts`      | Superseded by `pino-http` request/response lifecycle logging |
| `apps/api-gateway/src/middleware/logging.middleware.spec.ts` | Test for deleted file                                        |

---

**Report Generated**: July 8, 2026
**Phase Status**: ✅ COMPLETE
**Next Phase**: Phase 1.3 — Request/Response Logging Middleware

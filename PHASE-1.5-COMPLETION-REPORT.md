# Phase 1.5: API Contract with ts-rest — Completion Report

**Project**: Suggestify
**Phase**: 1.5 — API Contract with ts-rest
**Status**: ✅ COMPLETE
**Date Completed**: July 17, 2026

---

## Executive Summary

Phase 1.5 introduced a shared `@ts-rest/core` contract library (`libs/shared/contract`) that defines all 14 HTTP endpoints across auth, suggestion, favorite, and history services as Zod-validated TypeScript types. The contract serves as the single source of truth for API shapes shared between backend and frontend. All 4 backend controllers implement `NestControllerInterface<typeof authContract>` (using the raw contract type directly — see Issue 12) with `@TsRest({})` as a class-level decorator — TypeScript enforces both method names and exact `{ status: N, body: T }` return shapes at compile time, and `TsRestInterceptor` strips the wrapper before sending the wire response. All Phase 1.4 `@Get/@Post/@Delete`, `@Body()`, `@Headers()`, `@Param()`, `@HttpCode()`, and all Swagger decorators remain exactly as-is. The Angular frontend services replaced `HttpClient` calls with a typed ts-rest client via a custom `HttpClient` adapter. All 6 projects build with 0 TypeScript errors, lint passes with 0 errors, and all 5 test suites pass.

---

## Accomplishments

### Step 1: Install packages ✅

Used the RC release to avoid a Zod peer dependency conflict — stable `3.52.1` declares `zod@^3` as a peer dep, which conflicts with `zod@4.4.3` already in the workspace (from Angular 22). The RC dropped that peer dep.

```bash
npm install @ts-rest/core@3.53.0-rc.1 @ts-rest/nest@3.53.0-rc.1
```

`@ts-rest/angular` does not exist on npm — Angular integration handled in Step 6 via a custom `HttpClient` adapter.

---

### Step 2: Create `libs/shared/contract` Nx library ✅

```bash
npx nx g @nx/js:library contract --directory=libs/shared --importPath=@suggestify/shared/contract --bundler=tsc
```

Removed the scaffolded placeholder `contract.ts` file. Import path `@suggestify/shared/contract` registered automatically in `tsconfig.base.json`.

---

### Step 3: Define Zod schemas and contracts ✅

Created 5 files under `libs/shared/contract/src/lib/`:

| File                     | Contents                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemas.ts`             | `ErrorSchema`, `UserSchema`, `AuthResponseSchema`, `ItemSchema` (`.passthrough()` for TypeORM relations), `FavoriteCategoryEnum`, `FavoriteSchema`, `HistoryEntrySchema` |
| `auth.contract.ts`       | 4 routes: register (POST /auth/users → 201), login (POST /auth/sessions → 200), logout (DELETE /auth/sessions → 200), getProfile (GET /auth/users/me → 200)              |
| `suggestion.contract.ts` | 2 routes: getFiltered (GET /suggestion with optional query params), getOne (GET /suggestion/:category/:id)                                                               |
| `favorite.contract.ts`   | 5 routes: getAll, getById, checkFavorite, add (→ 201), remove (→ 200)                                                                                                    |
| `history.contract.ts`    | 3 routes: getAll, getStats (→ `z.record`), getById                                                                                                                       |

`libs/shared/contract/src/index.ts` exports `contract` (combined router), individual sub-contracts, and all schemas.

Key schema decisions vs the plan:

- `ItemSchema` uses `.passthrough()` — TypeORM entity carries extra relation fields at runtime
- `HistoryEntrySchema` uses `_id: z.string()` — MongoDB document (plan had `id`)
- `logout` response includes `statusCode` — matches actual `auth.service.ts` return
- `criteria` fields in history are single `z.string()` not `z.array` — matches actual Mongoose schema

---

### Step 4: Register `TsRestModule` in backend `AppModule` files ✅

Added `TsRestModule.register({ isGlobal: true })` as the first import in all 4 service app modules:

- `apps/auth-service/src/app.module.ts`
- `apps/suggestion-service/src/app.module.ts`
- `apps/history-service/src/app.module.ts`
- `apps/favorite-service/src/app.module.ts`

---

### Step 5: Bind backend controllers to contract ✅

**Approach evaluated and rejected — `@TsRest(appRoute)` method decorator:** Internally calls `getMethodDecorator(appRoute)` which registers a second NestJS route using the absolute contract path (e.g. `@Post('/auth/users')`), conflicting with the existing `@Post('users')` and causing 404s.

**Intermediate approach evaluated and discarded — custom `TsRestBind` decorator:** Applied `SetMetadata(TsRestAppRouteMetadataKey, route)` + `UseInterceptors(TsRestInterceptor)` without route registration, with controllers returning `{ status: X as const, body: result as any }`. Worked correctly but added unnecessary complexity — `TsRestInterceptor` only sets the HTTP status from the `status` field, which `@HttpCode()` already handles. The wrapping was redundant.

**Intermediate solution — plain returns with `NestControllerInterface<Promise<any>>`:**

- `TsRestBind`, `TsRestInterceptor`, and all `{ status, body }` wrapping removed
- Controllers returned plain values directly: `return this.service.method(...)`
- NestJS used existing `@HttpCode()` decorators for HTTP status codes
- `NestControllerInterface<typeof contract>` with `Promise<any>` return type annotations — enforced only that method names matched contract route keys, not return shapes

**Final solution — strict `{ status, body }` returns with `@TsRest({})` class decorator (Step 8):**

- `@TsRest({})` applied as a CLASS decorator on all 4 controllers — registers `TsRestInterceptor` for every method in the class; interceptor reads `{ status, body }` from the return value, sets the HTTP status code, and sends only `body` as the wire response
- Initially used `const contract = nestControllerContract(historyContract)` wrapper then `NestControllerInterface<typeof contract>` — later removed (see Issue 12); controllers now use `NestControllerInterface<typeof historyContract>` (raw contract type) directly, which enforces the same exact `{ status: N, body: z.infer<ResponseSchema> }` return shapes at compile time
- All methods return `{ status: N as const, body: result }` explicitly
- `@HttpCode()` decorators kept for documentation/Swagger compatibility; `TsRestInterceptor` overrides the status at runtime

**Applied to all 4 controllers:**

- Each controller `implements NestControllerInterface<typeof <serviceName>Contract>` with explicit `{ status, body }` returns
- Methods renamed to match contract keys: `signUp` → `register`, `findFiltered` → `getFiltered`, `findOne` → `getOne`, `getUserHistory` → `getAll`, `getUserStats` → `getStats`, `getHistoryItem` → `getById`, `getUserFavorites` → `getAll`, `getFavoriteById` → `getById`, `addFavorite` → `add`, `removeFavorite` → `remove`
- All Phase 1.4 decorators kept intact on every method:

| Controller                 | Decorators preserved                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `auth.controller.ts`       | `@ApiTags`, `@Post`, `@Get`, `@Delete`, `@HttpCode`, `@UseGuards`, `@ApiBearerAuth`, `@Body`, `@Request`              |
| `suggestion.controller.ts` | `@ApiTags`, `@Get`, `@Query`, `@Headers`, `@Param`, `@ApiHeader`, `@ApiQuery`, `@ApiParam`, cache logic               |
| `history.controller.ts`    | `@ApiTags`, `@Get`, `@Headers`, `@Param`, `@EventPattern`, `@ApiHeader`, `@ApiParam`                                  |
| `favorite.controller.ts`   | `@ApiTags`, `@Get`, `@Post`, `@Delete`, `@Body`, `@Headers`, `@Param`, `@Query`, `@HttpCode`, `@ApiBody`, `@ApiQuery` |

---

### Step 6: Update Angular frontend services to ts-rest client ✅

Created `apps/frontend/src/app/ts-rest-client.ts` — `createTsRestClient()` factory using `initClient()` from `@ts-rest/core`. The `api` callback delegates to Angular's `HttpClient.request()`, preserving the existing `AuthInterceptor` interceptor chain. Response unwraps the `{ data: T }` API gateway envelope before returning to ts-rest.

Updated 4 Angular services:

| Service                         | Old pattern                                         | New pattern                                         |
| ------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `user.service.ts`               | `http.post/delete` + `.map(res => res.data)`        | `this.api.auth.login/register/logout`               |
| `suggestion.service.ts`         | `http.get` + `HttpParams` + `.map(res => res.data)` | `this.api.suggestion.getFiltered`                   |
| `favorite.service.ts`           | `http.get/post/delete` + `.map(res => res.data)`    | `this.api.favorite.getAll/add/remove/checkFavorite` |
| `suggestion-history.service.ts` | `http.get` + `.map(res => res.data)`                | `this.api.history.getAll`                           |

Also added `paths` entry to `apps/frontend/tsconfig.json` — the file does not extend `tsconfig.base.json` so the Nx-registered path was not inherited.

---

### Step 8: Strict return-type enforcement — TS2416 errors found and fixed ✅

After switching to `NestControllerInterface<typeof c>` with real `{ status, body }` shapes, the TypeScript compiler raised TS2416 errors ("Property X in type Y is not assignable to the same property in base type Z") for 3 mismatches between Zod schemas and TypeORM/Mongoose entity types. These were invisible under `Promise<any>` — JSON serialization happened to paper them over at runtime with no compile-time signal.

**Error 1 — `FavoriteEntity.createdAt: Date` not assignable to `string` (3 errors, `favorite.controller.ts`)**

`FavoriteSchema.createdAt` was `z.string()` (output type `string`). TypeORM `@CreateDateColumn()` produces `createdAt: Date`. `NestControllerInterface` expected `body.createdAt: string`; TypeORM gave `Date`.

Fix: Changed `FavoriteSchema.createdAt` to `z.union([z.string(), z.date()])` — output type becomes `string | Date`, so `Date` satisfies the interface.

**Error 2 — `_id` missing from `SuggestionHistory` (2 errors, `history.controller.ts`)**

`HistoryEntrySchema` declared `_id: z.string()`. The Mongoose schema class `SuggestionHistory` has no `_id` property declared in TypeScript — the field exists at runtime via the `Document` intersection but is typed as `ObjectId`, not `string`.

Attempted fix: change service return type to `SuggestionHistoryDocument` (`SuggestionHistory & Document`) — adds `_id: ObjectId`, but `ObjectId` is not assignable to `string`, AND the cache manager returns `SuggestionHistory` (not `SuggestionHistoryDocument`), causing a TS2322 in the service. Reverted.

Final fix: explicit mapping at the controller boundary using `_id: String((h as any)._id)` — converts MongoDB ObjectId to hex string exactly where it crosses the contract surface. Schema stays accurate (`_id: z.string()`); no service changes needed.

**Error 3 — `criteria.category?: string[]` not assignable to `string` (Mongoose schema mismatch)**

The Mongoose `SuggestionHistory` schema class declared `criteria.category?: string[]` (and similarly for `mood`, `genre`, `event`). The suggestion service actually sends single query-param strings; the contract correctly declares `z.string()`. The Mongoose class type was wrong.

Fix: Changed Mongoose schema class `criteria` fields from `string[]` to `string`.

**Error 4 — `HistoryEntry.timestamp: Date` not assignable to `string`**

`HistoryEntrySchema.timestamp` was `z.string()`. Mongoose stores the field as `Date` (via `@Prop()` with `default: Date.now`).

Fix: Changed to `z.union([z.string(), z.date()])` — same pattern as `createdAt`.

**Result:** All 4 services build with 0 TypeScript errors after fixes. The TS2416 errors confirmed the value of strict contract binding: Date/string mismatches that were silently serialized at runtime are now caught at compile time.

---

### Step 9: Named `Status` constants — replace magic numbers ✅

Created `libs/shared/contract/src/lib/status.ts` — a single `as const` object exported from the shared contract library:

```typescript
export const Status = {
  Ok: 200,
  Created: 201,
  NoContent: 204,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  TooManyRequests: 429,
  InternalServerError: 500,
} as const;
```

**Why `as const` object, not a TypeScript enum:** TypeScript enum values have type `EnumName` (e.g. `Status.Ok` has type `Status`), not the numeric literal type `200`. `NestControllerInterface<typeof c>` requires exact numeric literal types in `{ status: 200, body: T }` returns. An `as const` object preserves literal types — `Status.Ok` has type `200` — and IS assignable.

**Computed keys in contracts:** `{ [Status.Ok]: Schema }` — TypeScript preserves the numeric literal type `200` from `Status.Ok` (`as const`); ts-rest type inference is unaffected.

Updated all 4 contract files to use computed `[Status.*]` keys instead of raw numbers. Updated all 4 controllers to use `Status.*` in:

- `{ status: Status.Ok, body: result }` return values
- `@ApiResponse({ status: Status.Created, ... })` decorators

---

### Step 10: Controller code quality — variable rename and comments ✅

**Renamed `c` → `contract`** in all 4 controllers (was `const c = nestControllerContract(...)`). `c` is intentional shorthand only in the DSL builder context (contract files, where `c = initContract()` mirrors `z = zod`); in controller files the variable has no special convention and `contract` is clearer.

**Added comments explaining method name constraint** on `implements NestControllerInterface<typeof *Contract>` in all 4 controllers:

```typescript
// Method names must match the route keys defined in authContract
```

(Note: the intermediate `const contract = nestControllerContract(...)` variable was later removed — see Issue 12. The comment was re-added directly above the class declaration after removal.)

**Added comment on `c = initContract()`** in each contract file:

```typescript
// c is the ts-rest DSL builder — same convention as z for Zod. Used only to call c.router().
const c = initContract();
```

---

### Step 11: Angular `HttpErrorResponse` adapter fix ✅

Angular's `HttpClient` throws `HttpErrorResponse` for ALL non-2xx responses (including 400, 401, 404) even with `observe: 'response'`. Without a catch, these become unhandled exceptions — ts-rest callers receive a thrown error instead of `{ status, body }`.

Added a `try/catch` in `createTsRestClient`'s `api` callback:

```typescript
} catch (err) {
  if (err instanceof HttpErrorResponse) {
    return { status: err.status, body: err.error, headers: new Headers() };
  }
  throw err;
}
```

This converts any Angular-thrown HTTP error into a proper `{ status, body }` return. The `ErrorInterceptor` (Step 12) still receives and re-throws the `HttpErrorResponse` before this catch fires — the interceptor chain runs in reverse for errors, so the adapter's catch is the last stop.

---

### Step 12: Global Angular error interceptor and notification service ✅

Created `apps/frontend/src/app/services/notification.service.ts` — a `signal<string | null>`-based service with auto-dismiss timer. Created `apps/frontend/src/app/interceptors/error.interceptor.ts` — registered after `HateoasInterceptor` in `app.config.ts`.

**Coverage:**

| Status                   | Action                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| 401                      | `UserService.clearSession()` → `Router.navigate(['/login'])`           |
| 403                      | Toast: "Access denied."                                                |
| 429                      | Toast: "Too many requests — please wait a moment."                     |
| 5xx (≥500)               | Toast: "Something went wrong. Please try again."                       |
| Other 4xx (not 400, 404) | Toast: "Request failed. Please try again."                             |
| 400, 404                 | Skipped — these are contract-defined; callers handle them explicitly   |
| 3xx                      | Not reachable — browser handles redirects transparently before Angular |

Always re-throws so ts-rest callers still receive `{ status, body }` from the adapter's `catch` in Step 11.

Added error banner to `app.component.html` (`@if (notification.message())` block with a dismiss button), `app.component.ts` (`inject(NotificationService)`), and `.error-banner` / `.error-banner__dismiss` styles to `styles.scss`. Added `clearSession()` to `UserService` (used by `ErrorInterceptor` on 401; `logout()` now calls it internally too).

---

### Step 13: Angular environment file stubs created (wiring deferred to Phase 6.23) 🔄

`apps/frontend/src/environments/environment.ts` and `environment.prod.ts` created with `apiBaseUrl: 'http://localhost:3000/v1'`. Both dev and Docker use the same gateway URL (host port 3000), so the hardcoded default in `createTsRestClient` continues to work.

The remaining wiring (`fileReplacements` in `project.json`, updating `createTsRestClient` to import from `environment.ts`, choosing production URL strategy) is tracked in **ENHANCEMENT-PLAN.md Phase 6.23**.

---

### Step 7: Build, lint, and verification ✅

Fixed `libs/shared/contract/package.json` — the `@nx/dependency-checks` ESLint rule requires packages imported by the library (`@ts-rest/core`, `zod`) to be listed in `dependencies`.

| Check                            | Result                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `nx build auth-service`          | ✅ Success                                                                            |
| `nx build suggestion-service`    | ✅ Success                                                                            |
| `nx build history-service`       | ✅ Success                                                                            |
| `nx build favorite-service`      | ✅ Success                                                                            |
| `nx build frontend`              | ✅ Success (2 pre-existing warnings in untouched files)                               |
| `nx build contract`              | ✅ Success                                                                            |
| `nx run-many -t lint --all`      | ✅ 0 errors across all 19 projects (pre-existing warnings only)                       |
| `nx run auth-service:test`       | ✅ All tests pass                                                                     |
| `nx run suggestion-service:test` | ✅ All tests pass                                                                     |
| `nx run history-service:test`    | ✅ All tests pass                                                                     |
| `nx run favorite-service:test`   | ✅ All tests pass                                                                     |
| `nx run frontend:test`           | ✅ 85 tests pass                                                                      |
| All 5 `main.ts` Swagger setups   | ✅ Unchanged — `DocumentBuilder` + `SwaggerModule.createDocument()` in all 5 services |

---

### Docker build & runtime verification ✅

Fixed `infrastructure/Dockerfile.frontend` (missing `COPY libs ./libs`) then rebuilt all images.

| Check                                   | Result                                                   |
| --------------------------------------- | -------------------------------------------------------- |
| `docker compose up -d --build`          | ✅ All 6 images built; all 15 containers started healthy |
| `GET localhost:3000/api` (Swagger UI)   | ✅ 200 — OpenAPI spec served                             |
| `GET localhost:4200` (Angular frontend) | ✅ 200 — Angular app served by Nginx                     |
| `POST /v1/auth/users` — register        | ✅ 201 — returns `{ user, accessToken }`                 |
| `POST /v1/auth/sessions` — login        | ✅ 200 — returns `{ user, accessToken }`                 |
| `GET /v1/auth/users/me` — profile       | ✅ 200 — returns user object                             |
| `DELETE /v1/auth/sessions` — logout     | ✅ 200 — returns `{ message, statusCode }`               |
| `GET /v1/suggestion?category=books`     | ✅ 200 — returns `{ id, items[] }`                       |
| `GET /v1/history`                       | ✅ 200 — returns array of history entries                |
| `GET /v1/history/stats`                 | ✅ 200 — returns aggregated stats object                 |
| `GET /v1/history/:id`                   | ✅ 200 — returns single history entry                    |
| `POST /v1/favorite` — add               | ✅ 201 — returns created favorite                        |
| `GET /v1/favorite` — list               | ✅ 200 — returns array of favorites                      |
| `GET /v1/favorite/:id`                  | ✅ 200 — returns single favorite                         |
| `GET /v1/favorite/check/:cat/:itemId`   | ✅ 200 — returns `{ isFavorite: true }`                  |
| `DELETE /v1/favorite/:id`               | ✅ 204 — no content                                      |

Note: Individual service Swagger UIs (ports 3001–3004) are not published to the host in the Docker Compose setup — they are accessible only within the Docker network via the api-gateway.

---

## Verification Checklist

### Installation

- ✅ `@ts-rest/core@3.53.0-rc.1` and `@ts-rest/nest@3.53.0-rc.1` in root `package.json`

### Contract library

- ✅ `libs/shared/contract` exists with `project.json` and import path `@suggestify/shared/contract`
- ✅ `schemas.ts` — 7 shared Zod schemas exported
- ✅ `auth.contract.ts` — 4 routes
- ✅ `suggestion.contract.ts` — 2 routes
- ✅ `favorite.contract.ts` — 5 routes
- ✅ `history.contract.ts` — 3 routes
- ✅ `src/index.ts` — `contract`, individual contracts, and schemas all exported

### Backend

- ✅ `TsRestModule.register({ isGlobal: true })` in all 4 `AppModule` imports
- ✅ `AuthController` — `@TsRest({})` class decorator; `implements NestControllerInterface<typeof authContract>`; strict `{ status, body }` returns; all Phase 1.4 decorators + `@MessagePattern` intact
- ✅ `SuggestionController` — `@TsRest({})` class decorator; `implements NestControllerInterface<typeof suggestionContract>`; strict `{ status, body }` returns; cache logic and `generateCacheKey()` preserved
- ✅ `FavoriteController` — `@TsRest({})` class decorator; `implements NestControllerInterface<typeof favoriteContract>`; strict `{ status, body }` returns; `BadRequestException` guards preserved
- ✅ `HistoryController` — `@TsRest({})` class decorator; `implements NestControllerInterface<typeof historyContract>`; strict `{ status, body }` returns with explicit `_id` mapping; `@EventPattern('suggestion_created')` and `ClsService` unchanged
- ✅ All Phase 1.4 Swagger decorators still present on all methods
- ✅ `libs/shared/contract/src/lib/schemas.ts` — `createdAt` and `timestamp` use `z.union([z.string(), z.date()])` to accept TypeORM/Mongoose `Date`
- ✅ `suggestion-history.schema.ts` — `criteria` fields are `string` (not `string[]`) matching actual data and contract

### Phase 1.4 Swagger — unchanged

- ✅ `auth-service/main.ts` — `DocumentBuilder` + `SwaggerModule.createDocument()` unchanged
- ✅ `suggestion-service/main.ts` — unchanged
- ✅ `history-service/main.ts` — unchanged
- ✅ `favorite-service/main.ts` — unchanged
- ✅ `api-gateway/main.ts` — unchanged

### Frontend

- ✅ `ts-rest-client.ts` created — `createTsRestClient()` factory with `HttpClient` adapter; `HttpErrorResponse` try/catch converts 4xx/5xx throws to `{ status, body }` returns
- ✅ `user.service.ts` — uses `this.api.auth.*`; `clearSession()` method added
- ✅ `suggestion.service.ts` — uses `this.api.suggestion.*`
- ✅ `favorite.service.ts` — uses `this.api.favorite.*`
- ✅ `suggestion-history.service.ts` — uses `this.api.history.*`
- ✅ No remaining `this.http.get/post/delete` in the 4 updated services
- ✅ `NotificationService` — `signal<string | null>` with auto-dismiss timer
- ✅ `ErrorInterceptor` — 401 redirect, 403/429/5xx/other-4xx toasts; re-throws for ts-rest adapter
- ✅ Error banner wired in `AppComponent` template and `styles.scss`
- ✅ `ErrorInterceptor` registered in `app.config.ts` after `HateoasInterceptor`

### Status constants

- ✅ `libs/shared/contract/src/lib/status.ts` — `Status` as const object exported from `@suggestify/shared/contract`
- ✅ All 4 contracts use `[Status.*]` computed response keys
- ✅ All 4 controllers use `Status.*` in `{ status, body }` returns and `@ApiResponse` decorators
- ✅ All 4 controllers: `nestControllerContract()` variable removed entirely (see Issue 12); `NestControllerInterface<typeof *Contract>` uses raw contract type; explanatory comment on method-name constraint added above class declaration
- ✅ All 4 contract files: comment on `c = initContract()` DSL convention

### Environment files (partial — wiring deferred)

- ✅ `apps/frontend/src/environments/environment.ts` — dev stub created
- ✅ `apps/frontend/src/environments/environment.prod.ts` — prod stub created
- 🔄 `fileReplacements` in `project.json` and `createTsRestClient` import update deferred to Phase 6.23

---

## Issues Encountered & Root Cause Analysis

### Issue 1: `@TsRest(appRoute)` method decorator causes 404

**Severity**: Runtime failure (fixed)

**Problem**: Using `@TsRest(favoriteContract.getAll)` as a method decorator caused 404 on all decorated routes.

**Root Cause**: Reading `node_modules/@ts-rest/nest/index.cjs.js` revealed that when used as a method decorator, `@TsRest` internally calls `getMethodDecorator(appRoute)` which registers a second NestJS route using the absolute contract path (e.g. `@Post('/auth/users')`). This conflicts with the existing `@Post('users')` registration, resulting in duplicate or mismatched routes.

**Solution**: Attempted fix was a custom `TsRestBind` decorator (`SetMetadata + UseInterceptors(TsRestInterceptor)`) with `{ status, body }` returns. This worked but was later found redundant — `TsRestInterceptor` only sets the HTTP status code from the `status` field, which `@HttpCode()` already handles. Final solution: removed `TsRestBind` and `TsRestInterceptor` entirely, controllers return plain values, `NestControllerInterface` with `Promise<any>` provides compile-time contract enforcement.

---

### Issue 2: `@suggestify/shared/contract` not resolved inside Docker build

**Severity**: Docker build failure (fixed)

**Problem**: `infrastructure/Dockerfile.frontend` was missing `COPY libs ./libs`. The Angular build ran `npx nx build frontend --prod` inside the container but the `libs/` directory was never copied, so `import { contract } from '@suggestify/shared/contract'` could not be resolved.

**Root Cause**: The frontend Dockerfile was written before the `libs/shared/contract` library existed, so the `libs` copy step was never added.

**Solution**: Added `COPY libs ./libs` to `infrastructure/Dockerfile.frontend` after `COPY apps/frontend ./apps/frontend`.

---

### Issue 3: `@suggestify/shared/contract` not resolved in frontend (local build)

**Severity**: Build failure (fixed)

**Problem**: `apps/frontend/tsconfig.json` doesn't extend `../../tsconfig.base.json`, so the `paths` mapping for `@suggestify/shared/contract` (registered by Nx in `tsconfig.base.json`) was not inherited.

**Root Cause**: Angular projects commonly override tsconfig entirely rather than extending the workspace base.

**Solution**: Added explicit `paths` entry directly to `apps/frontend/tsconfig.json`.

---

### Issue 4: `@nx/dependency-checks` lint error on contract library

**Severity**: Lint error (fixed)

**Problem**: `nx lint contract` failed — `@ts-rest/core` and `zod` were missing from `libs/shared/contract/package.json` `dependencies`.

**Root Cause**: The Nx-generated `package.json` only included `tslib`. The `@nx/dependency-checks` rule enforces that all imports in a publishable library are declared.

**Solution**: Added `@ts-rest/core` and `zod` to `dependencies` in the library's `package.json`.

---

### Issue 5: Doubled base URL in ts-rest frontend client

**Severity**: Runtime failure — all frontend requests returned 404

**Problem**: Login and all other API calls failed with URL `http://localhost:3000/v1http://localhost:3000/v1/auth/users`.

**Root Cause**: The custom `api` callback in `ts-rest-client.ts` constructed the URL as `` `${baseUrl}${path}` ``. In `@ts-rest/core`'s `initClient`, the `path` argument passed to the custom `api` callback is already the fully resolved URL (`baseUrl + route path`), not just the route path. Prepending `baseUrl` again doubled it.

**Solution**: Changed URL construction to `const url = path;` — `path` from `initClient` is always the complete URL.

---

### Issue 6: Doubled query string in ts-rest frontend client

**Severity**: Runtime failure — suggestion requests returned no data

**Problem**: Suggestion requests used URL `?category=books&mood=happy?[object%20Object]`, causing the backend to fail to parse query params.

**Root Cause**: Same pattern — `path` already contains encoded query parameters appended by `initClient`. The custom `api` callback was additionally appending `rawQuery` with a second `?`, resulting in `?params?[object Object]`.

**Solution**: Already resolved by using `const url = path;` — query params are included in `path` from `initClient`.

---

### Issue 7: TS2416 — `FavoriteEntity.createdAt: Date` not assignable to `string`

**Severity**: TypeScript compile error (fixed)

**Problem**: After switching to strict `NestControllerInterface<typeof c>`, TypeScript raised 3 TS2416 errors in `favorite.controller.ts` — the return type's `body.createdAt` was `Date` (from TypeORM `@CreateDateColumn()`) but the interface expected `string` (from `FavoriteSchema.createdAt: z.string()`).

**Root Cause**: `z.string()` output type is `string`. TypeORM infers `@CreateDateColumn()` as `Date`. The mismatch was invisible under `Promise<any>` because JSON serialization converts `Date` to ISO string at runtime.

**Solution**: Changed `FavoriteSchema.createdAt` to `z.union([z.string(), z.date()])`. The union output type is `string | Date`, which `Date` satisfies.

---

### Issue 8: TS2416 — `_id` missing / `ObjectId` not assignable to `string` in history controller

**Severity**: TypeScript compile error (fixed)

**Problem**: After switching to strict binding, TypeScript raised 2 TS2416 errors in `history.controller.ts` — `_id` was missing from the `SuggestionHistory` type (Mongoose class declares no `_id`) and Mongoose's runtime `ObjectId` is not assignable to `string`.

**Root Cause**: `NestControllerInterface` expected `body._id: string` (from `HistoryEntrySchema._id: z.string()`). The Mongoose schema class `SuggestionHistory` has no `_id` TypeScript declaration — it exists at runtime via `Document` intersection as `ObjectId`, which TypeScript does not see and which is not assignable to `string`.

**Intermediate attempt**: Changed service return type to `SuggestionHistoryDocument` — added `_id: ObjectId`, but `ObjectId` still not assignable to `string`, and the cache manager returning `SuggestionHistory` caused a TS2322 in the service. Reverted.

**Solution**: Explicit mapping at the controller boundary: `_id: String((h as any)._id)`. Converts ObjectId to hex string at the API surface without changing the service or the schema.

---

### Issue 9: Mongoose `criteria` fields declared as `string[]` but actual data are single strings

**Severity**: TypeScript schema mismatch (fixed)

**Problem**: The Mongoose `SuggestionHistory` class declared `criteria.category?: string[]` (and `mood`, `genre`, `event`). The contract declared `z.string()`. TypeScript raised an error on the mapping because the types conflicted.

**Root Cause**: The suggestion service sends individual query-param strings (`?category=books`), not arrays. The Mongoose class was over-typed. The MongoDB `$unwind` aggregation in `getUserStats` also works correctly on a scalar string, not just arrays.

**Solution**: Changed Mongoose class `criteria` fields from `string[]` to `string` to match the actual data shape and the contract schema.

---

### Issue 10: TS2416 — `HistoryEntry.timestamp: Date` not assignable to `string`

**Severity**: TypeScript compile error (fixed)

**Problem**: After switching to strict binding, TypeScript raised a TS2416 error in `history.controller.ts` — the return body's `timestamp` field was `Date` (Mongoose `@Prop()` with `default: Date.now`) but the interface expected `string` (from `HistoryEntrySchema.timestamp: z.string()`).

**Root Cause**: Same pattern as Issue 7 (`createdAt`). `z.string()` output type is `string`; Mongoose stores date fields as `Date` objects. At runtime, `JSON.stringify` converts `Date` to an ISO string automatically, so the mismatch was never visible before strict contract binding was in place.

**Solution**: Changed `HistoryEntrySchema.timestamp` to `z.union([z.string(), z.date()])` — output type becomes `string | Date`, satisfying the interface while still accurately describing what the wire format produces (a JSON-serialized string).

---

### Issue 11: Angular `HttpClient` throws instead of returning for non-2xx responses

**Severity**: Runtime — all 4xx/5xx API errors became uncaught exceptions in Angular services (fixed)

**Problem**: After ts-rest client integration, any API error (401 on expired token, 404 on missing resource, etc.) threw an unhandled exception rather than returning `{ status, body }`. The ts-rest caller's `if (result.status === Status.Unauthorized)` checks were never reached.

**Root Cause**: Angular `HttpClient.request()` with `observe: 'response'` still throws `HttpErrorResponse` for non-2xx responses — it does NOT return the response object. This differs from `fetch`, where non-2xx responses resolve normally. The ts-rest adapter assumed `lastValueFrom` would resolve with the response for all HTTP statuses.

**Solution**: Wrapped `lastValueFrom` in a `try/catch`. When `err instanceof HttpErrorResponse`, returns `{ status: err.status, body: err.error, headers: new Headers() }`. Any other error (network failure, timeout) is re-thrown. The `ErrorInterceptor` runs before this catch (reverse interceptor order for errors) and re-throws, so the adapter's `catch` always fires on error.

---

### Issue 12: `nestControllerContract` variable unused as a value — ESLint `no-unused-vars` error

**Severity**: Lint error (fixed)

**Problem**: `const contract = nestControllerContract(authContract)` produced an ESLint `@typescript-eslint/no-unused-vars` error — "assigned a value but only used as a type" — in all 4 controllers.

**Root Cause**: `nestControllerContract` is an identity function that returns its argument typed as `T`. At runtime `typeof contract === typeof authContract`. The variable was only referenced in `implements NestControllerInterface<typeof contract>` — a type position, not a value position — so TypeScript never emitted it and ESLint correctly flagged it as unused.

**Solution**: Removed the `nestControllerContract` call and intermediate variable entirely. Changed `implements NestControllerInterface<typeof contract>` to `implements NestControllerInterface<typeof authContract>` (and equivalently for each service's own contract). TypeScript enforces identical constraints; `NestControllerInterface<T>` operates on `AppRouter`, and both `typeof contract` and `typeof authContract` resolve to the same type.

---

### Issue 13: Frontend test suite failures — `readonly group = Group` undefined in tests

**Severity**: Test failure (fixed)

**Problem**: `nx run frontend:test` failed across multiple component spec files. `component.getLabel(Group.MOOD, 'funny')` returned errors because `this.group` was `undefined` inside the component during tests, despite being declared as `readonly group = Group`.

**Root Cause**: `apps/frontend/tsconfig.json` had `target: ES2022` and `experimentalDecorators: true` but no explicit `useDefineForClassFields`. TypeScript defaults `useDefineForClassFields` to `true` for `ES2022` target, switching to native class field semantics (`Object.defineProperty`). This broke Angular's compilation of plain class field initializers in the esbuild + Vitest test pipeline — the field was overwritten to `undefined` after the constructor ran.

**Solution**: Added `"useDefineForClassFields": false` to `apps/frontend/tsconfig.json`. This restores Angular's expected class field behavior (TypeScript's legacy `assign` semantics) in the test environment.

Additional test fixes in this session:

- `recommendations-history.component.spec.ts` rewritten to mock `SuggestionHistoryService` and `FavoriteService` with synchronous `of()` observables (eliminated async `lastValueFrom` timing issues)
- `subject`-based mocks used for optimistic update reversal tests
- All 4 backend service test suites fixed by removing `nestControllerContract` lint errors (Issue 12)

---

## Plan vs Actual Comparison

| Step                                                     | Estimate     | Actual        | Notes                                                                                                                                                       |
| -------------------------------------------------------- | ------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Install packages                                     | 15 min       | ~15 min       | Used `npm`; RC version chosen to resolve Zod peer dep conflict                                                                                              |
| 2 — Create Nx library                                    | 30 min       | ~30 min       | Straightforward                                                                                                                                             |
| 3 — Define Zod schemas and contracts                     | 2 hours      | ~2 hours      | Read actual entity/service files before writing schemas; several corrections vs plan                                                                        |
| 4 — Register TsRestModule                                | 30 min       | ~30 min       | Straightforward                                                                                                                                             |
| 5 — Apply ts-rest to controllers                         | 3 hours      | ~7 hours      | Three approaches iterated: `@TsRest` (404) → `TsRestBind` + `{ status, body }` → plain returns + `NestControllerInterface<Promise<any>>`                    |
| 6 — Update Angular frontend services                     | 2 hours      | ~3 hours      | Custom `HttpClient` adapter; tsconfig path fix; two runtime bugs in `ts-rest-client.ts` (doubled URL, doubled query string)                                 |
| 7 — Build, lint, verification                            | 1 hour       | ~3 hours      | Docker build failures, multiple rebuilds, end-to-end smoke testing, Swagger example values                                                                  |
| 8 — Strict `{ status, body }` enforcement (unplanned)    | —            | ~4 hours      | Upgrade to `nestControllerContract()` + `@TsRest({})` class decorator; diagnose and fix 4 TS2416 errors across favorite and history services; re-verify E2E |
| 9 — Named `Status` constants (unplanned)                 | —            | ~1 hour       | `status.ts` as const object; updated all 4 contracts and all 4 controllers; discovered enum literal-type limitation                                         |
| 10 — Controller rename + comments (unplanned)            | —            | ~0.5 hour     | `c` → `contract` in all controllers; explanatory comments on `NestControllerInterface` and `initContract()` convention                                      |
| 11 — `HttpErrorResponse` adapter fix (unplanned)         | —            | ~0.5 hour     | Added `try/catch` in ts-rest client `api` callback to convert Angular-thrown errors to `{ status, body }`                                                   |
| 12 — Global error interceptor + notification (unplanned) | —            | ~2 hours      | `NotificationService` signal, `ErrorInterceptor` with full 4xx/5xx coverage, error banner in `AppComponent`, `clearSession()` in `UserService`              |
| 13 — Environment file stubs (unplanned, partial)         | —            | ~0.25 hour    | Two stub files created; wiring deferred to Phase 6.23                                                                                                       |
| **Total**                                                | **~9 hours** | **~28 hours** | ~19 hours over estimate                                                                                                                                     |

> **Why it took longer:** The main overrun was Step 5 — the `@ts-rest/nest` RC API behaved differently than documented. Three complete approaches were tried:
>
> 1. **`@TsRest(appRoute)` method decorator** — applied per the ts-rest docs. Failed at runtime with 404 on all decorated routes. Root cause: the decorator internally calls `getMethodDecorator(appRoute)` which registers a second NestJS route using the absolute contract path (e.g. `POST /auth/users`), conflicting with the existing `@Post('users')`. Required reading the compiled `index.cjs.js` to diagnose.
> 2. **Custom `TsRestBind` decorator with `{ status, body }` returns** — bypassed the route registration issue by applying only `SetMetadata(TsRestAppRouteMetadataKey, route)` + `UseInterceptors(TsRestInterceptor)`. Controllers returned `{ status: X as const, body: result as any }` which `TsRestInterceptor` unwrapped at runtime. Worked correctly but introduced manual wrapping on every return statement in every method.
> 3. **Plain returns + `NestControllerInterface<Promise<any>>`** — realised that `TsRestInterceptor`'s only runtime job is setting the HTTP status code from the `{ status }` field, which `@HttpCode()` already handles via NestJS natively. The interceptor and wrapping were removed; each method returned a plain value directly.
> 4. **Strict `{ status, body }` + `@TsRest({})` class decorator + `nestControllerContract()`** (final) — upgraded the binding to enforce return shapes at compile time, not just method names. This was an unplanned step triggered by recognising that `Promise<any>` was giving up the main value of the contract interface. Exposed 4 genuine mismatches between Zod schemas and TypeORM/Mongoose entity types (TS2416 errors) that were invisible at runtime because JSON serialization silently converted `Date` to string.
>
> The frontend bugs (doubled base URL and doubled query string in the custom `api` callback) were not caught until manual testing against a running UI, adding an unplanned debugging cycle. Docker build issues (missing `COPY libs ./libs`, container name conflicts, port exposure via override file) also added time to verification that was assumed to be straightforward.

---

## Files Created

| File                                                      | Description                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `libs/shared/contract/src/lib/schemas.ts`                 | Shared Zod schemas for all 4 services                                                       |
| `libs/shared/contract/src/lib/auth.contract.ts`           | Auth contract — 4 routes                                                                    |
| `libs/shared/contract/src/lib/suggestion.contract.ts`     | Suggestion contract — 2 routes                                                              |
| `libs/shared/contract/src/lib/favorite.contract.ts`       | Favorite contract — 5 routes                                                                |
| `libs/shared/contract/src/lib/history.contract.ts`        | History contract — 3 routes                                                                 |
| `libs/shared/contract/src/lib/status.ts`                  | `Status` as const object — single source of truth for HTTP status codes across all services |
| `apps/frontend/src/app/ts-rest-client.ts`                 | `createTsRestClient()` factory with Angular `HttpClient` adapter                            |
| `apps/frontend/src/app/services/notification.service.ts`  | Signal-based notification service with auto-dismiss timer                                   |
| `apps/frontend/src/app/interceptors/error.interceptor.ts` | Global HTTP error interceptor — 401 redirect, toast for 403/429/5xx/other 4xx               |
| `apps/frontend/src/environments/environment.ts`           | Angular environment file (dev) — `apiBaseUrl: 'http://localhost:3000/v1'`                   |
| `apps/frontend/src/environments/environment.prod.ts`      | Angular environment file (prod stub) — wiring to build system deferred to Phase 6.23        |
| `PHASE-1.5-COMPLETION-REPORT.md`                          | This file                                                                                   |

## Files Modified

| File                                                                    | Change                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/shared/contract/src/index.ts`                                     | Replaced scaffold with contract router exports                                                                                                                                                                                    |
| `libs/shared/contract/package.json`                                     | Added `@ts-rest/core` and `zod` to `dependencies`                                                                                                                                                                                 |
| `apps/frontend/tsconfig.json`                                           | Added `paths` entry for `@suggestify/shared/contract`                                                                                                                                                                             |
| `apps/auth-service/src/app.module.ts`                                   | Added `TsRestModule.register({ isGlobal: true })`                                                                                                                                                                                 |
| `apps/suggestion-service/src/app.module.ts`                             | Added `TsRestModule.register({ isGlobal: true })`                                                                                                                                                                                 |
| `apps/history-service/src/app.module.ts`                                | Added `TsRestModule.register({ isGlobal: true })`                                                                                                                                                                                 |
| `apps/favorite-service/src/app.module.ts`                               | Added `TsRestModule.register({ isGlobal: true })`                                                                                                                                                                                 |
| `infrastructure/Dockerfile.frontend`                                    | Added `COPY libs ./libs` before build step                                                                                                                                                                                        |
| `apps/frontend/src/app/services/user.service.ts`                        | Replaced `HttpClient` calls with ts-rest client                                                                                                                                                                                   |
| `apps/frontend/src/app/services/suggestion.service.ts`                  | Replaced `HttpClient` calls with ts-rest client                                                                                                                                                                                   |
| `apps/frontend/src/app/services/favorite.service.ts`                    | Replaced `HttpClient` calls with ts-rest client                                                                                                                                                                                   |
| `apps/frontend/src/app/services/suggestion-history.service.ts`          | Replaced `HttpClient` calls with ts-rest client                                                                                                                                                                                   |
| `apps/auth-service/src/auth/auth.controller.ts`                         | `@TsRest({})` class decorator; `implements NestControllerInterface<typeof authContract>` (no intermediate variable); strict `{ status, body }` returns; `Status.*` in returns and `@ApiResponse`; method-name comment above class |
| `apps/suggestion-service/src/suggestion/suggestion.controller.ts`       | Same pattern; `NestControllerInterface<typeof suggestionContract>`; `Status.*`                                                                                                                                                    |
| `apps/history-service/src/history/history.controller.ts`                | Same pattern; `NestControllerInterface<typeof historyContract>`; `Status.*`; explicit `_id` mapping; stale `eslint-disable` directives removed                                                                                    |
| `apps/favorite-service/src/favorite/favorite.controller.ts`             | Same pattern; `NestControllerInterface<typeof favoriteContract>`; `Status.*`                                                                                                                                                      |
| `apps/frontend/tsconfig.json`                                           | Added `"useDefineForClassFields": false` (fix for readonly class fields undefined in Vitest/esbuild test pipeline); added `paths` entry for `@suggestify/shared/contract`                                                         |
| `apps/suggestion-service/src/seed.service.ts`                           | Removed 9 stale `eslint-disable-next-line @typescript-eslint/no-explicit-any` directives                                                                                                                                          |
| `apps/history-service/src/history/history.service.ts`                   | Removed 3 stale `eslint-disable-next-line @typescript-eslint/no-explicit-any` directives                                                                                                                                          |
| `apps/auth-service/src/auth/strategies/jwt.strategy.ts`                 | Removed stale `eslint-disable-next-line @typescript-eslint/no-explicit-any` directive                                                                                                                                             |
| `apps/auth-service/src/auth/guards/jwt-auth.guard.spec.ts`              | Removed stale `eslint-disable-next-line @typescript-eslint/no-explicit-any` directive                                                                                                                                             |
| `apps/frontend/src/app/services/suggestion.service.ts`                  | Removed unused `computed` import from `@angular/core`                                                                                                                                                                             |
| `libs/shared/contract/src/lib/favorite.contract.ts`                     | `remove` route response changed from `200: z.object({ message })` to `204: c.noBody()` to match controller; `[Status.*]` computed keys; `import { Status }`                                                                       |
| `libs/shared/contract/src/lib/schemas.ts`                               | `FavoriteSchema.createdAt` and `HistoryEntrySchema.timestamp`: `z.string()` → `z.union([z.string(), z.date()])` to allow TypeORM/Mongoose `Date`                                                                                  |
| `apps/history-service/src/history/schemas/suggestion-history.schema.ts` | `criteria` fields changed from `string[]` to `string` to match actual data and contract schema                                                                                                                                    |
| `apps/frontend/src/app/ts-rest-client.ts`                               | Fixed doubled base URL and doubled query string in custom `api` callback; removed dead `rawQuery` code; added `try/catch` to convert `HttpErrorResponse` to `{ status, body }`                                                    |
| `apps/frontend/src/app/services/user.service.ts`                        | Added `clearSession()` method; `logout()` now delegates to it                                                                                                                                                                     |
| `apps/frontend/src/app/app.component.ts`                                | `inject(NotificationService)`                                                                                                                                                                                                     |
| `apps/frontend/src/app/app.component.html`                              | Error banner with `@if (notification.message())` and dismiss button                                                                                                                                                               |
| `apps/frontend/src/app/app.config.ts`                                   | Registered `ErrorInterceptor` after `HateoasInterceptor`                                                                                                                                                                          |
| `apps/frontend/src/styles.scss`                                         | Added `.error-banner` and `.error-banner__dismiss` styles                                                                                                                                                                         |
| `libs/shared/contract/src/index.ts`                                     | Added `export * from './lib/status'`; added comment on `initContract()` `c` naming convention                                                                                                                                     |
| `libs/shared/contract/src/lib/auth.contract.ts`                         | `[Status.*]` computed response keys; `import { Status }`; comment on `c`                                                                                                                                                          |
| `libs/shared/contract/src/lib/suggestion.contract.ts`                   | `[Status.*]` computed response keys; `import { Status }`; comment on `c`                                                                                                                                                          |
| `libs/shared/contract/src/lib/history.contract.ts`                      | `[Status.*]` computed response keys; `import { Status }`; comment on `c`                                                                                                                                                          |

## Files Deleted

| File                                       | Reason                                                           |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `libs/shared/contract/src/lib/contract.ts` | Nx scaffold placeholder — replaced by per-service contract files |

---

## Findings from End-to-End Verification

### Finding 1: JWT session lost on full-page reload (pre-existing)

Angular `AuthService` stores the JWT only in a class property (in-memory). Any full-page reload (F5, direct URL navigation, browser bookmark) drops the token. All authenticated routes (`/v1/history`, `/v1/favorite`) return 401 silently — the user appears logged out without an error message.

Not caused by Phase 1.5 changes. Now tracked as **ENHANCEMENT-PLAN.md Phase 1.6.5** with an interim fix (persist to `localStorage`) and a note that Phase 3.12 (httpOnly cookies) is the proper permanent solution.

### Finding 2: NG8107 optional-chain warning in history template (pre-existing)

`apps/frontend/src/app/components/recommendations-history/recommendations-history.component.html:16` — `history.suggestions?.length` — the `?.` is flagged as unnecessary because the surrounding `@if` block already guards the non-null case. Pre-existing, harmless dead code. Not introduced by this phase.

### Finding 3: TS2416 as a contract-enforcement signal

The value of upgrading from `Promise<any>` to strict `NestControllerInterface<typeof c>` is confirmed: 4 distinct type mismatches between Zod schemas and entity types were invisible before the binding and only surfaced as compile-time TS2416 errors after it. Without the binding, the `Date`/`string` mismatches were silently papered over by JSON serialization at runtime with no developer signal.

---

**Report Generated**: July 17, 2026
**Phase Status**: ✅ COMPLETE (environment file wiring tracked in Phase 6.23)
**Next Phase**: Phase 1.6 — Development Tools

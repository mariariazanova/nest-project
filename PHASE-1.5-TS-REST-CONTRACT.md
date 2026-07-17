# Phase 1.5: API Contract with ts-rest — Implementation Plan

## Overview

Create a single shared API contract library (`libs/shared/contract`) using `@ts-rest/core` and Zod schemas. The contract defines all endpoints, request/response types, and path params for all four business services — once, shared between backend and frontend. Backend services use the `NestControllerInterface` pattern from `@ts-rest/nest`: standard NestJS route decorators (`@Get`, `@Post`, `@Delete`) stay on the methods, so **all Phase 1.4 Swagger setup is preserved unchanged** — `DocumentBuilder`, `SwaggerModule.createDocument()`, `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiHeader`, `@ApiParam` etc. The Angular frontend services replace `HttpClient` calls with a typed ts-rest Angular client from `@ts-rest/angular`. RabbitMQ handlers (`@MessagePattern`, `@EventPattern`) and NestJS guards (`@UseGuards`) are unaffected.

## Scope

✅ **In Scope:**

- Install `@ts-rest/core@3.53.0-rc.1`, `@ts-rest/nest@3.53.0-rc.1` (`zod` already in workspace as v4.4.3)
- Create `libs/shared/contract` Nx JS library
- Define Zod schemas and ts-rest contracts for all 4 services (14 endpoints total)
- Register `TsRestModule` in all 4 backend `AppModule` files
- Implement `NestControllerInterface` pattern in all 4 business controllers (keeps `@Get/@Post/@Delete` and all Swagger decorators)
- Update all 4 Angular frontend services to use ts-rest's `initClient()` with a custom Angular `HttpClient` adapter (`@ts-rest/angular` does not exist on npm)
- Keep all Phase 1.4 Swagger setup untouched — `DocumentBuilder`, `SwaggerModule.createDocument()`, and all controller/DTO Swagger decorators stay as-is
- Keep existing `AuthInterceptor` (adds `Authorization` and `X-User-Id` headers globally — works because the adapter goes through Angular's `HttpClient`)

❌ **Out of Scope:**

- Replacing `SwaggerModule.createDocument()` with `generateOpenApi()` — Phase 1.4 Swagger spec generation is NOT changed
- HATEOAS link generation (HateoasInterceptor stays but links not added to Zod schemas)
- Streaming responses or file uploads
- GraphQL or WebSocket contracts

## Why This Matters

### Current State

Types are duplicated and unverified across the stack:

```
frontend/interfaces/user.ts      — UserWithoutPassword { id, username }
auth-service/auth.service.ts     — returns { user, accessToken } (no schema)
auth-service/dto/signup.dto.ts   — class-validator decorators (runtime only)
Swagger spec                     — generated from @ApiProperty decorators (no Zod)
```

If the backend changes a field name, TypeScript does not catch it at the frontend. Request bodies are validated server-side only. Response shapes are TypeScript interfaces, not enforced at runtime.

### Target State

```
libs/shared/contract/
├── src/lib/auth.contract.ts        — Zod schemas + ts-rest routes
├── src/lib/suggestion.contract.ts
├── src/lib/favorite.contract.ts
├── src/lib/history.contract.ts
└── src/index.ts                    — combined contract export

Backend:  NestControllerInterface<typeof c> — TypeScript error if return type mismatches contract
Frontend: this.api.auth.login({ body: { username, password } }) — TypeScript error if wrong shape
Swagger:  SwaggerModule.createDocument() — unchanged from Phase 1.4
```

A field name change in the contract = TypeScript error in both backend and frontend simultaneously. Swagger UI is unaffected.

## Contracts to Define

| Contract             | Endpoints                                   | Key schemas                                               |
| -------------------- | ------------------------------------------- | --------------------------------------------------------- |
| `authContract`       | register, login, logout, getProfile         | SignUpSchema, LoginSchema, AuthResponseSchema, UserSchema |
| `suggestionContract` | getFiltered, getOne                         | ItemSchema, SuggestionResponseSchema                      |
| `favoriteContract`   | getAll, getById, checkFavorite, add, remove | FavoriteSchema, CreateFavoriteSchema                      |
| `historyContract`    | getAll, getStats, getById                   | HistoryEntrySchema                                        |

**Note on `X-User-Id` header**: The Angular `AuthInterceptor` already adds `X-User-Id` to every request via Angular's `HTTP_INTERCEPTORS`. The ts-rest Angular client goes through `HttpClient` so interceptors still apply. `X-User-Id` is **not** included in contract header schemas — it is injected transparently. Backend handlers continue to read it via `@Headers('X-User-Id')` as before.

**Note on response format**: The frontend services currently call `.pipe(map((res) => res.data))` suggesting a `{ data: T }` response envelope. Verify during Step 3 whether the backend actually wraps responses. If it does not, Zod schemas should match direct responses and the `.map((res) => res.data)` calls should be removed in Step 6.

---

## Implementation Steps

### Step 1: Install packages (15 min)

Use the RC release — stable `3.52.1` declares `zod@^3` as a peer dep which conflicts with `zod@4.4.3` already in the workspace (from Angular 22). The RC dropped that peer dep. `zod` does not need to be installed separately. `@ts-rest/angular` does not exist on npm; Angular integration is handled in Step 6 via a custom `HttpClient` adapter.

```bash
npm install @ts-rest/core@3.53.0-rc.1 @ts-rest/nest@3.53.0-rc.1
```

Verify:

```bash
npm list @ts-rest/core @ts-rest/nest --depth=0
```

---

### Step 2: Create `libs/shared/contract` Nx library (30 min)

```bash
npx nx g @nx/js:library contract --directory=libs/shared --importPath=@suggestify/shared/contract --bundler=tsc
```

This creates:

```
libs/shared/contract/
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── src/
    ├── index.ts          ← public exports
    └── lib/              ← contract files go here
```

Remove the scaffolded placeholder file and create contract files:

```
libs/shared/contract/src/lib/
├── schemas.ts            ← shared Zod schemas (reused across contracts)
├── auth.contract.ts
├── suggestion.contract.ts
├── favorite.contract.ts
└── history.contract.ts
```

---

### Step 3: Define Zod schemas and contracts (2 hours)

**`libs/shared/contract/src/lib/schemas.ts`** — shared primitives:

```typescript
import { z } from 'zod';

export const ErrorSchema = z.object({ message: z.string() });

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
});

export const ItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  mood: z.array(z.string()),
  genre: z.array(z.string()),
  description: z.string().optional(),
  year: z.number().optional(),
  author: z.string().optional(),
  publisher: z.string().optional(),
  director: z.string().optional(),
  singer: z.string().optional(),
  tags: z.array(z.string()),
});

export const FavoriteCategoryEnum = z.enum([
  'books',
  'films',
  'games',
  'songs',
]);

export const FavoriteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  itemId: z.string(),
  category: FavoriteCategoryEnum,
  title: z.string().optional(),
  createdAt: z.string(),
});

export const HistoryEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  criteria: z.object({
    mood: z.string(),
    category: z.string(),
    genre: z.string(),
    event: z.string(),
  }),
  suggestions: z.array(ItemSchema),
  timestamp: z.string(),
});
```

**`libs/shared/contract/src/lib/auth.contract.ts`**:

```typescript
import { c } from '@ts-rest/core';
import { z } from 'zod';
import { AuthResponseSchema, ErrorSchema, UserSchema } from './schemas';

export const authContract = c.router({
  register: {
    method: 'POST',
    path: '/auth/users',
    body: z.object({
      username: z.string().min(1),
      password: z.string().min(6),
    }),
    responses: {
      201: AuthResponseSchema,
      400: ErrorSchema,
    },
    summary: 'Register a new user',
  },
  login: {
    method: 'POST',
    path: '/auth/sessions',
    body: z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }),
    responses: {
      200: AuthResponseSchema,
      401: ErrorSchema,
    },
    summary: 'Login and obtain a JWT access token',
  },
  logout: {
    method: 'DELETE',
    path: '/auth/sessions',
    body: c.noBody(),
    responses: {
      200: z.object({ message: z.string() }),
      401: ErrorSchema,
    },
    summary: 'Logout and invalidate the current JWT token',
  },
  getProfile: {
    method: 'GET',
    path: '/auth/users/me',
    responses: {
      200: UserSchema,
      401: ErrorSchema,
    },
    summary: 'Get the authenticated user profile',
  },
});
```

**`libs/shared/contract/src/lib/suggestion.contract.ts`**:

```typescript
import { c } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema, ItemSchema } from './schemas';

const SuggestionResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  items: z.array(ItemSchema).nullable(),
});

export const suggestionContract = c.router({
  getFiltered: {
    method: 'GET',
    path: '/suggestion',
    query: z.object({
      category: z.string().optional(),
      mood: z.string().optional(),
      genre: z.string().optional(),
      event: z.string().optional(),
    }),
    responses: {
      200: SuggestionResponseSchema,
    },
    summary: 'Get filtered suggestions by category, mood, genre, and event',
  },
  getOne: {
    method: 'GET',
    path: '/suggestion/:category/:id',
    pathParams: z.object({
      category: z.string(),
      id: z.string(),
    }),
    responses: {
      200: ItemSchema,
      404: ErrorSchema,
    },
    summary: 'Get a single suggestion item by category and ID',
  },
});
```

**`libs/shared/contract/src/lib/favorite.contract.ts`**:

```typescript
import { c } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema, FavoriteCategoryEnum, FavoriteSchema } from './schemas';

export const favoriteContract = c.router({
  getAll: {
    method: 'GET',
    path: '/favorite',
    query: z.object({ category: FavoriteCategoryEnum.optional() }),
    responses: {
      200: z.array(FavoriteSchema),
      400: ErrorSchema,
    },
    summary: 'Get all favorites for the authenticated user',
  },
  getById: {
    method: 'GET',
    path: '/favorite/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: FavoriteSchema,
      404: ErrorSchema,
    },
    summary: 'Get a single favorite by ID',
  },
  checkFavorite: {
    method: 'GET',
    path: '/favorite/check/:category/:itemId',
    pathParams: z.object({
      category: z.string(),
      itemId: z.string(),
    }),
    responses: {
      200: z.object({ isFavorite: z.boolean() }),
    },
    summary: "Check if a specific item is in the user's favorites",
  },
  add: {
    method: 'POST',
    path: '/favorite',
    body: z.object({
      itemId: z.string(),
      category: FavoriteCategoryEnum,
      title: z.string().optional(),
    }),
    responses: {
      201: FavoriteSchema,
      400: ErrorSchema,
    },
    summary: 'Add an item to favorites',
  },
  remove: {
    method: 'DELETE',
    path: '/favorite/:id',
    pathParams: z.object({ id: z.string() }),
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: ErrorSchema,
    },
    summary: 'Remove a favorite by ID',
  },
});
```

**`libs/shared/contract/src/lib/history.contract.ts`**:

```typescript
import { c } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema, HistoryEntrySchema } from './schemas';

export const historyContract = c.router({
  getAll: {
    method: 'GET',
    path: '/history',
    responses: {
      200: z.array(HistoryEntrySchema),
    },
    summary: 'Get all suggestion history entries for the authenticated user',
  },
  getStats: {
    method: 'GET',
    path: '/history/stats',
    responses: {
      200: z.record(z.string(), z.unknown()),
    },
    summary: 'Get aggregated suggestion statistics for the user',
  },
  getById: {
    method: 'GET',
    path: '/history/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: HistoryEntrySchema,
      404: ErrorSchema,
    },
    summary: 'Get a single history entry by ID',
  },
});
```

**`libs/shared/contract/src/index.ts`**:

```typescript
import { c } from '@ts-rest/core';
import { authContract } from './lib/auth.contract';
import { suggestionContract } from './lib/suggestion.contract';
import { favoriteContract } from './lib/favorite.contract';
import { historyContract } from './lib/history.contract';

export const contract = c.router({
  auth: authContract,
  suggestion: suggestionContract,
  favorite: favoriteContract,
  history: historyContract,
});

export { authContract, suggestionContract, favoriteContract, historyContract };
export * from './lib/schemas';
```

---

### Step 4: Register `TsRestModule` in backend `AppModule` files (30 min)

Add to the `imports` array of each service's `AppModule`:

**`apps/auth-service/src/app.module.ts`**, **`apps/suggestion-service/src/app.module.ts`**, **`apps/history-service/src/app.module.ts`**, **`apps/favorite-service/src/app.module.ts`**:

```typescript
import { TsRestModule } from '@ts-rest/nest';

@Module({
  imports: [
    TsRestModule.register({ isGlobal: true }),
    // ... existing imports unchanged ...
  ],
})
export class AppModule {}
```

---

### Step 5: Apply `NestControllerInterface` to backend controllers (3 hours)

Use the `NestControllerInterface` pattern. This keeps `@Get()/@Post()/@Delete()` decorators and all Phase 1.4 Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, `@ApiHeader`, `@ApiParam`, `@ApiBody`, `@ApiResponse`) exactly as they are. The only changes per method are:

- Replace `@Body() dto: DtoClass` with `@TsRestRequest() { body }: RequestShapes['methodName']`
- Replace `return this.service.method(dto)` with `return { status: N as const, body: result }`
- Remove `@HttpCode(N)` — the `status` field in the return value controls the HTTP status
- `@UseGuards`, `@Request() req`, `@Headers()`, `@Param()`, `@Query()` all stay as-is

`@TsRest(c)` is added at the class level (installs ts-rest's response interceptor). `NestControllerInterface<typeof c>` is added to the class signature (TypeScript enforcement only, no runtime effect). RabbitMQ handlers and `@ApiExcludeEndpoint()` are untouched.

#### `apps/auth-service/src/auth/auth.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import {
  TsRest,
  TsRestRequest,
  nestControllerContract,
  NestControllerInterface,
  NestRequestShapes,
} from '@ts-rest/nest';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { authContract } from '@suggestify/shared/contract';
import { AuthService } from './auth.service';
import { SignUpDto, LoginDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CORRELATION_ID_KEY } from '@suggestify/backend/logger';

const c = nestControllerContract(authContract);
type RequestShapes = NestRequestShapes<typeof c>;

@TsRest(c)
@ApiTags('auth')
@Controller('auth')
export class AuthController implements NestControllerInterface<typeof c> {
  constructor(
    private readonly authService: AuthService,
    private readonly cls: ClsService,
  ) {}

  @Post('users')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignUpDto })
  @ApiResponse({
    status: 201,
    description: 'User created. Returns user object and accessToken.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or username already taken.',
  })
  async register(@TsRestRequest() { body }: RequestShapes['register']) {
    const result = await this.authService.signUp(body);
    return { status: 201 as const, body: result };
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Login and obtain a JWT access token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Returns user object and accessToken.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(@TsRestRequest() { body }: RequestShapes['login']) {
    const result = await this.authService.login(body);
    return { status: 200 as const, body: result };
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate the current JWT token' })
  @ApiResponse({ status: 200, description: 'Logged out.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  async logout(@Request() req) {
    await this.authService.logout(req.user.token);
    return { status: 200 as const, body: { message: 'Logged out' } };
  }

  @Get('users/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  async getProfile(@Request() req) {
    const result = await this.authService.getProfile(req.user.userId);
    return { status: 200 as const, body: result };
  }

  // RabbitMQ — unchanged
  @ApiExcludeEndpoint()
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
}
```

#### `apps/suggestion-service/src/suggestion/suggestion.controller.ts`

Same approach — keep all existing `@Get()`, `@ApiTags('suggestions')`, `@ApiOperation`, `@ApiHeader`, `@ApiQuery`, `@ApiParam`, `@ApiResponse` decorators. Add `@TsRest(c)` at the class, implement `NestControllerInterface<typeof c>`. Replace `@Query()` parameters with `@TsRestRequest() { query }` and return `{ status: 200 as const, body: result }`. Keep `@Headers('X-User-Id') userId` parameter alongside `@TsRestRequest()`. Keep `generateCacheKey()` private helper unchanged.

#### `apps/favorite-service/src/favorite/favorite.controller.ts`

Same pattern. All 5 methods keep their Phase 1.4 decorators. Replace `@Body() dto`, `@Param()`, `@Query()` with `@TsRestRequest() { body, params, query }`. Return `{ status, body }` from each.

#### `apps/history-service/src/history/history.controller.ts`

Same pattern. `@EventPattern('suggestion_created')` and `@ApiExcludeEndpoint()` on `handleSuggestionCreated` are **not touched**. The 3 HTTP methods get `@TsRest(c)` via the class decorator and return `{ status: 200 as const, body: result }`.

---

### Step 6: Update Angular frontend services to ts-rest client (2 hours)

`@ts-rest/angular` does not exist on npm. Instead, use `@ts-rest/core`'s `initClient()` with a custom `api` function that delegates to Angular's `HttpClient`. This preserves the existing `AuthInterceptor` (which adds `Authorization` and `X-User-Id` to every request) because the adapter goes through `HttpClient`.

**`apps/frontend/src/app/ts-rest-client.ts`** — shared client factory:

```typescript
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { initClient } from '@ts-rest/core';
import { contract } from '@suggestify/shared/contract';

export function createTsRestClient() {
  const http = inject(HttpClient);
  return initClient(contract, {
    baseUrl: 'http://localhost:3000/v1',
    baseHeaders: {},
    api: async ({ path, method, headers, body }) => {
      const res = await lastValueFrom(
        http.request(method, path, {
          headers,
          body: body ?? undefined,
          observe: 'response',
          responseType: 'json',
        }),
      );
      return {
        status: res.status,
        body: res.body,
        headers: new Headers(
          Object.fromEntries(
            res.headers.keys().map((k) => [k, res.headers.get(k) ?? '']),
          ),
        ),
      };
    },
  });
}
```

**`apps/frontend/src/app/services/user.service.ts`**:

```typescript
import { Injectable } from '@angular/core';
import { from } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { createTsRestClient } from '../ts-rest-client';

@Injectable({ providedIn: 'root' })
export class UserService {
  userId: string | null = null;
  accessToken: string | null = null;

  private readonly api = createTsRestClient();

  login(user: { username: string; password: string }) {
    return from(this.api.auth.login({ body: user })).pipe(
      map(({ body }) => {
        this.accessToken = body.accessToken;
        this.userId = body.user.id;
        return body;
      }),
    );
  }

  createUser(user: { username: string; password: string }) {
    return from(this.api.auth.register({ body: user })).pipe(
      map(({ body }) => {
        this.accessToken = body.accessToken;
        this.userId = body.user.id;
        return body;
      }),
    );
  }

  logout() {
    return from(this.api.auth.logout({})).pipe(
      tap(() => {
        this.accessToken = null;
        this.userId = null;
      }),
    );
  }
}
```

**`apps/frontend/src/app/services/suggestion.service.ts`**:

```typescript
private readonly api = createTsRestClient();

getSuggestions(request: SuggestionRequest) {
  return from(this.api.suggestion.getFiltered({
    query: {
      category: request.criteria.category,
      mood: request.criteria.mood,
      genre: request.criteria.genre,
      event: request.criteria.tag,
    },
  })).pipe(map(({ body }) => body));
}
```

**`apps/frontend/src/app/services/favorite.service.ts`**:

```typescript
private readonly api = createTsRestClient();

getFavorites(category?: string) {
  return from(this.api.favorite.getAll({ query: { category: category as any } })).pipe(map(({ body }) => body));
}

addFavorite(request: { itemId: string; category: string; title?: string }) {
  return from(this.api.favorite.add({ body: request as any })).pipe(map(({ body }) => body));
}

removeFavorite(favoriteId: string) {
  return from(this.api.favorite.remove({ params: { id: favoriteId } }));
}

checkIsFavorite(category: string, itemId: string) {
  return from(this.api.favorite.checkFavorite({ params: { category, itemId } })).pipe(map(({ body }) => body));
}
```

**`apps/frontend/src/app/services/suggestion-history.service.ts`**:

```typescript
private readonly api = createTsRestClient();

getSuggestionHistory() {
  return from(this.api.history.getAll({})).pipe(map(({ body }) => body));
}
```

---

### Step 7: Build, lint, and Docker verification (1 hour)

```bash
# TypeScript and lint checks
npm run lint:all
npx nx run-many --target=build --all

# Rebuild Docker images
docker compose up -d --build
```

Verify:

- `http://localhost:3001/api` — Swagger UI unchanged from Phase 1.4 (same tags, same bearer padlocks, same param examples)
- `http://localhost:3002/api`, `http://localhost:3003/api`, `http://localhost:3004/api` — same
- Angular frontend login, suggestion, favorites, history flows all work end-to-end
- TypeScript errors if contract response type doesn't match what the service returns

---

## Verification Checklist

### Installation

- [ ] `@ts-rest/core`, `@ts-rest/nest` in `package.json`

### Contract library

- [ ] `libs/shared/contract` exists with `project.json`
- [ ] `@suggestify/shared/contract` importPath resolves in `tsconfig.base.json`
- [ ] `auth.contract.ts` — 4 routes
- [ ] `suggestion.contract.ts` — 2 routes
- [ ] `favorite.contract.ts` — 5 routes
- [ ] `history.contract.ts` — 3 routes
- [ ] `src/index.ts` — `contract`, individual contracts, and schemas all exported

### Backend

- [ ] `TsRestModule.register({ isGlobal: true })` in all 4 `AppModule` imports
- [ ] `AuthController` — `@TsRest(c)` on class, `NestControllerInterface<typeof c>` implemented, 4 HTTP methods return `{ status, body }`, `validateToken` unchanged
- [ ] `SuggestionController` — same pattern, 2 HTTP methods
- [ ] `FavoriteController` — same pattern, 5 HTTP methods
- [ ] `HistoryController` — same pattern, 3 HTTP methods, `handleSuggestionCreated` unchanged
- [ ] All Phase 1.4 Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, `@ApiHeader`, `@ApiParam`, `@ApiQuery`, `@ApiBody`, `@ApiResponse`) still present on all methods

### Phase 1.4 Swagger — unchanged

- [ ] `auth-service/main.ts` — `DocumentBuilder` + `SwaggerModule.createDocument()` unchanged
- [ ] `suggestion-service/main.ts` — unchanged
- [ ] `history-service/main.ts` — unchanged
- [ ] `favorite-service/main.ts` — unchanged
- [ ] `api-gateway/main.ts` — unchanged
- [ ] `http://localhost:3001/api` — same Swagger UI as before Phase 1.5

### Frontend

- [ ] `ts-rest-client.ts` created — `createTsRestClient()` factory with `HttpClient` adapter
- [ ] `user.service.ts` — uses `this.api.auth.*`
- [ ] `suggestion.service.ts` — uses `this.api.suggestion.*`
- [ ] `favorite.service.ts` — uses `this.api.favorite.*`
- [ ] `suggestion-history.service.ts` — uses `this.api.history.*`
- [ ] No remaining `this.http.get/post/delete` in the 4 updated services

### Runtime (Docker)

- [ ] All 5 services start and pass health checks
- [ ] `http://localhost:3001/api` — Swagger UI identical to Phase 1.4
- [ ] Login flow works end-to-end (Angular → gateway → auth-service)
- [ ] Suggestions load with Zod-validated response
- [ ] Favorites CRUD works
- [ ] History loads
- [ ] `nx run-many --target=build --all` — 0 TypeScript errors
- [ ] `npm run lint:all` — 0 errors

---

## Rollback Strategy

```bash
# Revert backend changes
git checkout apps/auth-service/src/auth/auth.controller.ts
git checkout apps/suggestion-service/src/suggestion/suggestion.controller.ts
git checkout apps/favorite-service/src/favorite/favorite.controller.ts
git checkout apps/history-service/src/history/history.controller.ts
git checkout apps/*/src/app.module.ts

# Revert frontend changes
git checkout apps/frontend/src/app/app.config.ts
git checkout apps/frontend/src/app/services/

# Remove contract library
git clean -fd libs/shared/

# Remove packages
npm uninstall @ts-rest/core @ts-rest/nest @ts-rest/angular zod

# Rebuild
docker compose up -d --build
```

Note: `apps/*/src/main.ts` files are **not** in rollback — they are not changed by Phase 1.5.

---

## Timeline Summary

| Step      | Task                                                     | Time                   |
| --------- | -------------------------------------------------------- | ---------------------- |
| 1         | Install packages                                         | 15 min                 |
| 2         | Create `libs/shared/contract` Nx library                 | 30 min                 |
| 3         | Define Zod schemas and 4 contracts (14 endpoints)        | 2 hours                |
| 4         | Register `TsRestModule` in 4 backend `AppModule` files   | 30 min                 |
| 5         | Apply `NestControllerInterface` to 4 backend controllers | 3 hours                |
| 6         | Update 4 Angular frontend services to ts-rest client     | 2 hours                |
| 7         | Build, lint, Docker verification                         | 1 hour                 |
| **Total** |                                                          | **~9 hours (~2 days)** |

---

**Phase 1.5 Status**: Ready to implement
**Next Phase**: Phase 1.6 — Development Tools

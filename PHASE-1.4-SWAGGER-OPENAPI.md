# Phase 1.4: Swagger/OpenAPI Documentation — Implementation Plan

## Overview

Install `@nestjs/swagger` and expose a Swagger UI at `/api` for each of the five backend services. Add `@ApiProperty()` to all request DTOs so the Swagger UI renders request body schemas correctly. Add `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`, `@ApiHeader`, `@ApiQuery`, and `@ApiParam` to all HTTP controller methods. Exclude RabbitMQ handlers (`@MessagePattern`, `@EventPattern`) with `@ApiExcludeEndpoint()`. The api-gateway is a transparent proxy with no typed request/response shapes — it gets a Swagger document with `@ApiExcludeController()` on the ProxyController and a description linking to the individual service UIs.

## Scope

✅ **In Scope:**

- Install `@nestjs/swagger` once at the workspace root
- Wire Swagger into all 5 `main.ts` files
- Add `@ApiProperty()` to 4 request DTOs: `SignUpDto`, `LoginDto`, `CreateFavoriteDto`, `UserChoiceDto`
- Add Swagger decorators to all HTTP endpoints in auth, suggestion, favorite, and history controllers
- Exclude RabbitMQ handlers with `@ApiExcludeEndpoint()`
- Exclude ProxyController from api-gateway Swagger with `@ApiExcludeController()`
- Docker verification: Swagger UI reachable at `/api` on all 5 service ports

❌ **Out of Scope:**

- Response schema classes for complex types (suggestion items, history entries, user profile) — these require creating ~10+ additional response DTO classes; deferred to Phase 1.5 ts-rest which generates schemas from Zod contracts
- OpenAPI spec JSON file export or a dedicated `/swagger.json` download (available automatically at `/api-json`)
- API versioning in the Swagger documents
- Swagger on the Angular frontend app

## Why This Matters

### Current State

No service exposes a Swagger UI. Developers must read controller source code or use an external Postman collection to discover endpoint shapes.

```
auth-service:3001       — no /api endpoint
suggestion-service:3002 — no /api endpoint
history-service:3003    — no /api endpoint
favorite-service:3004   — no /api endpoint
api-gateway:3000        — no /api endpoint
```

### Target State

```
auth-service:3001/api        — Swagger UI: 4 endpoints
                               POST /auth/users
                               POST /auth/sessions
                               DELETE /auth/sessions
                               GET /auth/users/me

suggestion-service:3002/api  — Swagger UI: 2 endpoints
                               GET /suggestion
                               GET /suggestion/:category/:id

history-service:3003/api     — Swagger UI: 3 endpoints
                               GET /history
                               GET /history/stats
                               GET /history/:id

favorite-service:3004/api    — Swagger UI: 5 endpoints
                               GET /favorite
                               GET /favorite/:id
                               GET /favorite/check/:category/:itemId
                               POST /favorite
                               DELETE /favorite/:id

api-gateway:3000/api         — Swagger UI: empty endpoint list; description links
                               to individual service Swagger UIs
```

## HTTP Endpoints to Document

| Service            | Method | Path                              | Auth             | Notes                                      |
| ------------------ | ------ | --------------------------------- | ---------------- | ------------------------------------------ |
| auth-service       | POST   | /auth/users                       | None             | Register, body: SignUpDto                  |
| auth-service       | POST   | /auth/sessions                    | None             | Login, body: LoginDto                      |
| auth-service       | DELETE | /auth/sessions                    | Bearer JWT       | Logout, invalidates token                  |
| auth-service       | GET    | /auth/users/me                    | Bearer JWT       | Authenticated profile                      |
| suggestion-service | GET    | /suggestion                       | X-User-Id header | Query params: category, mood, genre, event |
| suggestion-service | GET    | /suggestion/:category/:id         | None             | Path params: category, id                  |
| history-service    | GET    | /history                          | X-User-Id header | All entries for user                       |
| history-service    | GET    | /history/stats                    | X-User-Id header | Aggregated usage stats                     |
| history-service    | GET    | /history/:id                      | X-User-Id header | Single entry by MongoDB id                 |
| favorite-service   | GET    | /favorite                         | X-User-Id header | List; optional category query              |
| favorite-service   | GET    | /favorite/:id                     | X-User-Id header | Single by UUID                             |
| favorite-service   | GET    | /favorite/check/:category/:itemId | X-User-Id header | Returns `{ isFavorite: bool }`             |
| favorite-service   | POST   | /favorite                         | X-User-Id header | Body: CreateFavoriteDto                    |
| favorite-service   | DELETE | /favorite/:id                     | X-User-Id header | 204 No Content                             |

**Excluded from Swagger (RabbitMQ handlers):**

| Service         | Decorator       | Handler                 | Treatment               |
| --------------- | --------------- | ----------------------- | ----------------------- |
| auth-service    | @MessagePattern | validateToken           | @ApiExcludeEndpoint()   |
| history-service | @EventPattern   | handleSuggestionCreated | @ApiExcludeEndpoint()   |
| api-gateway     | @All (proxy)    | all 4 proxy methods     | @ApiExcludeController() |

## DTOs to Decorate

| File                                                            | Fields to add @ApiProperty to        |
| --------------------------------------------------------------- | ------------------------------------ |
| `apps/auth-service/src/auth/dto/signup.dto.ts`                  | `username`, `password`               |
| `apps/auth-service/src/auth/dto/login.dto.ts`                   | `username`, `password`               |
| `apps/favorite-service/src/favorite/dto/create-favorite.dto.ts` | `itemId`, `category`, `title`        |
| `apps/suggestion-service/src/suggestion/dto/user-choice.ts`     | `category`, `mood`, `event`, `genre` |

---

## Implementation Steps

### Step 1: Install `@nestjs/swagger` (5 min)

```bash
pnpm add @nestjs/swagger
```

`swagger-ui-express` has been bundled inside `@nestjs/swagger` since v7 — no separate install needed.

Verify:

```bash
pnpm list @nestjs/swagger
```

### Step 2: Add `@ApiProperty()` to DTOs (30 min)

**`apps/auth-service/src/auth/dto/signup.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'johndoe', description: 'Unique username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: 'secret123',
    description: 'Minimum 6 characters',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
```

**`apps/auth-service/src/auth/dto/login.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'johndoe' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
```

**`apps/favorite-service/src/favorite/dto/create-favorite.dto.ts`**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FavoriteCategory } from '../entities/favorite.entity';

export class CreateFavoriteDto {
  @ApiProperty({
    example: 'b3fa1c2d-4e5f-6789-abcd-ef0123456789',
    description: 'ID of the item in the source service',
  })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({
    enum: FavoriteCategory,
    example: FavoriteCategory.BOOK,
    description: 'books | films | games | songs',
  })
  @IsEnum(FavoriteCategory)
  @IsNotEmpty()
  category: FavoriteCategory;

  @ApiPropertyOptional({ example: 'The Hobbit' })
  @IsString()
  @IsOptional()
  title?: string;
}
```

**`apps/suggestion-service/src/suggestion/dto/user-choice.ts`**

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UserChoiceDto {
  @ApiPropertyOptional({
    example: 'books',
    description: 'books | films | games | songs',
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'calm' })
  @IsString()
  @IsOptional()
  mood?: string;

  @ApiPropertyOptional({ example: 'birthday' })
  @IsString()
  @IsOptional()
  event?: string;

  @ApiPropertyOptional({ example: 'fantasy' })
  @IsString()
  @IsOptional()
  genre?: string;
}
```

### Step 3: Add decorators to controllers (1.5 hours)

#### `apps/auth-service/src/auth/auth.controller.ts`

Add `@ApiTags('auth')` to the class. Add per-method decorators:

```typescript
// POST /auth/users
@ApiOperation({ summary: 'Register a new user' })
@ApiBody({ type: SignUpDto })
@ApiResponse({ status: 201, description: 'User created. Returns user object and accessToken.' })
@ApiResponse({ status: 400, description: 'Validation error or username already taken.' })

// POST /auth/sessions
@ApiOperation({ summary: 'Login and obtain a JWT access token' })
@ApiBody({ type: LoginDto })
@ApiResponse({ status: 200, description: 'Login successful. Returns user object and accessToken.' })
@ApiResponse({ status: 401, description: 'Invalid credentials.' })

// DELETE /auth/sessions  (already has @UseGuards(JwtAuthGuard))
@ApiBearerAuth()
@ApiOperation({ summary: 'Logout and invalidate the current JWT token' })
@ApiResponse({ status: 200, description: 'Logged out.' })
@ApiResponse({ status: 401, description: 'Missing or invalid token.' })

// GET /auth/users/me  (already has @UseGuards(JwtAuthGuard))
@ApiBearerAuth()
@ApiOperation({ summary: 'Get the authenticated user profile' })
@ApiResponse({ status: 200, description: 'User profile.' })
@ApiResponse({ status: 401, description: 'Missing or invalid token.' })

// @MessagePattern({ cmd: 'validate_token' })
@ApiExcludeEndpoint()
```

Imports to add:

```typescript
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
```

#### `apps/suggestion-service/src/suggestion/suggestion.controller.ts`

Add `@ApiTags('suggestions')` to the class. The controller reads individual `@Query()` params (not a `@Body()` DTO), so use `@ApiQuery` per param:

```typescript
// GET /suggestion
@ApiOperation({ summary: 'Get filtered suggestions by category, mood, genre, and event' })
@ApiHeader({ name: 'X-User-Id', required: true, description: 'Authenticated user ID (injected by API Gateway)' })
@ApiQuery({ name: 'category', required: false, example: 'books', description: 'books | films | games | songs' })
@ApiQuery({ name: 'mood', required: false, example: 'calm' })
@ApiQuery({ name: 'genre', required: false, example: 'fantasy' })
@ApiQuery({ name: 'event', required: false, example: 'birthday' })
@ApiResponse({ status: 200, description: 'List of suggestions matching the criteria.' })

// GET /suggestion/:category/:id
@ApiOperation({ summary: 'Get a single suggestion item by category and ID' })
@ApiParam({ name: 'category', example: 'books', description: 'books | films | games | songs' })
@ApiParam({ name: 'id', example: '42' })
@ApiResponse({ status: 200, description: 'Suggestion item.' })
@ApiResponse({ status: 404, description: 'Not found.' })
```

Imports to add:

```typescript
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
```

#### `apps/favorite-service/src/favorite/favorite.controller.ts`

Add `@ApiTags('favorites')` to the class:

```typescript
// GET /favorite
@ApiOperation({ summary: 'Get all favorites for the authenticated user' })
@ApiHeader({ name: 'X-User-Id', required: true, description: 'Authenticated user ID (injected by API Gateway)' })
@ApiQuery({ name: 'category', required: false, enum: FavoriteCategory, description: 'Filter by category' })
@ApiResponse({ status: 200, description: 'Array of favorite items.' })
@ApiResponse({ status: 400, description: 'Missing X-User-Id header.' })

// GET /favorite/:id
@ApiOperation({ summary: 'Get a single favorite by ID' })
@ApiHeader({ name: 'X-User-Id', required: true })
@ApiParam({ name: 'id', description: 'Favorite record UUID' })
@ApiResponse({ status: 200, description: 'Favorite item.' })
@ApiResponse({ status: 404, description: 'Not found.' })

// GET /favorite/check/:category/:itemId
@ApiOperation({ summary: 'Check if a specific item is in the user\'s favorites' })
@ApiHeader({ name: 'X-User-Id', required: true })
@ApiParam({ name: 'category', enum: FavoriteCategory })
@ApiParam({ name: 'itemId', example: 'b3fa1c2d-4e5f-6789-abcd-ef0123456789' })
@ApiResponse({ status: 200, description: '{ isFavorite: boolean }' })

// POST /favorite
@ApiOperation({ summary: 'Add an item to favorites' })
@ApiHeader({ name: 'X-User-Id', required: true })
@ApiBody({ type: CreateFavoriteDto })
@ApiResponse({ status: 201, description: 'Favorite created.' })
@ApiResponse({ status: 400, description: 'Validation error or missing header.' })

// DELETE /favorite/:id
@ApiOperation({ summary: 'Remove a favorite by ID' })
@ApiHeader({ name: 'X-User-Id', required: true })
@ApiParam({ name: 'id', description: 'Favorite record UUID' })
@ApiResponse({ status: 204, description: 'Deleted.' })
@ApiResponse({ status: 404, description: 'Not found.' })
```

Imports to add:

```typescript
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
```

#### `apps/history-service/src/history/history.controller.ts`

Add `@ApiTags('history')` to the class:

```typescript
// GET /history
@ApiOperation({ summary: 'Get all suggestion history entries for the authenticated user' })
@ApiHeader({ name: 'X-User-Id', required: true, description: 'Authenticated user ID (injected by API Gateway)' })
@ApiResponse({ status: 200, description: 'Array of history entries.' })

// GET /history/stats
@ApiOperation({ summary: 'Get aggregated suggestion statistics for the user' })
@ApiHeader({ name: 'X-User-Id', required: true })
@ApiResponse({ status: 200, description: 'User stats object.' })

// GET /history/:id
@ApiOperation({ summary: 'Get a single history entry by ID' })
@ApiHeader({ name: 'X-User-Id', required: true })
@ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
@ApiResponse({ status: 200, description: 'History entry.' })
@ApiResponse({ status: 404, description: 'Not found.' })

// @EventPattern('suggestion_created')
@ApiExcludeEndpoint()
```

Imports to add:

```typescript
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiParam,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
```

#### `apps/api-gateway/src/proxy/proxy.controller.ts`

Add `@ApiExcludeController()` to the class. No per-method changes needed.

```typescript
import { ApiExcludeController } from '@nestjs/swagger';

@Controller()
@UseGuards(ThrottlerGuard)
@ApiExcludeController()
export class ProxyController { ... }
```

### Step 4: Wire Swagger into `main.ts` files (30 min)

Insert the Swagger setup block **after `app.useGlobalPipes(...)` and before `await app.listen(PORT)`** in each service.

**`apps/auth-service/src/main.ts`**

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('Auth Service')
  .setDescription('User registration, login, logout, and profile retrieval')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api', app, swaggerDocument);
```

**`apps/suggestion-service/src/main.ts`**

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('Suggestion Service')
  .setDescription(
    'Retrieve filtered suggestions and individual items by category',
  )
  .setVersion('1.0')
  .build();
const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api', app, swaggerDocument);
```

**`apps/history-service/src/main.ts`**

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('History Service')
  .setDescription('User suggestion history and aggregated usage statistics')
  .setVersion('1.0')
  .build();
const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api', app, swaggerDocument);
```

**`apps/favorite-service/src/main.ts`**

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('Favorite Service')
  .setDescription(
    'Manage user favorites — add, list, check membership, and remove',
  )
  .setVersion('1.0')
  .build();
const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api', app, swaggerDocument);
```

**`apps/api-gateway/src/main.ts`**

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('API Gateway')
  .setDescription(
    'Transparent reverse proxy to downstream services. ' +
      'Swagger UIs for individual services: ' +
      'auth-service :3001/api | suggestion-service :3002/api | ' +
      'history-service :3003/api | favorite-service :3004/api',
  )
  .setVersion('1.0')
  .build();
const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api', app, swaggerDocument);
```

> ⚠️ The api-gateway sets `app.setGlobalPrefix('v1')`. `SwaggerModule.setup('api', ...)` mounts the Swagger UI directly on the Express layer — it bypasses the global prefix. Swagger UI will be at `http://localhost:3000/api`, not `/v1/api`.

### Step 5: Docker verification (45 min)

Rebuild and start all containers:

```bash
docker compose up -d --build
```

Wait ~90 seconds for services to become healthy, then check each Swagger UI:

```bash
# Each should return HTTP 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api
curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/api
curl -s -o /dev/null -w "%{http_code}" http://localhost:3004/api
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api
```

Open each URL in a browser and verify endpoint count, tags, and request execution.

---

## Verification Checklist

### Installation

- [ ] `@nestjs/swagger` present in root `package.json` dependencies
- [ ] `pnpm list @nestjs/swagger` shows the installed version

### DTOs

- [ ] `SignUpDto.username` — `@ApiProperty` with example `'johndoe'`
- [ ] `SignUpDto.password` — `@ApiProperty` with `minLength: 6`
- [ ] `LoginDto.username` and `LoginDto.password` — `@ApiProperty` present
- [ ] `CreateFavoriteDto.itemId` and `.category` — `@ApiProperty`; `.title` — `@ApiPropertyOptional`
- [ ] `UserChoiceDto` — all 4 fields have `@ApiPropertyOptional`

### Controllers

- [ ] `AuthController` — class has `@ApiTags('auth')`, `@ApiBearerAuth` on logout and getProfile, `@ApiExcludeEndpoint` on `validateToken`
- [ ] `SuggestionController` — class has `@ApiTags('suggestions')`, `@ApiQuery` on all 4 filter params, `@ApiParam` on the `/:category/:id` route
- [ ] `HistoryController` — class has `@ApiTags('history')`, `@ApiHeader` on all 3 GET methods, `@ApiExcludeEndpoint` on `handleSuggestionCreated`
- [ ] `FavoriteController` — class has `@ApiTags('favorites')`, all 5 methods have `@ApiHeader`, `@ApiBody` on POST, `@ApiParam` on routes with path params
- [ ] `ProxyController` — class has `@ApiExcludeController()`

### Swagger setup in main.ts

- [ ] `apps/auth-service/src/main.ts` — `DocumentBuilder` + `.addBearerAuth()` + `SwaggerModule.setup('api', ...)`
- [ ] `apps/suggestion-service/src/main.ts` — `SwaggerModule.setup('api', ...)`
- [ ] `apps/history-service/src/main.ts` — `SwaggerModule.setup('api', ...)`
- [ ] `apps/favorite-service/src/main.ts` — `SwaggerModule.setup('api', ...)`
- [ ] `apps/api-gateway/src/main.ts` — `SwaggerModule.setup('api', ...)` with gateway description

### Runtime (Docker)

- [ ] `http://localhost:3001/api` — auth Swagger UI loads; shows `auth` tag with 4 endpoints
- [ ] `http://localhost:3002/api` — suggestion Swagger UI loads; shows `suggestions` tag with 2 endpoints
- [ ] `http://localhost:3003/api` — history Swagger UI loads; shows `history` tag with 3 endpoints
- [ ] `http://localhost:3004/api` — favorite Swagger UI loads; shows `favorites` tag with 5 endpoints
- [ ] `http://localhost:3000/api` — gateway Swagger UI loads; 0 endpoints; description visible
- [ ] `POST /auth/users` via Swagger UI — 201 or 400 response
- [ ] `POST /auth/sessions` via Swagger UI — 200 with accessToken or 401
- [ ] Bearer token from login can be pasted into Swagger UI Authorize and used on `DELETE /auth/sessions` and `GET /auth/users/me`
- [ ] `GET /suggestion?category=books` via Swagger UI — response with suggestions array

---

## Rollback Strategy

If something breaks after rebuilding Docker images:

```bash
# Revert all file changes
git checkout apps/auth-service/src/auth/auth.controller.ts
git checkout apps/auth-service/src/auth/dto/signup.dto.ts
git checkout apps/auth-service/src/auth/dto/login.dto.ts
git checkout apps/auth-service/src/main.ts
git checkout apps/suggestion-service/src/suggestion/suggestion.controller.ts
git checkout apps/suggestion-service/src/suggestion/dto/user-choice.ts
git checkout apps/suggestion-service/src/main.ts
git checkout apps/history-service/src/history/history.controller.ts
git checkout apps/history-service/src/main.ts
git checkout apps/favorite-service/src/favorite/favorite.controller.ts
git checkout apps/favorite-service/src/favorite/dto/create-favorite.dto.ts
git checkout apps/favorite-service/src/main.ts
git checkout apps/api-gateway/src/proxy/proxy.controller.ts
git checkout apps/api-gateway/src/main.ts

# Remove the package and rebuild
pnpm remove @nestjs/swagger
docker compose up -d --build
```

---

## Timeline Summary

| Step | Task                                    | Time                   |
| ---- | --------------------------------------- | ---------------------- |
| 1    | Install `@nestjs/swagger`               | 5 min                  |
| 2    | Add `@ApiProperty()` to 4 DTOs          | 30 min                 |
| 3    | Add Swagger decorators to 4 controllers | 1 hour 30 min          |
| 4    | Wire Swagger into 5 `main.ts` files     | 30 min                 |
| 5    | Docker verification                     | 45 min                 |
|      | **Total**                               | **~3h 20min (~1 day)** |

---

**Phase 1.4 Status**: Ready to implement
**Next Phase**: Phase 1.5 — API Contract with ts-rest

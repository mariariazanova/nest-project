# Phase 4.17 — Backend Integration Tests

**Status:** Planned  
**Estimate:** 1-2 days  
**Branch:** enhance

---

## What Integration Tests Are (and Are Not)

**Unit tests** — test one class in isolation, all dependencies mocked (Jest, no DB).

**Integration tests** — test multiple components working together with real infrastructure:

```
HTTP request (Supertest)
      ↓
Controller
      ↓
Service
      ↓
Repository
      ↓
Real PostgreSQL / MongoDB / Redis (Testcontainers)
```

Assert both: HTTP response **and** actual DB state.

**E2E tests (Phase 4.16)** — full user journey through a real browser (Playwright) against the full running stack.

---

## Current State

`test/e2e/` files test HTTP contracts through the api-gateway (status codes, response shapes) but do **not** verify database side effects and require the full docker-compose stack running externally. Integration tests are a separate, lower-level layer.

---

## Strategy: Jest + Supertest + Testcontainers

Each NestJS service gets its own integration test suite that:

1. **Testcontainers** starts real Docker containers (Postgres / MongoDB / Redis / RabbitMQ) at test start
2. **NestJS Testing Module** boots the service in-process, wired to the real containers
3. **Supertest** sends HTTP requests to the in-process server
4. Tests assert **both** the HTTP response **and** the actual database state

```typescript
// Example: auth-service integration test
describe('POST /auth/users', () => {
  it('creates a user in the database', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/users')
      .send({ username: 'alice', password: 'secret123' });

    expect(res.status).toBe(201);

    // Verify side effect — row actually exists in Postgres
    const user = await userRepository.findOne({ where: { username: 'alice' } });
    expect(user).toBeDefined();
    expect(user.username).toBe('alice');
  });
});
```

### Why Not docker-compose?

|           | Testcontainers                        | docker-compose               |
| --------- | ------------------------------------- | ---------------------------- |
| Setup     | Automatic per test run                | Manual, must be running      |
| Isolation | Each test suite gets fresh containers | Shared state across runs     |
| CI        | Works anywhere Docker runs            | Requires compose pre-start   |
| Speed     | Parallel container starts             | Sequential startup           |
| Cleanup   | Auto on test end                      | Manual `docker-compose down` |

---

## Packages to Install

```bash
npm install --save-dev \
  supertest \
  @types/supertest \
  testcontainers \
  @testcontainers/postgresql \
  @testcontainers/mongodb \
  @testcontainers/redis \
  @testcontainers/rabbitmq
```

---

## Test Location

```
test/integration/
├── auth-service/
│   ├── jest.config.ts
│   ├── tsconfig.spec.json
│   ├── project.json
│   └── src/
│       ├── auth.integration.spec.ts
│       └── token-blacklist.integration.spec.ts
├── suggestion-service/
│   ├── jest.config.ts
│   ├── tsconfig.spec.json
│   ├── project.json
│   └── src/
│       └── suggestion.integration.spec.ts
├── favorite-service/
│   ├── jest.config.ts
│   ├── tsconfig.spec.json
│   ├── project.json
│   └── src/
│       └── favorite.integration.spec.ts
├── history-service/
│   ├── jest.config.ts
│   ├── tsconfig.spec.json
│   ├── project.json
│   └── src/
│       └── history.integration.spec.ts
└── jest.preset.js
```

Each `project.json` registers an `integration` target (separate from `test` and `e2e`):

```json
{
  "name": "auth-service-integration",
  "targets": {
    "integration": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "test/integration/auth-service/jest.config.ts"
      },
      "dependsOn": ["auth-service:build"]
    }
  }
}
```

Run all: `npx nx run-many -t integration`

---

## Container Setup Pattern

Each test file follows the same lifecycle:

```typescript
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe('auth-service integration', () => {
  let app: INestApplication;
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;

  beforeAll(async () => {
    // Start real containers
    [postgres, redis] = await Promise.all([
      new PostgreSqlContainer('postgres:15-alpine').start(),
      new RedisContainer('redis:7-alpine').start(),
    ]);

    // Override env vars so AppModule reads container connection details
    process.env.DB_HOST = postgres.getHost();
    process.env.DB_PORT = String(postgres.getPort());
    process.env.DB_NAME = postgres.getDatabase();
    process.env.DB_USER = postgres.getUsername();
    process.env.DB_PASSWORD = postgres.getPassword();
    process.env.REDIS_HOST = redis.getHost();
    process.env.REDIS_PORT = String(redis.getMappedPort(6379));

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 60_000); // Container startup can take ~30s

  afterAll(async () => {
    await app.close();
    await Promise.all([postgres.stop(), redis.stop()]);
  });
});
```

---

## Test Scenarios Per Service

### auth-service

Containers: Postgres + Redis

```
POST /auth/users
  ✓ 201 on valid registration
  ✓ user row exists in Postgres (DB assertion)
  ✓ 409 when username is already taken

POST /auth/sessions
  ✓ 200 + JWT for valid credentials
  ✓ 401 for wrong password
  ✓ 401 for unknown username

GET /auth/users/me
  ✓ 200 + user data with valid JWT
  ✓ 401 without token
  ✓ 401 with malformed token

DELETE /auth/sessions
  ✓ 200 on logout
  ✓ token entry written to Redis blacklist (DB assertion)
  ✓ 401 on subsequent requests with that token
```

### suggestion-service

Containers: Postgres + Redis

```
GET /suggestion
  ✓ 200 + empty array (no seed data)
  ✓ 200 + array (after seeding suggestion rows directly to Postgres)
  ✓ 200 + filtered by category (seed + filter)
  ✓ cached response on second call (Redis assertion: key exists)

GET /suggestion/:category/:id
  ✓ 200 + item (after seeding)
  ✓ 404 for nonexistent id
```

### favorite-service

Containers: Postgres + Redis

```
POST /favorite
  ✓ 201 + created favorite
  ✓ row exists in Postgres (DB assertion)
  ✓ 409 on duplicate (same userId + itemId + category)

GET /favorite
  ✓ 200 + list for userId
  ✓ 200 + filtered by category

GET /favorite/check/:category/:itemId
  ✓ 200 + { isFavorite: true } for existing
  ✓ 200 + { isFavorite: false } for nonexistent

GET /favorite/:id
  ✓ 200 + record
  ✓ 404 for nonexistent

DELETE /favorite/:id
  ✓ 204
  ✓ row deleted from Postgres (DB assertion)
  ✓ 404 on re-delete
```

### history-service

Containers: MongoDB + Redis + RabbitMQ

```
RabbitMQ event: suggestion_created
  ✓ publish event to RabbitMQ
  ✓ service consumes it → history document created in MongoDB (DB assertion)

GET /history
  ✓ 200 + empty array for new userId
  ✓ 200 + entries after event consumed

GET /history/stats
  ✓ 200 + stats object

GET /history/:id
  ✓ 200 + document (after event consumed)
  ✓ 404 for nonexistent
```

---

## Jest Config for Integration Tests

Integration tests need a longer timeout (container startup) and are separate from unit tests:

```typescript
// test/integration/auth-service/jest.config.ts
export default {
  displayName: 'auth-service-integration',
  preset: '../jest.preset.js',
  testEnvironment: 'node',
  testTimeout: 60_000,
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  testMatch: ['**/*.integration.spec.ts'],
};
```

---

## Implementation Steps

1. Install packages (`supertest`, `@types/supertest`, `testcontainers`, `@testcontainers/postgresql`, `@testcontainers/mongodb`, `@testcontainers/redis`, `@testcontainers/rabbitmq`)
2. Create `test/integration/jest.preset.js`
3. Create `test/integration/auth-service/` — config + spec files
4. Create `test/integration/suggestion-service/` — config + spec files
5. Create `test/integration/favorite-service/` — config + spec files
6. Create `test/integration/history-service/` — config + spec files
7. Register `integration` target in each service's `project.json`

---

## Non-Goals (Out of Scope for 4.17)

- api-gateway integration tests (requires all downstream services — covered by Playwright E2E in Phase 4.16)
- Seeding the suggestion DB with production-like data (separate data-seeding task)
- Coverage thresholds (Phase 4.18)
- CI pipeline integration (Phase 6)

---

## Completion Criteria

- [ ] Packages installed: `supertest`, `testcontainers`, adapters for Postgres/MongoDB/Redis/RabbitMQ
- [ ] `test/integration/` structure created for all 4 services
- [ ] auth-service: register + DB assertion, login, profile, logout + Redis blacklist assertion
- [ ] suggestion-service: list with seed data, filter, cache assertion
- [ ] favorite-service: full CRUD with DB assertions
- [ ] history-service: RabbitMQ event consumed + MongoDB document created
- [ ] `npx nx run-many -t integration` passes with no running docker-compose

---

_Written: 2026-06-30_

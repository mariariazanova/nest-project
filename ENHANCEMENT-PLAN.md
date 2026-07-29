# Suggestify Enhancement Plan - Overall Timeline

## Project Overview

Enhance Suggestify with file uploads, real-time features, security improvements, testing infrastructure, and deployment automation.

---

## Phase 0: Technical Debt & Architecture Cleanup (1 week)

### 0.1. Monorepo Tooling - Nx Setup (2 days)

- Install and configure Nx for entire monorepo (frontend + backend)
- Setup shared libraries structure (libs/shared, libs/backend)
- Configure build caching and affected commands
- Migrate apps to Nx workspace

**Estimate:** 2 days (1 developer)

---

### 0.2. Package Updates & Dependency Modernization (1 day)

- Upgrade Angular from 18 to 22 (includes native Vitest 4 support)
- Upgrade all @angular/\* packages to v22.0.4
- Update TypeScript to 6.0.x (required by Angular 22)
- Update Vite to v6+ (compatible with Angular 22)
- Upgrade all NestJS packages to latest v10.x
- Update all other dependencies to latest stable versions
- Remove legacy-peer-deps where possible
- Setup Vitest for frontend tests (replaces Karma/Jasmine)
- Verify all services build and run after upgrades
- Update any breaking changes in code

**Benefits:**

- Native Vitest support in Angular 22
- Better TypeScript type checking
- Performance improvements
- Security patches
- Modern tooling compatibility

**Estimate:** 1 day (1 developer)

---

### 0.3. Restructure Infrastructure Folder (0.5 day)

- Move `backend/infrastructure/` to root `infrastructure/`
- Update docker-compose paths and CI/CD references
- Infrastructure orchestrates entire system, not just backend

**Estimate:** 0.5 day (1 developer)

---

### 0.4. Fix RxJS Duplication Hack (0.5 day)

- Remove `backend/scripts/remove-duplicate-rxjs.js` hack script
- Move RxJS to root backend/package.json with overrides
- Let Nx/npm handle dependency deduplication properly

**Estimate:** 0.5 day (1 developer)

---

### 0.5. Extract Infrastructure Modules to Shared Libraries (2-3 days)

**Current Issue:** ~1,250 lines of duplicated infrastructure code across all 5 services

**Extract to Shared Libraries:**

- **libs/backend/health** - Health checks (duplicated 5x, ~30 lines each)
- **libs/backend/metrics** - Prometheus metrics (100% identical, 55 lines × 5)
- **libs/backend/consul** - Service discovery (99% identical, 126 lines × 5, make service name configurable)
- **libs/backend/circuit-breaker** - Opossum wrapper (95% identical, ~70 lines × 5)

**Implementation:**

- Extract common patterns to shared libraries
- Make configurable via dependency injection and environment variables
- Services import and extend base functionality with specific needs

**Estimate:** 2-3 days (1 developer)

---

### 0.6. Pre-commit Hooks (0.5 day)

- Install Husky + lint-staged
- Run ESLint + Prettier on git commit
- Run tests before push
- Enforce code quality before commits

**Estimate:** 0.5 day (1 developer)

**Phase 0 Total:** 1-1.5 weeks

---

## Phase 1: Developer Experience & Foundations (2-3 weeks)

### 1.1. Database Migrations Setup (2-3 days)

- Setup TypeORM migrations for all PostgreSQL services
- Create migration scripts (generate, run, revert)
- Replace `synchronize: true` with proper migrations
- Fix entity bugs surfaced during audit (wrong id types, inverse refs, missing unique constraints, password column in wrong service, missing entity registrations)
- Fix Redis DB slot isolation (3 services sharing slot `/0`; assign each its own slot)
- Fix Redis eviction policy (`maxmemory-policy allkeys-lru` in docker-compose; default `noeviction` errors on full memory)
- Add migrate-mongo for MongoDB history migrations (collection validation, structural changes)
- Document migration workflow including PostgreSQL ENUM special case (TypeORM cannot auto-generate `ALTER TYPE ADD VALUE` — must be written manually)

**Estimate:** 2-3 days (1 developer)

---

### 1.2. Structured Logging with Correlation IDs (2-3 days)

- Replace NestJS Logger with Winston or Pino
- Implement JSON structured logging
- Add correlation ID middleware for distributed tracing
- Track requests across microservices

**Estimate:** 2-3 days (1 developer)

---

### 1.3. Request/Response Logging Middleware (1 day)

- Add request/response interceptors using structured logger
- Log request body, response, duration
- Mask sensitive fields (passwords, tokens)
- Add audit trail for debugging

**Estimate:** 1 day (1 developer)

---

### 1.4. Swagger/OpenAPI Documentation (1-2 days)

- Install @nestjs/swagger in all services
- Add decorators to controllers and DTOs
- Generate OpenAPI spec automatically
- Expose Swagger UI at /api endpoint in each service

**Estimate:** 1-2 days (1 developer)

---

### 1.5. API Contract with ts-rest (2-3 days)

- Install @ts-rest/core, @ts-rest/nest, @ts-rest/angular, @ts-rest/open-api, zod
- Create libs/shared/contract for API contracts
- Define contracts with Zod schemas for all endpoints (auth, suggestions, favorites, history)
- Implement ts-rest handlers in all backend services
- Generate OpenAPI spec from ts-rest contracts (enhances Swagger documentation)
- Integrate ts-rest client in Angular frontend for type-safe API calls
- Keep both: Swagger UI for documentation, ts-rest for type safety

**Estimate:** 2-3 days (1 developer)

---

### 1.6. Development Tools (0.5 day)

- Add pgAdmin to docker-compose for PostgreSQL
- Add Mongo Express for MongoDB
- Add Redis Commander for Redis
- Add seed data scripts for local development (populate classification tables: moods, genres, events; sample content: books, films, games, songs)
- Improve local development experience

**Estimate:** 0.5 day (1 developer)

---

### 1.7. Graceful Shutdown & Infrastructure Reliability (0.5 day)

- Enable shutdown hooks in all NestJS services
- Handle SIGTERM gracefully
- Close database connections cleanly
- Flush metrics and logs before exit
- Fix circuit breaker threshold in `libs/backend/circuit-breaker`: currently opens on the first non-2xx response for a given URL. Set `volumeThreshold` (minimum calls before the breaker can open) and `errorThresholdPercentage` (% of failures required to open) on the Opossum options so transient 404s on individual URLs do not immediately block that route for all users

**Estimate:** 0.5 day (1 developer)

**Phase 1 Total:** 2-3 weeks

---

## Phase 2: Core Features (3-4 weeks)

### 2.1. File Uploads for Favorites (1-1.5 weeks)

**Backend Changes:**

- Create a new `file-service` microservice for file upload/download/delete
- Install multer, file validation libraries
- Configure file storage (local volumes or S3)
- Add file validation (size limits, MIME types)

**Frontend Changes:**

- Add file upload UI to favorites component
- Support drag-and-drop file upload
- Show uploaded files with preview/download buttons
- Display file metadata (size, type, upload date)

**Estimate:** 5-7 days (1 developer)

---

### 2.2. Real-time Notifications with WebSocket (1 week)

**Backend Changes:**

- Install @nestjs/websockets, socket.io
- Create notification-service or add to API Gateway
- Implement WebSocket gateway for real-time events
- Send notifications for: new suggestions, favorites added, system alerts, file upload progress and completion (from `file-service`)

**Frontend Changes:**

- Integrate Socket.io client
- Display toast/popup notifications

**Estimate:** 5-7 days (1 developer)

---

### 2.3. Kafka Event Streaming for Analytics (1-1.5 weeks)

**Backend Changes:**

- Install kafkajs, setup Kafka container in docker-compose
- Create Kafka producer in suggestion/favorite/history services
- Stream all user activity events (searches, favorites, views)
- Create analytics-service to consume events
- Store aggregated analytics in separate database

**Infrastructure:**

- Add Kafka + Zookeeper to docker-compose
- Configure topics, partitions, replication

**Note:** Each service owns its own database — cross-service ACID transactions are not used. Kafka enables eventual consistency as the alternative: events are published after a local commit and consumers update their own state independently.

**Estimate:** 7-10 days (1 developer)

---

### 2.4. Internationalization (i18n) — Multiple Languages (2-3 days)

Add multi-language support to the Angular frontend using `@angular/localize` for compile-time locale builds, or `ngx-translate` for runtime language switching without a full page reload.

**Recommended approach — `ngx-translate` (runtime):**

- Install `@ngx-translate/core` and `@ngx-translate/http-loader`
- Create `apps/frontend/src/assets/i18n/en.json`, `pl.json` (and additional locales as needed) with all UI strings as key-value pairs
- Configure `TranslateModule` in `app.config.ts` with `HttpBackend`-based loader
- Replace all hardcoded strings in templates with `{{ 'KEY' | translate }}` and in components with `TranslateService.instant('KEY')`
- Add a language switcher component (e.g. in the header) that calls `TranslateService.use('pl')`
- Persist the selected language to `localStorage` and restore it on app startup
- Update the error banner messages in `NotificationService` to use translated strings

**Alternative — `@angular/localize` (compile-time):**

- Generates a separate build artifact per locale (one bundle for `en`, one for `pl`, etc.)
- Nginx serves the correct bundle based on the URL prefix (`/en/`, `/pl/`) or `Accept-Language` header
- Stronger AOT optimisation but no runtime language switching — full page reload required
- Better fit if SEO per-language URL is a requirement

**Which to pick:** Prefer `ngx-translate` unless per-language URL paths are needed for SEO.

**Estimate:** 2-3 days (1 developer)

---

### 2.5. `UserSuggestionEntity.criteria` JSONB → FK columns refactor (1-2 days)

`criteria` is currently stored as `jsonb` with a fixed structure `{ mood, category, genre, event }` that references existing classification entities. This loses referential integrity (invalid values accepted silently) and prevents per-field indexing.

**Changes:**

- Replace `criteria: jsonb` with 4 FK columns: `@ManyToOne(() => MoodEntity)`, `@ManyToOne(() => GenreEntity)`, `@ManyToOne(() => EventEntity)`, `@Column() category: CategoryType`
- Write a data migration: read existing JSONB values, resolve entity IDs, write FK values
- Update suggestion engine logic to write FK columns instead of JSONB blob
- Add composite index on `(mood, genre, event, category)` for suggestion filtering

**Depends on:** Phase 1.1 migrations in place (data migration requires migration infrastructure)

**Estimate:** 1-2 days (1 developer)

---

### 2.6. Full-text search indexes for suggestion-service (0.5 day)

The `@Index()` decorators added in Phase 1.1 cover exact matches and prefix queries (`LIKE 'term%'`). Mid-string search (`ILIKE '%term%'`) requires a PostgreSQL GIN index with the `pg_trgm` extension.

**Changes:**

- Enable `pg_trgm` extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- Add GIN trigram indexes on `title` for `BookEntity`, `FilmEntity`, `GameEntity`, `SongEntity`
- Update suggestion queries to use `%term%` patterns with the new indexes

**Depends on:** Phase 1.1 migrations infrastructure; Phase 2.12 suggestion engine refactor

**Estimate:** 0.5 day (1 developer)

**Phase 2 Total:** 4-5.5 weeks

---

## Phase 3: Security Foundation (2 weeks)

### 3.1. RBAC Admin Role with Separate Admin UI + API (1-1.5 weeks)

**Backend Changes:**

- Add role field to UserEntity (user, admin)
- Create RoleGuard decorator for route protection
- Add `RoleGuard` to `GET /analytics/*` routes in `analytics-service` (Phase 2.3) — no new admin-service needed; the analytics REST API is already built there
- Protect analytics routes with admin role check

**Frontend Changes:**

- Create separate admin dashboard (new route /admin)
- Admin UI: user management, system analytics, activity logs
- Show admin menu only for admin users
- Charts/graphs for analytics visualization

**Consider:** System-wide broadcast alerts (e.g. "Scheduled maintenance in 10 minutes", "New feature available") via the WebSocket `notification-service` introduced in Phase 2.2. Admins would trigger alerts through the admin UI; `notification-service` would broadcast to all connected users (no userId filter — emit to all sockets instead of a specific room). Deferred here because Phase 2.2 has no admin trigger mechanism; revisit once the admin panel exists.

**Estimate:** 7-10 days (1 developer)

---

### 3.2. Secure JWT Storage with httpOnly Cookies (2-3 days)

Currently the Angular `UserService` holds the JWT only in memory — any full-page reload loses the session. This step is the permanent fix: move the token out of JavaScript entirely.

**Backend Changes:**

- Update auth-service to set JWT in httpOnly cookie on login/register response
- Configure cookie options (secure, sameSite, path)
- Update JWT extraction strategy to read from cookie instead of `Authorization` header

**Frontend Changes:**

- Remove in-memory `accessToken` / `userId` properties from `UserService` (no localStorage either — cookie is sent automatically by the browser)
- Remove `Authorization` header injection from `AuthInterceptor` (cookie is sent automatically)
- Enable `withCredentials: true` on all HTTP requests for cross-origin cookie support
- Handle CORS credentials on API gateway (`credentials: true`, explicit `origin`)

**WebSocket Impact (Phase 2.2):**

- `SocketService.connect(token)` in the frontend no longer passes the JWT in `auth.token` — the cookie is sent automatically on the WebSocket handshake when `withCredentials: true` is set (already configured in Phase 2.2)
- `WebSocketProxyGateway.handleConnection()` in `api-gateway` must extract the JWT from `client.handshake.headers.cookie` instead of `client.handshake.auth.token`

**Estimate:** 2-3 days (1 developer)

---

### 3.3. Supply Chain Security Scanner (1-2 days)

- Setup Snyk or Trivy in GitHub Actions
- Configure dependency scanning on every PR
- Add Docker image vulnerability scanning
- Setup alerts for critical vulnerabilities

**Estimate:** 1-2 days (1 developer)

---

### 3.4. Secrets Management (1-2 days)

- Replace hardcoded credentials in docker-compose.yml
- Use Docker Secrets or environment variable files
- Document production secrets setup
- Add .env.production template to .gitignore

**Estimate:** 1-2 days (1 developer)

---

### 3.5. SSL/TLS Configuration (1-2 days)

- Generate SSL certificates (Let's Encrypt or self-signed)
- Configure Nginx reverse proxy with HTTPS
- Update docker-compose with SSL configuration
- Redirect HTTP to HTTPS

**Estimate:** 1-2 days (1 developer)

---

### 3.6. Virus Scanning with ClamAV (1 day)

Adds ClamAV antivirus scanning to `file-service` as an optional layer on top of the magic bytes + MIME allowlist validation already in place from Phase 2.1. Scanning is opt-in via environment variable so it can be disabled locally without slowing down dev startup.

**Infrastructure:**

- Add `clamav/clamav` container to `infrastructure/docker-compose.yml`; expose `clamd` daemon on port 3310
- Add health check — `clamd` is ready only after `freshclam` downloads virus definitions (~30-60s on first start)
- `file-service` depends on `clamav` only when `ENABLE_AV_SCAN=true`
- Add `clamav` to `infrastructure/docker-compose.dev.yml` (or as a separate profile) so it starts only when explicitly requested

**`file-service` changes:**

- Install `node-clamscan`
- In `FileService.upload()`, after magic bytes validation, before `repo.save()` (file is already on disk at `file.path` via `ProgressDiskStorage`):
  ```typescript
  if (this.configService.get('ENABLE_AV_SCAN') === 'true') {
    const { isInfected, viruses } = await this.clamscan.scanBuffer(file.buffer);
    if (isInfected) {
      throw new BadRequestException(`File rejected: ${viruses.join(', ')}`);
    }
  }
  ```
- `ClamScan` instance configured with `clamd` host/port from env vars (`CLAMD_HOST`, `CLAMD_PORT`)
- After a scan rejection, call `gateway.emitToUser(userId, 'upload-error', { fileId, error: 'File rejected by virus scanner' })` so the frontend shows a toast — `AppComponent`'s `upload-error` handler (Phase 2.2) already covers this; throw the `BadRequestException` after emitting

**Environment variables:**

| Variable         | Dev default | Prod default |
| ---------------- | ----------- | ------------ |
| `ENABLE_AV_SCAN` | `false`     | `true`       |
| `CLAMD_HOST`     | `clamav`    | `clamav`     |
| `CLAMD_PORT`     | `3310`      | `3310`       |

**Definition updates:** `freshclam` runs inside the `clamav/clamav` container automatically and updates definitions daily. In production, ensure the container has outbound internet access to `database.clamav.net`.

**Estimate:** 1 day (1 developer)

**Phase 3 Total:** 3-5 weeks

---

## Phase 4: Testing Infrastructure (2 weeks)

### 4.1. Playwright E2E Testing — Frontend + Backend (4-6 days)

Playwright covers two layers:

**Frontend E2E (browser automation):**

- Open browser → visit login page → fill form → click Login → assert dashboard appears
- Search flow: type query → results appear → click item → detail page loads
- Favorites flow: add favorite → appears in list → remove → gone from list
- Visual regression testing (screenshot diffs)

**Backend API E2E (full stack, no browser):**

- All services running via docker-compose (or a test compose profile)
- Playwright’s `request` context sends HTTP calls through the full stack: Client → Gateway → Service → DB
- Tests the complete chain: auth middleware, proxy routing, inter-service communication via RabbitMQ
- Covers api-gateway scenarios excluded from Phase 0.3 integration tests

**Setup:**

- Playwright already scaffolded at `test/e2e/frontend/` with `playwright.config.mts`
- Add `test/e2e/backend-api/` for Playwright API tests
- Configure CI/CD to run both suites

**Estimate:** 4-6 days (1 developer)

---

### 4.2. BDD/Cucumber Framework (3-5 days)

- Install cucumber, @cucumber/cucumber
- Create feature files for user stories
- Write step definitions for scenarios
- Integrate with Playwright tests

**Estimate:** 3-5 days (1 developer)

---

### 4.3. Backend Integration Tests (1-2 days)

Test each NestJS service in isolation with real infrastructure — verify both HTTP response and database side effects, with no external docker-compose required.

**Approach:** Jest + Supertest + Testcontainers

- Testcontainers starts real Docker containers (Postgres / MongoDB / Redis / RabbitMQ) per test run
- NestJS Testing Module boots the service in-process connected to those containers
- Supertest sends HTTP requests to the in-process server
- Tests assert HTTP response **and** actual DB state (row exists, Redis key written, etc.)

**Per service:**

- **auth-service** — register → assert Postgres row; login → JWT; logout → assert Redis blacklist
- **suggestion-service** — list with seeded data; filter by category; assert Redis cache hit
- **favorite-service** — full CRUD with Postgres row assertions after each mutation
- **history-service** — publish `suggestion_created` to RabbitMQ → assert MongoDB document created
- **api-gateway** — excluded (requires all downstream services; covered by Playwright E2E)

**Test location:** `test/integration/{service}/src/*.integration.spec.ts`

**Packages:** `supertest`, `@types/supertest`, `testcontainers`, `@testcontainers/postgresql`, `@testcontainers/mongodb`, `@testcontainers/redis`, `@testcontainers/rabbitmq`

**Estimate:** 1-2 days (1 developer)

---

### 4.4. Coverage Thresholds Configuration (0.5 day)

- Configure Jest coverage collection in all services
- Set minimum coverage thresholds (70% branches, functions, lines)
- Generate LCOV reports for SonarQube
- Add coverage exclusions for test files

**Estimate:** 0.5 day (1 developer)

---

### 4.5. SonarQube Integration (2-3 days)

- Setup SonarQube server (Docker or cloud)
- Configure sonar-scanner in GitHub Actions
- Integrate coverage reports from Jest
- Set quality gates (code coverage, bugs, vulnerabilities)
- Fix critical code smells

**Estimate:** 2-3 days (1 developer)

---

### 4.6. Commit Message Linting — commitlint (0.5 day)

- Install `@commitlint/cli` and `@commitlint/config-conventional`
- Configure conventional commit format (`feat:`, `fix:`, `chore:`, `docs:`, etc.)
- Add `commit-msg` Husky hook to enforce format on every local commit
- Add commitlint check to GitHub Actions CI so PRs with non-conforming messages fail the build
- Document commit message format in `CONTRIBUTING.md` or `MIGRATIONS.md`

**Depends on:** Phase 0.6 (Husky already installed)

**Estimate:** 0.5 day (1 developer)

**Phase 4 Total:** 2.5-3.5 weeks

---

## Phase 5: Advanced Features (2-3 weeks)

### 5.1. GraphQL Layer for Favorites/Suggestions (1-1.5 weeks)

- Install @nestjs/graphql, apollo-server
- Create GraphQL schemas for Favorite, Suggestion
- Implement resolvers with queries/mutations
- Add DataLoader for N+1 query optimization
- Frontend: integrate Apollo Client

**Estimate:** 5-7 days (1 developer)

---

### 5.2. AI Chatbot Assistant (1-1.5 weeks)

- Integrate OpenAI API or similar LLM service
- Create chatbot-service with conversation endpoints
- Implement context-aware suggestions based on chat
- Frontend: chat UI component with message history

**Estimate:** 7-10 days (1 developer)

**Phase 5 Total:** 2-3 weeks

---

## Phase 6: DevOps & Deployment (2-2.5 weeks)

### 6.1. Database Backup & Restore Strategy (1-2 days)

- Configure automated PostgreSQL backups
- Setup MongoDB backup automation
- Document restore procedures
- Test disaster recovery process
- Define RTO/RPO targets

**Estimate:** 1-2 days (1 developer)

---

### 6.2. Terraform IaC (1 week)

- Write Terraform configs for AWS/GCP/Azure:
  - EC2/Compute instances for services
  - RDS for PostgreSQL
  - DocumentDB/MongoDB Atlas
  - ElastiCache for Redis
  - Load balancers
- Setup separate environments (dev, staging, prod)
- **Decide production file storage backend** — the local Docker volume used in Phase 2.1 (File Uploads) does not survive in multi-instance or managed container environments (ECS, Fargate, Kubernetes). Provision S3/GCS/Azure Blob or a shared network filesystem (e.g. EFS on AWS); update `FileService` in `file-service` to use the chosen SDK
- **WebSocket horizontal scaling (Phase 2.2)** — the proxy pattern in `WebSocketProxyGateway` works on a single `api-gateway` instance. When `api-gateway` scales horizontally, add the Socket.IO Redis adapter (`@socket.io/redis-adapter`) to `notification-service` and all gateway replicas so room membership is shared across instances
- **upload-progress throttling (Phase 2.2)** — `ProgressDiskStorage` currently emits one RabbitMQ message per chunk. For large files this is high-frequency. Throttle in `file-service` by only calling `emitToUser` when `Math.floor(percent / 5)` changes (every 5% increment) — a `file-service`-only change, no other services affected
- **Kafka `user.activity` retention (Phase 2.3)** — set `retention.ms` on the `user.activity` topic to match your analytics needs (e.g. `259200000` = 3 days). Since `analytics-service` writes every event to PostgreSQL immediately, Kafka is a transport only — short retention is safe. Do not apply log compaction to this topic; compaction keeps only the latest message per key (`userId`), which would destroy the event log. Configure via MSK topic settings or `kafka-topics.sh --alter` on self-hosted clusters

**Estimate:** 5-7 days (1 developer)

---

### 6.3. Frontend Production Build Configuration (0.5 day)

Wire Angular environment files so the frontend can point at the correct API gateway URL per environment without requiring a code change.

**Steps:**

- Complete `apps/frontend/src/environments/environment.prod.ts` — set `apiBaseUrl` to the real production gateway URL (stub already created in Phase 1.5)
- Add `fileReplacements` to the `production` configuration in `apps/frontend/project.json` so `environment.ts` is swapped for `environment.prod.ts` at build time
- Update `createTsRestClient` in `apps/frontend/src/app/ts-rest-client.ts` to import `apiBaseUrl` from `environment.ts` instead of using the hardcoded default `'http://localhost:3000/v1'`
- Decide production URL strategy: direct absolute URL (`https://api.yourdomain.com/v1`) or Nginx reverse-proxy at `/v1` (requires custom Nginx config in `infrastructure/Dockerfile.frontend`)
- If using Nginx proxy: add `/v1` → `http://api-gateway:3000/v1` `proxy_pass` block to the Nginx config inside the frontend Docker image so the browser never needs a cross-origin URL in production

**Note:** `environment.ts` (dev) stays as `http://localhost:3000/v1` — local dev and Docker both expose the gateway on host port 3000 so this works for both.

**Estimate:** 0.5 day (1 developer)

---

### 6.4. Production Deployment (3-5 days)

- Setup CI/CD pipeline (GitHub Actions)
- Configure automated testing before deploy
- Setup monitoring and alerting
- Database migration strategy
- Add migration CI gate: run `migration:show` in CI pipeline and fail the build if any pending migrations exist that are not in the current deployment artifact (prevents schema drift between code and DB)
- Blue-green or canary deployment
- **Verify file storage backend is configured** — confirm the S3/GCS/EFS decision from Phase 6.2 is wired into the `file-service` deployment (env vars, IAM roles/service accounts, bucket policy)

**Estimate:** 3-5 days (1 developer)

**Phase 6 Total:** 2.5-3 weeks

---

## Overall Timeline Summary

| Phase                             | Duration      | Dependencies              |
| --------------------------------- | ------------- | ------------------------- |
| **Phase 0: Technical Debt**       | 1-1.5 weeks   | None (start immediately)  |
| **Phase 1: Developer Experience** | 2-3 weeks     | After Phase 0             |
| **Phase 2: Core Features**        | 4-5.5 weeks   | After Phase 1             |
| **Phase 3: Security**             | 2.5-4 weeks   | After Phase 2             |
| **Phase 4: Testing**              | 2.5-3.5 weeks | Can overlap with Phase 3  |
| **Phase 5: Advanced**             | 2-3 weeks     | After Phase 3 & 4         |
| **Phase 6: Deployment**           | 2-2.5 weeks   | After all phases complete |

**Total Project Duration:** 15-19 weeks (~4-5 months)

**With 1 developer:** 15-19 weeks sequential
**With 2 developers:** 9-12 weeks (parallel work)
**With 3 developers:** 8-10 weeks (parallel work)

---

## Critical Path

1. **Phase 0.1:** Nx setup (foundation for shared libraries)
2. **Phase 0.2:** Package updates (Angular 22, Vitest, TypeScript 6) - enables modern tooling
3. **Phase 0.3:** Restructure infrastructure folder (move infrastructure to root)
4. **Phase 0.6:** Pre-commit hooks (enforce code quality from start)
5. **Phase 0.5:** Extract shared libraries (reduce duplication)
6. **Phase 1:** Database migrations (required before production deployment)
7. **Phase 1:** Structured logging (foundation for request/response logging)
8. **Phase 1:** API contract with ts-rest (enables type-safe frontend/backend communication)
9. **Phase 2:** File uploads (foundational feature)
10. **Phase 2:** WebSocket notifications (depends on file uploads for upload notifications)
11. **Phase 2:** Kafka streaming (requires stable event sources)
12. **Phase 3:** Secrets management (required before SSL/TLS)
13. **Phase 3:** RBAC + Admin UI (required before advanced analytics)
14. **Phase 4:** Coverage + SonarQube (can run parallel with Phase 3)
15. **Phase 6:** Deployment (final phase)

---

## Risk Factors

- **Nx migration:** First-time monorepo tooling setup may require learning curve
- **Package updates (Phase 0.2):** Angular 18→22 and TypeScript 5→6 are major version jumps with potential breaking changes
- **Vitest migration:** Moving from Karma/Jasmine to Vitest may require test syntax updates
- **Shared library coupling:** Balance between DRY and microservice independence
- **ts-rest adoption:** New paradigm (contract-first) requires team buy-in and learning
- **Zod schema validation:** Team needs to learn Zod for runtime validation
- **Database migrations:** Existing data migration requires careful planning
- **Structured logging adoption:** Team must adapt to new logging patterns early in project
- **Pre-commit hooks enforcement:** May slow down initial development if hooks are strict
- **Kafka complexity:** First-time Kafka setup may take longer
- **AI chatbot:** LLM API costs and rate limits
- **Terraform:** Cloud provider-specific learning curve
- **SSL/TLS:** Certificate management in production
- **Backup/restore testing:** Disaster recovery testing may uncover data issues

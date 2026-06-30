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
- Upgrade all @angular/* packages to v22.0.4
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

### 0.3. Rewrite Backend E2E Tests (0.5 days)
**Current state:** All 5 backend e2e spec files (`test/e2e/*/src/**/*.spec.ts`) contain identical Nx-generated placeholder tests (`GET /api → { message: 'Hello API' }`). They don't test actual service endpoints and can't pass without real infrastructure running.

**What to do:**
- Replace placeholder specs with real integration tests for each service's actual endpoints:
  - **auth-service-e2e** — register, login, logout, token refresh flows
  - **suggestion-service-e2e** — get suggestions by mood/category/genre
  - **favorite-service-e2e** — add, list, filter, remove favorites
  - **history-service-e2e** — create and retrieve suggestion history entries
  - **api-gateway-e2e** — proxy routing, auth middleware, health check
- Decide on test environment strategy: Docker Compose test profile or in-memory stubs
- Update `dependsOn` in each e2e `project.json` once serve dependencies are stable

**Estimate:** 0.5 day (1 developer)

---

### 0.4. Restructure Infrastructure Folder (0.5 day)
- Move `backend/infrastructure/` to root `infrastructure/`
- Update docker-compose paths and CI/CD references
- Infrastructure orchestrates entire system, not just backend

**Estimate:** 0.5 day (1 developer)

---

### 0.5. Fix RxJS Duplication Hack (0.5 day)
- Remove `backend/scripts/remove-duplicate-rxjs.js` hack script
- Move RxJS to root backend/package.json with overrides
- Let Nx/npm handle dependency deduplication properly

**Estimate:** 0.5 day (1 developer)

---

### 0.6. Extract Infrastructure Modules to Shared Libraries (2-3 days)
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

### 0.7. Pre-commit Hooks (0.5 day)
- Install Husky + lint-staged
- Run ESLint + Prettier on git commit
- Run tests before push
- Enforce code quality before commits

**Estimate:** 0.5 day (1 developer)

**Phase 0 Total:** 1-1.5 weeks

---

## Phase 1: Developer Experience & Foundations (2-3 weeks)

### 1. Database Migrations Setup (2-3 days)
- Setup TypeORM migrations for all PostgreSQL services
- Create migration scripts (generate, run, revert)
- Replace `synchronize: true` with proper migrations
- Document migration workflow

**Estimate:** 2-3 days (1 developer)

---

### 2. Structured Logging with Correlation IDs (2-3 days)
- Replace NestJS Logger with Winston or Pino
- Implement JSON structured logging
- Add correlation ID middleware for distributed tracing
- Track requests across microservices

**Estimate:** 2-3 days (1 developer)

---

### 3. Request/Response Logging Middleware (1 day)
- Add request/response interceptors using structured logger
- Log request body, response, duration
- Mask sensitive fields (passwords, tokens)
- Add audit trail for debugging

**Estimate:** 1 day (1 developer)

---

### 4. Swagger/OpenAPI Documentation (1-2 days)
- Install @nestjs/swagger in all services
- Add decorators to controllers and DTOs
- Generate OpenAPI spec automatically
- Expose Swagger UI at /api endpoint in each service

**Estimate:** 1-2 days (1 developer)

---

### 5. API Contract with ts-rest (2-3 days)
- Install @ts-rest/core, @ts-rest/nest, @ts-rest/angular, @ts-rest/open-api, zod
- Create libs/shared/contract for API contracts
- Define contracts with Zod schemas for all endpoints (auth, suggestions, favorites, history)
- Implement ts-rest handlers in all backend services
- Generate OpenAPI spec from ts-rest contracts (enhances Swagger documentation)
- Integrate ts-rest client in Angular frontend for type-safe API calls
- Keep both: Swagger UI for documentation, ts-rest for type safety

**Estimate:** 2-3 days (1 developer)

---

### 6. Development Tools (0.5 day)
- Add pgAdmin to docker-compose for PostgreSQL
- Add Mongo Express for MongoDB
- Add Redis Commander for Redis
- Improve local development experience

**Estimate:** 0.5 day (1 developer)

---

### 7. Graceful Shutdown (0.5 day)
- Enable shutdown hooks in all NestJS services
- Handle SIGTERM gracefully
- Close database connections cleanly
- Flush metrics and logs before exit

**Estimate:** 0.5 day (1 developer)

**Phase 1 Total:** 2-3 weeks

---

## Phase 2: Core Features (3-4 weeks)

### 8. File Uploads for Favorites (1-1.5 weeks)
**Backend Changes:**
- Install multer, file validation libraries
- Extend FavoriteEntity with file metadata fields (filePath, mimeType, fileSize)
- Create file upload/download endpoints in favorite-service
- Configure file storage (local volumes or S3)
- Add file validation (size limits, MIME types)

**Frontend Changes:**
- Add file upload UI to favorites component
- Support drag-and-drop file upload
- Show uploaded files with preview/download buttons
- Display file metadata (size, type, upload date)

**Estimate:** 5-7 days (1 developer)

---

### 9. Real-time Notifications with WebSocket (1 week)
**Backend Changes:**
- Install @nestjs/websockets, socket.io
- Create notification-service or add to API Gateway
- Implement WebSocket gateway for real-time events
- Send notifications for: new suggestions, favorites added, system alerts

**Frontend Changes:**
- Integrate Socket.io client
- Display toast/popup notifications
- Show notification badge/counter in header
- Add notification center UI

**Estimate:** 5-7 days (1 developer)

---

### 10. Kafka Event Streaming for Analytics (1-1.5 weeks)
**Backend Changes:**
- Install kafkajs, setup Kafka container in docker-compose
- Create Kafka producer in suggestion/favorite/history services
- Stream all user activity events (searches, favorites, views)
- Create analytics-service to consume events
- Store aggregated analytics in separate database

**Infrastructure:**
- Add Kafka + Zookeeper to docker-compose
- Configure topics, partitions, replication

**Estimate:** 7-10 days (1 developer)

**Phase 2 Total:** 3.5-5 weeks

---

## Phase 3: Security Foundation (2 weeks)

### 11. RBAC Admin Role with Separate Admin UI + API (1-1.5 weeks)
**Backend Changes:**
- Add role field to UserEntity (user, admin)
- Create RoleGuard decorator for route protection
- Create admin-service with analytics endpoints (user stats, system metrics)
- Protect analytics routes with admin role check

**Frontend Changes:**
- Create separate admin dashboard (new route /admin)
- Admin UI: user management, system analytics, activity logs
- Show admin menu only for admin users
- Charts/graphs for analytics visualization

**Estimate:** 7-10 days (1 developer)

---

### 12. Secure JWT Storage with httpOnly Cookies (2-3 days)
**Backend Changes:**
- Update auth-service to set JWT in httpOnly cookie
- Configure cookie options (secure, sameSite)
- Update JWT extraction strategy

**Frontend Changes:**
- Remove localStorage JWT storage
- Update interceptors to rely on cookies
- Handle CORS credentials

**Estimate:** 2-3 days (1 developer)

---

### 13. Supply Chain Security Scanner (1-2 days)
- Setup Snyk or Trivy in GitHub Actions
- Configure dependency scanning on every PR
- Add Docker image vulnerability scanning
- Setup alerts for critical vulnerabilities

**Estimate:** 1-2 days (1 developer)

---

### 14. Secrets Management (1-2 days)
- Replace hardcoded credentials in docker-compose.yml
- Use Docker Secrets or environment variable files
- Document production secrets setup
- Add .env.production template to .gitignore

**Estimate:** 1-2 days (1 developer)

---

### 15. SSL/TLS Configuration (1-2 days)
- Generate SSL certificates (Let's Encrypt or self-signed)
- Configure Nginx reverse proxy with HTTPS
- Update docker-compose with SSL configuration
- Redirect HTTP to HTTPS

**Estimate:** 1-2 days (1 developer)

**Phase 3 Total:** 2.5-4 weeks

---

## Phase 4: Testing Infrastructure (2 weeks)

### 16. Playwright E2E Testing (3-4 days)
- Install Playwright, configure for frontend
- Write E2E tests for critical flows: login, search, favorites
- Configure CI/CD pipeline to run Playwright tests
- Setup visual regression testing

**Estimate:** 3-4 days (1 developer)

---

### 17. BDD/Cucumber Framework (3-5 days)
- Install cucumber, @cucumber/cucumber
- Create feature files for user stories
- Write step definitions for scenarios
- Integrate with Playwright tests

**Estimate:** 3-5 days (1 developer)

---

### 18. Coverage Thresholds Configuration (0.5 day)
- Configure Jest coverage collection in all services
- Set minimum coverage thresholds (70% branches, functions, lines)
- Generate LCOV reports for SonarQube
- Add coverage exclusions for test files

**Estimate:** 0.5 day (1 developer)

---

### 19. SonarQube Integration (2-3 days)
- Setup SonarQube server (Docker or cloud)
- Configure sonar-scanner in GitHub Actions
- Integrate coverage reports from Jest
- Set quality gates (code coverage, bugs, vulnerabilities)
- Fix critical code smells

**Estimate:** 2-3 days (1 developer)

**Phase 4 Total:** 1.5-2.5 weeks

---

## Phase 5: Advanced Features (2-3 weeks)

### 20. GraphQL Layer for Favorites/Suggestions (1-1.5 weeks)
- Install @nestjs/graphql, apollo-server
- Create GraphQL schemas for Favorite, Suggestion
- Implement resolvers with queries/mutations
- Add DataLoader for N+1 query optimization
- Frontend: integrate Apollo Client

**Estimate:** 5-7 days (1 developer)

---

### 21. AI Chatbot Assistant (1-1.5 weeks)
- Integrate OpenAI API or similar LLM service
- Create chatbot-service with conversation endpoints
- Implement context-aware suggestions based on chat
- Frontend: chat UI component with message history

**Estimate:** 7-10 days (1 developer)

**Phase 5 Total:** 2-3 weeks

---

## Phase 6: DevOps & Deployment (2-2.5 weeks)

### 21. Database Backup & Restore Strategy (1-2 days)
- Configure automated PostgreSQL backups
- Setup MongoDB backup automation
- Document restore procedures
- Test disaster recovery process
- Define RTO/RPO targets

**Estimate:** 1-2 days (1 developer)

---

### 22. Terraform IaC (1 week)
- Write Terraform configs for AWS/GCP/Azure:
  - EC2/Compute instances for services
  - RDS for PostgreSQL
  - DocumentDB/MongoDB Atlas
  - ElastiCache for Redis
  - Load balancers
- Setup separate environments (dev, staging, prod)

**Estimate:** 5-7 days (1 developer)

---

### 23. Production Deployment (3-5 days)
- Setup CI/CD pipeline (GitHub Actions)
- Configure automated testing before deploy
- Setup monitoring and alerting
- Database migration strategy
- Blue-green or canary deployment

**Estimate:** 3-5 days (1 developer)

**Phase 6 Total:** 2-2.5 weeks

---

## Overall Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| **Phase 0: Technical Debt** | 1-1.5 weeks | None (start immediately) |
| **Phase 1: Developer Experience** | 2-3 weeks | After Phase 0 |
| **Phase 2: Core Features** | 3.5-5 weeks | After Phase 1 |
| **Phase 3: Security** | 2.5-4 weeks | After Phase 2 |
| **Phase 4: Testing** | 1.5-2.5 weeks | Can overlap with Phase 3 |
| **Phase 5: Advanced** | 2-3 weeks | After Phase 3 & 4 |
| **Phase 6: Deployment** | 2-2.5 weeks | After all phases complete |

**Total Project Duration:** 15-19 weeks (~4-5 months)

**With 1 developer:** 15-19 weeks sequential
**With 2 developers:** 9-12 weeks (parallel work)
**With 3 developers:** 8-10 weeks (parallel work)

---

## Critical Path
1. **Phase 0.1:** Nx setup (foundation for shared libraries)
2. **Phase 0.2:** Package updates (Angular 22, Vitest, TypeScript 6) - enables modern tooling
3. **Phase 0.3:** Backend e2e test rewrite (replace placeholder scaffolding with real tests)
4. **Phase 0.7:** Pre-commit hooks (enforce code quality from start)
5. **Phase 0.6:** Extract shared libraries (reduce duplication)
4. **Phase 1:** Database migrations (required before production deployment)
5. **Phase 1:** Structured logging (foundation for request/response logging)
6. **Phase 1:** API contract with ts-rest (enables type-safe frontend/backend communication)
7. **Phase 2:** File uploads (foundational feature)
8. **Phase 2:** WebSocket notifications (depends on file uploads for upload notifications)
9. **Phase 2:** Kafka streaming (requires stable event sources)
10. **Phase 3:** Secrets management (required before SSL/TLS)
11. **Phase 3:** RBAC + Admin UI (required before advanced analytics)
12. **Phase 4:** Coverage + SonarQube (can run parallel with Phase 3)
13. **Phase 6:** Deployment (final phase)

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

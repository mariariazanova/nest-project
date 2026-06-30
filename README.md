# Suggestify

A production-ready microservices-based recommendation system that provides personalized suggestions for films, books, songs, and games
based on user criteria such as mood, genre, and events. Built with NestJS and Angular 22, featuring comprehensive monitoring,
caching, event-driven architecture, and fault tolerance.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Service Communication](#service-communication)
- [Security Features](#security-features)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [Testing with Postman](#testing-with-postman)
- [Monitoring](#monitoring)
- [API Documentation](#api-documentation)
- [Frontend Application](#frontend-application)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Overview

Suggestify is a distributed system designed to provide intelligent content recommendations across multiple categories.
The system uses a microservices architecture with the following key features:

- **Basic Microservice Creation**: Independent, single-responsibility services with NestJS framework
- **Data Persistence and Caching**: PostgreSQL + MongoDB database integration for reliable data storage, cache enabled
- **Service Discovery Integration**: Automatic service registration and discovery (using Consul) for dynamic scaling
- **API Gateway Setup**: Centralized routing and request handling through single entry point
- **Inter-Service Communication**: RabbitMQ-based communication between microservices
- **Containerize Microservices**: Docker containerization for consistent deployment environments
- **Centralized Configuration**: Environment-based configuration management across all services
- **Authentication and Authorization**: JWT-based secure user authentication and authorization
- **Resilience and Fault Tolerance**: Error handling and graceful degradation mechanisms
- **Load Balancing**: Traffic distribution across multiple service instances
- **Microservices Testing**: Comprehensive Postman collection for integration testing
- **Monitoring and Logging**: Prometheus metrics, health checks and Grafana dashboards for system observability

## Architecture

The system consists of 5 microservices orchestrated through an API Gateway, with supporting infrastructure for caching,
messaging, service discovery, and monitoring:

```
                    ┌─────────────────┐
                    │   API Gateway   │  Port :3000
                    │  (Entry Point)  │  Rate Limiting, CORS, Auth
                    └────────┬────────┘
                             │
       ┌─────────────────────┼─────────────────────┬────────────────┐
       │                     │                     │                │
   ┌───▼─────┐         ┌─────▼──────┐      ┌──────▼─────┐   ┌─────▼────┐
   │   Auth  │         │ Suggestion │      │  History   │   │ Favorite │
   │ Service │         │  Service   │      │  Service   │   │ Service  │
   │  :3001  │         │   :3002    │      │   :3003    │   │  :3004   │
   └───┬─────┘         └─────┬──────┘      └──────┬─────┘   └─────┬────┘
       │                     │                     │               │
       │                     │                     │               │
   ┌───▼──────┐       ┌──────▼────────┐     ┌─────▼──────┐  ┌────▼────────┐
   │PostgreSQL│       │   PostgreSQL  │     │  MongoDB   │  │ PostgreSQL  │
   │ auth_db  │       │suggestions_db │     │ history_db │  │favorites_db │
   └──────────┘       └───────────────┘     └────────────┘  └─────────────┘

Infrastructure Components:
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────────┐   ┌──────────┐
│  Redis   │   │ RabbitMQ │   │  Consul  │   │ Prometheus │   │ Grafana  │
│ (Cache)  │   │ (Queue)  │   │(Service  │   │ (Metrics)  │   │(Dashboard)
│          │   │          │   │Discovery)│   │            │   │  :3050   │
└──────────┘   └──────────┘   └──────────┘   └────────────┘   └──────────┘
```

### Frontend Application
```
┌─────────────────────────────┐
│   Angular 22 Frontend       │
│   Port: 4200 (dev)          │
│   Standalone Components     │
│   Nginx (production)        │
└─────────────────────────────┘
         │
         ▼
   API Gateway :3000
```


### Service Details

| Service | Port | Database | Technology | Description |
|---------|------|----------|------------|-------------|
| **API Gateway** | 3000 | - | NestJS | Central routing, rate limiting (100 req/min), CORS, auth enforcement |
| **Auth Service** | 3001 | PostgreSQL (auth_db) | NestJS + TypeORM | User registration, login, JWT tokens, profile management |
| **Suggestion Service** | 3002 | PostgreSQL (suggestions_db) | NestJS + TypeORM + Redis | Content recommendations with caching (films, books, songs, games) |
| **History Service** | 3003 | MongoDB (history_db) | NestJS + Mongoose | User interaction tracking, analytics, and statistics |
| **Favorite Service** | 3004 | PostgreSQL (favorites_db) | NestJS + TypeORM | User favorites management across all categories |

### Infrastructure Services

| Component | Port | Purpose |
|-----------|------|---------|
| **Redis** | 6379 | Distributed caching (30min-1hr TTL) |
| **RabbitMQ** | 5672, 15672 | Async inter-service messaging, event-driven architecture |
| **Consul** | 8500 | Service discovery and health check aggregation |
| **Prometheus** | 9090 | Metrics collection (15s interval) |
| **Grafana** | 3050 | Monitoring dashboards and visualization |

## Technology Stack

### Backend Technologies
- **Framework**: NestJS (Node.js/TypeScript)
- **Language**: TypeScript with strict mode
- **ORM**: TypeORM (PostgreSQL databases)
- **ODM**: Mongoose (MongoDB)
- **Authentication**: JWT with Passport.js
- **Password Security**: bcrypt (salt rounds: 10)
- **Caching**: Redis + cache-manager (30min-1hr TTL)
- **Message Broker**: RabbitMQ (AMQP protocol)
- **Service Discovery**: HashiCorp Consul
- **Circuit Breaker**: Opossum (fault tolerance)
- **Rate Limiting**: NestJS Throttler (100 req/min)
- **Validation**: class-validator with DTOs
- **Testing**: Jest + ts-jest (unit tests) + Supertest (e2e tests)
- **API Testing**: Postman collection with automated flows

### Frontend Technologies
- **Framework**: Angular 22
- **Architecture**: Standalone components (no NgModules), built-in control flow (`@if`, `@for`)
- **Language**: TypeScript
- **State Management**: Angular Signals, `inject()` function
- **HTTP Client**: Angular HttpClient with interceptors
- **Async Operations**: RxJS
- **Styling**: SCSS
- **Testing**: Vitest 4 with `@angular/build:unit-test` executor
- **Web Server**: Nginx (production)

### Databases
- **PostgreSQL 15**: Auth, Suggestion, Favorite services
- **MongoDB 7**: History service with indexed queries
- **Redis 7**: Distributed caching layer

### DevOps & Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose
- **Monitoring**: Prometheus metrics + Grafana dashboards
- **Health Checks**: HTTP endpoints with retry logic
- **Base Images**: Node.js 20-alpine (optimized for size)
- **Process Manager**: dumb-init (proper signal handling)

### Architectural Patterns
- **RESTful API Architecture**: Resource-oriented design with standard HTTP methods (GET, POST, PUT, DELETE)
- **Microservices Architecture**: Independent, single-responsibility services
- **API Gateway Pattern**: Centralized entry point with routing
- **Event-Driven Architecture**: RabbitMQ for async communication
- **Circuit Breaker Pattern**: Opossum for fault tolerance
- **Repository Pattern**: Data access abstraction
- **Dependency Injection**: NestJS IoC container
- **CQRS**: Separation of read/write operations in History service

## Project Structure

```
suggestify-microservices/
├── .github/
│   └── workflows/
│       └── angular-test.yml                     # GitHub Actions CI for frontend
│
├── backend/
│   ├── infrastructure/
│   │   ├── docker-compose.yml                   # Main orchestration file
│   │   └── monitoring/
│   │       └── provisioning/
│   │           ├── dashboards/                  # Grafana dashboards (JSON)
│   │           │   ├── request-rate.json
│   │           │   ├── error-rate.json
│   │           │   ├── correct-rate.json
│   │           │   └── P95-latency.json
│   │           └── prometheus/
│   │               └── prometheus.yml           # Prometheus config
│   │
│   ├── postman/
│   │   └── suggestify.postman_collection.json   # RESTful API tests with HATEOAS
│   │
│   ├── scripts/                                 # Utility scripts
│   │   ├── health-check.sh                      # Health check automation
│   │   ├── remove-duplicate-rxjs.js             # Dependency cleanup
│   │   └── stop-and-reset.js                    # Docker cleanup script
│   │
│   ├── services/                                # All services follow NestJS structure
│   │   │                                        # Each service contains:
│   │   │                                        # - Dockerfile, package.json, tsconfig.json
│   │   │                                        # - .env.example, .eslintrc.js, .prettierrc
│   │   │                                        # - nest-cli.json, jest.config.json
│   │   │                                        # - test/ directory for E2E tests
│   │   │
│   │   ├── api-gateway/                         # API Gateway (Port 3000)
│   │   │   └── src/
│   │   │       ├── clients/                     # HTTP clients for microservices
│   │   │       ├── health/                      # Health check endpoint
│   │   │       ├── infrastructure/
│   │   │       │   ├── circuit-breaker/         # Opossum configuration
│   │   │       │   ├── consul/                  # Service discovery
│   │   │       │   └── metrics/                 # Prometheus metrics
│   │   │       ├── interceptors/
│   │   │       │   └── response.interceptor.ts  # HATEOAS envelope wrapper
│   │   │       ├── middleware/                  # Auth middleware
│   │   │       ├── proxy/                       # Proxy controller
│   │   │       ├── app.module.ts
│   │   │       └── main.ts                      # Entry point with /v1 prefix
│   │   │
│   │   ├── auth-service/                        # Authentication (Port 3001)
│   │   │   └── src/
│   │   │       ├── auth/
│   │   │       │   ├── dto/                     # SignUpDto, LoginDto
│   │   │       │   ├── guards/                  # JwtAuthGuard
│   │   │       │   ├── strategies/              # JWT strategy
│   │   │       │   ├── token-blacklist/         # Logout token management
│   │   │       │   ├── auth.controller.ts       # RESTful endpoints
│   │   │       │   ├── auth.service.ts
│   │   │       │   └── auth.module.ts
│   │   │       ├── users/
│   │   │       │   ├── entities/
│   │   │       │   │   └── user.entity.ts       # TypeORM entity
│   │   │       │   ├── users.repository.ts
│   │   │       │   └── users.module.ts
│   │   │       ├── health/                      # Health check
│   │   │       ├── infrastructure/
│   │   │       │   ├── circuit-breaker/
│   │   │       │   ├── consul/
│   │   │       │   └── metrics/
│   │   │       ├── app.module.ts
│   │   │       └── main.ts
│   │   │
│   │   ├── suggestion-service/                  # Recommendations (Port 3002)
│   │   │   └── src/
│   │   │       ├── suggestion/
│   │   │       │   ├── dto/                     # FilterItemsDto
│   │   │       │   ├── entities/                # Films, Books, Games, Songs
│   │   │       │   ├── enums/                   # Category, Mood, Genre enums
│   │   │       │   ├── interfaces/
│   │   │       │   ├── suggestion.controller.ts # GET endpoints with caching
│   │   │       │   ├── suggestion.service.ts
│   │   │       │   └── suggestion.module.ts
│   │   │       ├── data-base/
│   │   │       │   └── data/                    # Seed data for content
│   │   │       ├── shared/
│   │   │       │   └── entities/                # Mood, Genre, Event entities
│   │   │       ├── health/
│   │   │       ├── infrastructure/
│   │   │       │   ├── circuit-breaker/
│   │   │       │   ├── consul/
│   │   │       │   └── metrics/
│   │   │       ├── app.module.ts                # Redis cache configuration
│   │   │       └── main.ts
│   │   │
│   │   ├── history-service/                     # User history (Port 3003)
│   │   │   └── src/
│   │   │       ├── history/
│   │   │       │   ├── schemas/
│   │   │       │   │   └── suggestion-history.schema.ts  # Mongoose schema
│   │   │       │   ├── history.controller.ts    # REST + RabbitMQ event handler
│   │   │       │   ├── history.service.ts
│   │   │       │   └── history.module.ts        # RabbitMQ integration
│   │   │       ├── health/
│   │   │       ├── infrastructure/
│   │   │       │   ├── circuit-breaker/
│   │   │       │   ├── consul/
│   │   │       │   └── metrics/
│   │   │       ├── app.module.ts                # MongoDB + RabbitMQ config
│   │   │       └── main.ts
│   │   │
│   │   └── favorite-service/                    # Favorites (Port 3004)
│   │       └── src/
│   │           ├── favorite/
│   │           │   ├── dto/
│   │           │   │   └── create-favorite.dto.ts
│   │           │   ├── entities/
│   │           │   │   └── favorite.entity.ts   # TypeORM with unique constraint
│   │           │   ├── favorite.controller.ts   # Full CRUD + check endpoint
│   │           │   ├── favorite.service.ts
│   │           │   └── favorite.module.ts
│   │           ├── health/
│   │           ├── infrastructure/
│   │           │   ├── circuit-breaker/
│   │           │   ├── consul/
│   │           │   └── metrics/
│   │           ├── app.module.ts                # PostgreSQL TypeORM config
│   │           └── main.ts
│   │
│   ├── .gitignore
│   ├── .prettierrc
│   ├── package.json                             # Monorepo scripts (docker:start, test:all, etc.)
│   ├── package-lock.json
│   └── tsconfig.json                            # Root TypeScript config
│
├── frontend/
│   ├── .vscode/                                 # VS Code workspace settings
│   ├── public/                                  # Static assets
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── header/                      # Navigation bar component
│   │   │   │   ├── login/                       # Auth UI component
│   │   │   │   ├── main-page/                   # Home & search component
│   │   │   │   ├── recommendations/             # Display results component
│   │   │   │   ├── recommendations-history/     # History view component
│   │   │   │   ├── favorites/                   # Favorites UI component
│   │   │   │   └── smart-picks/                 # AI recommendations component
│   │   │   ├── services/
│   │   │   │   ├── suggestion.service.ts
│   │   │   │   ├── favorite.service.ts
│   │   │   │   ├── login.service.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── navigation.service.ts        # HATEOAS navigation
│   │   │   │   └── suggestion-history.service.ts
│   │   │   ├── interceptors/
│   │   │   │   ├── auth.interceptor.ts          # Auto-add JWT to requests
│   │   │   │   └── hateoas.interceptor.ts       # Parse HATEOAS responses
│   │   │   ├── constants/
│   │   │   │   ├── urls.ts                      # API base URL
│   │   │   │   ├── categories.ts                # Category definitions
│   │   │   │   └── genre.ts                     # Genre mappings
│   │   │   ├── enums/
│   │   │   │   ├── category.ts
│   │   │   │   ├── genre.ts
│   │   │   │   └── property.ts
│   │   │   ├── interfaces/
│   │   │   │   ├── suggestion.ts
│   │   │   │   ├── favorites.ts
│   │   │   │   ├── category.ts
│   │   │   │   └── database.ts
│   │   │   ├── utils/                           # Utility functions
│   │   │   ├── app.component.ts                 # Root component
│   │   │   ├── app.config.ts                    # App configuration
│   │   │   └── app.routes.ts                    # Route definitions
│   │   ├── index.html
│   │   ├── main.ts                              # Bootstrap application
│   │   └── styles.scss                          # Global styles
│   ├── test/                                    # Test configuration
│   ├── angular.json                             # Angular CLI configuration
│   ├── Dockerfile                               # Multi-stage build with Nginx
│   ├── nginx.conf                               # Production web server config
│   ├── package.json
│   └── tsconfig.json                            # TypeScript configuration
│       # Also includes: .dockerignore, .editorconfig, .gitignore, .prettierrc
│       # eslint.config.js, tsconfig.app.json, tsconfig.spec.json
│
├── .gitignore                                   # Root gitignore
├── docker-compose.yml                           # Root orchestration (optional)
├── package.json                                 # Root workspace scripts
└── README.md                                    # This file
```

**Note**: The project structure above shows the legacy folder layout. The project has been migrated to Nx monorepo workspace (see below).

## Nx Monorepo Workspace

The project uses **Nx** as a monorepo build system for improved performance and developer experience.

### Workspace Structure

```
nest-project/
├── apps/                              # All applications
│   ├── api-gateway/                   # API Gateway (NestJS)
│   ├── auth-service/                  # Auth Service (NestJS)
│   ├── suggestion-service/            # Suggestion Service (NestJS)
│   ├── history-service/               # History Service (NestJS)
│   ├── favorite-service/              # Favorite Service (NestJS)
│   └── frontend/                      # Angular 18 frontend
│
├── libs/                              # Shared libraries (future use)
│
├── backend/
│   ├── infrastructure/                # Docker, docker-compose, monitoring
│   └── scripts/                       # Utility scripts
│
├── nx.json                            # Nx workspace configuration
├── tsconfig.base.json                 # Root TypeScript config
└── package.json                       # Root dependencies and scripts
```

### Nx Features

**Build Caching**:
- Nx caches task outputs locally in `.nx/cache`
- Subsequent runs of the same task retrieve results from cache
- 50-80% faster incremental builds

**Affected Commands**:
- Only build/test projects affected by changes
- Speeds up CI/CD pipelines significantly
- Example: changing auth-service won't rebuild frontend

**Dependency Graph**:
- Visualize project dependencies
- Understand how changes propagate
- Run `npx nx graph` to view interactive graph

### Nx Commands

All Nx commands can be run from the project root:

#### Building Applications

```bash
# Build all applications
npm run build:all
# or: npx nx run-many --target=build --all

# Build specific application
npx nx build api-gateway
npx nx build frontend

# Build only affected applications (based on git changes)
npm run affected:build
# or: npx nx affected --target=build

# Build with production optimizations
npx nx build frontend --configuration=production
```

#### Running Applications

```bash
# Serve an application (development mode)
npx nx serve api-gateway
npx nx serve frontend

# Serve with watch mode (auto-reload)
npx nx serve auth-service --watch
```

#### Testing

```bash
# Run all tests
npm run test:all
# or: npx nx run-many --target=test --all

# Test specific application
npx nx test auth-service
npx nx test frontend

# Run only affected tests
npm run affected:test
# or: npx nx affected --target=test

# Test with coverage
npx nx test auth-service --coverage
```

#### Linting

```bash
# Lint all applications
npm run lint:all
# or: npx nx run-many --target=lint --all

# Lint specific application
npx nx lint api-gateway

# Lint only affected applications
npm run affected:lint
# or: npx nx affected --target=lint
```

#### Nx Utilities

```bash
# View dependency graph (interactive)
npx nx graph

# View dependency graph for specific project
npx nx graph --focus=api-gateway

# List all projects
npx nx show projects

# Show project details
npx nx show project api-gateway

# Clear Nx cache
npx nx reset

# View affected projects
npx nx affected:graph
npx nx print-affected --target=build
```

### Nx Workspace Benefits

1. **Faster Builds**: Local caching eliminates redundant work
2. **Efficient CI**: Affected commands only build/test what changed
3. **Code Sharing**: Easy to extract and share code between apps (future Phase 0.4)
4. **Better DX**: Single command to build/test everything
5. **Enforced Standards**: Consistent tooling across all applications

### Nx Migration Status

The project has completed **Phase 0.1: Nx Setup** and **Phase 0.2: Package Updates & Quality**:

**Phase 0.1** ✅:
- ✅ Nx workspace initialized with local caching
- ✅ All 5 NestJS services migrated to apps/
- ✅ Angular frontend migrated to apps/
- ✅ Build system configured (webpack for NestJS, Angular CLI for frontend)
- ✅ CI/CD updated to use Nx affected commands
- ✅ Docker configuration updated for Nx workspace

**Phase 0.2** ✅:
- ✅ All 6 projects build without errors
- ✅ All 6 projects lint cleanly (ESLint flat config, angular-eslint)
- ✅ Backend unit tests running via `@nx/jest:jest` (374 tests, 5 services)
- ✅ Frontend unit tests running via `@angular/build:unit-test` + Vitest (78 tests)
- ✅ Frontend modernized: built-in control flow (`@if`/`@for`), `inject()` function
- ✅ Unused packages removed (`vite-tsconfig-paths`)

**Future Phases** (see ENHANCEMENT-PLAN.md):
- Phase 0.3: Rewrite backend E2E tests (currently scaffold stubs)
- Phase 0.4: Extract shared libraries (metrics, consul, circuit-breaker, health)
- Phase 0.5: Add pre-commit hooks with Husky
- Phase 0.6: Remove RxJS duplication workaround
- Phase 0.7: Performance & DX improvements

### Working with the Monorepo

**Install Dependencies** (from project root):
```bash
npm install
```

**Run Docker Compose** (paths updated for Nx):
```bash
# Start all services (from project root)
npm run start

# Stop all services
npm run stop
```

**Develop Locally**:
```bash
# Terminal 1: Start backend services
npx nx serve api-gateway

# Terminal 2: Start frontend
npx nx serve frontend

# Terminal 3: Run tests in watch mode
npx nx test auth-service --watch
```

**Performance Tips**:
- Use `npx nx affected --target=build` in CI to build only changed projects
- Nx cache persists between runs - second build is nearly instant
- Use `--parallel=N` to build multiple projects simultaneously
- Example: `npx nx run-many --target=build --all --parallel=5`

## Service Communication

The microservices communicate using multiple patterns for optimal performance and reliability:

### 1. HTTP/REST Communication
- **Primary Pattern**: Synchronous request-response via HTTP
- **API Gateway** routes external requests to appropriate services
- **Internal URLs**: Services communicate via Docker network
    - Example: `http://auth-service:3001`, `http://suggestion-service:3002`
- **Authentication**: JWT tokens validated at API Gateway
- **Load Balancing**: Traffic distributed across service instances

### 2. Message Queue (RabbitMQ)
- **Pattern**: Asynchronous event-driven communication
- **Use Cases**:
    - Suggestion Service emits `suggestion_created` events
    - History Service consumes events to track user activity
    - Auth Service processes `validate_token` commands
- **Benefits**: Service decoupling, reliability, scalability
- **Protocol**: AMQP (Advanced Message Queuing Protocol)

### 3. Service Discovery (Consul)
- **Pattern**: Dynamic service registration and discovery
- **Features**:
    - Services auto-register on startup
    - Health check integration
    - Dynamic endpoint resolution
    - Fault detection and removal of unhealthy instances

### 4. Caching Layer (Redis)
- **Pattern**: Cache-aside with TTL-based invalidation
- **Use Cases**:
    - Suggestion results cached for 30 minutes
    - Individual items cached for 1 hour
    - Session management
    - Token blacklist storage
- **Benefits**: Reduced database load, faster response times

### Authentication Flow
```
1. Client → API Gateway → Auth Service (login)
2. Auth Service generates JWT token
3. Client includes token in Authorization header
4. API Gateway validates token before routing
5. Services receive validated user context
```

## Security Features

### Authentication & Authorization
- **JWT-based Authentication**: Stateless token validation
- **Token Expiration**: Configurable (default: 24 hours)
- **Token Blacklisting**: Revoked tokens tracked on logout
- **Password Security**: bcrypt hashing with salt rounds: 10
- **Protected Routes**: Authentication guards on sensitive endpoints
- **User Context**: Validated user ID passed to all services

### API Security
- **Rate Limiting**: 100 requests per minute per client
- **CORS Protection**: Configurable allowed origins
- **Helmet Integration**: Security headers (CSP, XSS protection)
- **Input Validation**: class-validator with DTOs on all endpoints
- **SQL Injection Prevention**: TypeORM parameterized queries
- **NoSQL Injection Prevention**: Mongoose schema validation

### Infrastructure Security
- **Non-root Containers**: All services run as nodejs user (UID 1001)
- **Secret Management**: Environment variables for credentials
- **Network Isolation**: Docker bridge network for service communication
- **Database Credentials**: Separate databases with individual credentials
- **Redis Authentication**: Password-protected caching layer

### Testing & Validation
- **E2E Security Tests**: SQL injection, timing attacks tested
- **Authentication Flow Tests**: Token validation, expiration, blacklisting
- **Error Handling**: No sensitive information leaked in error messages
- **Concurrent Request Handling**: Tested for race conditions

## Prerequisites

Before running the application, ensure you have the following installed:

### Required
- **Docker** (v20.10 or higher)
- **Docker Compose** (v2.0 or higher)
- **Git**

### Optional (for development)
- **Node.js** (v20 or higher) - for local development without Docker
- **npm** (v10 or higher) - comes with Node.js
- **Postman** - for API testing (collection provided)
- **PostgreSQL 15** - if running services locally
- **MongoDB 7** - if running services locally
- **Redis 7** - if running services locally

### System Requirements
- **RAM**: Minimum 4GB (8GB recommended for running all services)
- **Disk Space**: ~2GB for Docker images and data
- **OS**: Linux, macOS, or Windows with WSL2

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd suggestify-microservices
```

### 2. Environment Configuration

Each service has a `.env.example` file. For development, Docker Compose uses default values, so no manual setup is required.

**For production or custom configuration**:
```bash
# Navigate to each service
cd backend/services/auth-service
cp .env.example .env
# Edit .env with your values

# Repeat for other services:
# - api-gateway
# - suggestion-service
# - history-service
# - favorite-service
```

**Key Environment Variables**:
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`
- `JWT_SECRET` - Secret for JWT token signing (change in production!)
- `REDIS_HOST`, `REDIS_PASSWORD`
- `RABBITMQ_URL`
- `CONSUL_HOST`

### 3. Automatical Setup

Docker Compose automatically:
- Creates all PostgreSQL databases (auth_db, suggestions_db, favorites_db)
- Initializes MongoDB (history_db)
- Sets up Redis with authentication
- Configures RabbitMQ message broker
- Starts Consul for service discovery
- Deploys Prometheus and Grafana with dashboards

## Running the Application

### Option 1: Full Stack (Backend + Frontend) - Recommended

**From project root**, start everything with npm script:

```bash
npm run start
```

This command will:
- Build Docker images for all 5 microservices + API Gateway + Frontend
- Start infrastructure (PostgreSQL × 3, MongoDB, Redis, RabbitMQ, Consul)
- Start monitoring stack (Prometheus, Grafana)
- Start Angular frontend (Nginx)
- Wait for health checks to pass
- Initialize databases with schemas automatically

**Services will be available at:**
- Frontend: http://localhost:4200
- API Gateway: http://localhost:3000
- Monitoring: http://localhost:3050 (Grafana)

**Stop everything using npm script:**
```bash
npm run stop
```

### Option 2: Backend Only (No Frontend)

**From `backend/` directory**, use npm scripts:

```bash
cd backend
npm run docker:start
```

This command will:
- Build Docker images for all 5 microservices + API Gateway (NO frontend)
- Start infrastructure (PostgreSQL × 3, MongoDB, Redis, RabbitMQ, Consul)
- Start monitoring stack (Prometheus, Grafana)
- Wait for health checks to pass
- Initialize databases with schemas automatically

**Stop backend services:**
```bash
cd backend
npm run docker:stop
```

### Verifying Services

**1. Verify backend services are healthy** (if using Option 2 - Backend Only):
```bash
cd backend
npm run docker:health
```

Expected output:
```
✓ API Gateway (http://localhost:3000/health)
✓ Auth Service (http://auth-service:3001/health)
✓ Suggestion Service (http://suggestion-service:3002/health)
✓ History Service (http://history-service:3003/health)
✓ Favorite Service (http://favorite-service:3004/health)
```

**2. Verify all containers are running**:
```bash
# Check all containers status
docker ps

# Windows PowerShell - filter by name:
docker ps -f name=frontend
docker ps -f name=api-gateway
docker ps -f name=auth-service

# Linux/Mac/Git Bash:
docker ps | grep -E "frontend|api-gateway|auth-service"
```

**3. Verify frontend is accessible**:
```bash
# Test frontend HTTP response
curl http://localhost:4200

# Or open in browser
# http://localhost:4200
```

**4. View logs**:
```bash
# View all logs (from project root)
docker-compose logs -f

# View specific service logs
docker logs frontend
docker logs api-gateway
docker logs auth-service

# Or if using backend npm scripts
cd backend
npm run docker:logs          # All backend services
npm run docker:logs auth     # Specific backend service
```

### Available Commands

**From Project Root** (Full Stack - Backend + Frontend):
```bash
docker-compose up -d --build     # Start everything
docker-compose down              # Stop everything
docker-compose down -v           # Stop and remove volumes (deletes data)
docker-compose logs -f           # View all logs
docker-compose restart frontend  # Restart specific service
docker ps                        # Check all containers
```

**From `backend/` Directory** (Backend Services - NPM Scripts):
```bash
# Docker Operations
npm run docker:start         # Build and start backend services only
npm run docker:stop          # Stop and remove backend containers + volumes
npm run docker:logs          # View backend service logs
npm run docker:health        # Check backend health endpoints

# Backend Development
npm run build:all            # Build all backend services
npm run test:all             # Run all backend unit tests
npm run test:e2e             # Run backend E2E tests
npm run test:coverage        # Generate backend coverage reports
npm run lint:all             # Lint all backend services
npm run lint:fix             # Auto-fix backend linting issues
```

**From `frontend/` Directory** (Frontend Application):
```bash
# Frontend Development
npm start                    # Start dev server (http://localhost:4200)
npm run build                # Production build
npm run test                 # Run frontend unit tests
npm run test -- --watch      # Run tests in watch mode
npm run test -- --code-coverage  # Generate frontend coverage
npm run lint                 # Lint frontend code
npm run lint -- --fix        # Auto-fix frontend linting issues
```

### Service URLs

Once running, access services at:

| Service                      | URL                     | Description                                         |
|------------------------------|-------------------------|-----------------------------------------------------|
| **Frontend (Angular App)**   | http://localhost:4200   | Web application UI                                  |
| **API Gateway**              | http://localhost:3000   | Main API entry point (all requests go through here) |
| Grafana Dashboard            | http://localhost:3050   | Monitoring dashboards (admin/admin)                 |
| Prometheus                   | http://localhost:9090   | Metrics collection and queries                      |
| RabbitMQ Management          | http://localhost:15672  | Message queue management (rabbit/rabbitpass)        |
| Consul UI                    | http://localhost:8500   | Service discovery and health checks                 |

**Note**: Individual microservices (Auth, Suggestion, History, Favorite) are **NOT exposed directly**. All API requests must go through the API Gateway at `http://localhost:3000`. This is a security best practice in microservices architecture.

**Internal Service URLs** (accessible only within Docker network):
- Auth Service: `http://auth-service:3001`
- Suggestion Service: `http://suggestion-service:3002`
- History Service: `http://history-service:3003`
- Favorite Service: `http://favorite-service:3004`

### Running the Frontend

#### Option 1: With Docker (Recommended - Included in Full Stack)

The frontend is automatically started when you run the full stack:

```bash
# From project root
docker-compose up -d

# Frontend will be available at http://localhost:4200
```

Check frontend health:
```bash
# Check container status
docker ps | grep frontend

# Check logs
docker logs frontend

# Test access
curl -I http://localhost:4200
```

#### Option 2: Local Development (Without Docker)

For frontend-only development:

```bash
cd frontend
npm install
npm start
```

Access at: http://localhost:4200

**Note**: Ensure API Gateway is running (backend services) for the frontend to function properly.

#### Option 3: Production Build with Docker

To run only the frontend in production mode:

```bash
cd frontend
docker build -t suggestify-frontend .
docker run -p 80:80 suggestify-frontend
```

Access at: http://localhost

## Testing with Postman

The Postman collection (`backend/postman/suggestify.postman_collection.json`) provides complete API testing coverage with:
- ✅ All 4 microservices (Auth, Suggestion, History, Favorite) + Health/Metrics
- ✅ Automatic variable management (tokens, IDs)
- ✅ HATEOAS link parsing and navigation
- ✅ Pre-request and test scripts for workflow automation
- ✅ Correct `/v1/` prefix and RESTful endpoints

### 1. Import the Collection

1. Open Postman
2. Click **Import**
3. Select the file: `backend/postman/suggestify.postman_collection.json`
4. The collection will be imported with all endpoints and automation scripts

### 2. Configure Environment Variables

The collection uses the following variables (automatically managed):

- `baseUrl`: `http://localhost:3000` (API Gateway - default value)
- `accessToken`: Automatically set after signup/login
- `userId`: Automatically set after signup/login (used in X-User-Id header)
- `category`: Automatically set after getting suggestions
- `itemId`: Automatically set after getting suggestions
- `historyItemId`: Automatically set after retrieving history
- `favoriteId`: Automatically set after adding a favorite
- HATEOAS link URLs (sessionsUrl, favoritesUrl, historyUrl, suggestionsUrl)

**Note**: The API Gateway automatically adds `/v1/` prefix to all routes, so you can use either:
- `http://localhost:3000/auth/users` (recommended)
- `http://localhost:3000/v1/auth/users` (also works)

All the required body examples are provided.

### 3. Testing Workflow

Follow this recommended testing sequence (mirrors typical user flow):

**User Flow**: Login → Get Suggestions → View History → Mark Favorites from History → Manage Favorites

#### Step 1: Authentication

1. **Signup** - Create a new user
    - Endpoint: `POST /auth/users`
    - Body:
      ```json
      {
        "username": "user",
        "password": "password123"
      }
      ```
    - Auto-saves: `accessToken` and `userId`
    - Response includes HATEOAS links to other services

2. **Get Profile** - Verify authentication
    - Endpoint: `GET /auth/users/me`
    - Headers: `Authorization: Bearer {{accessToken}}`

#### Step 2: Get Suggestions

Run any of the following suggestion requests (or several of them):

1. **Get Film Suggestions**
    - Endpoint: `GET /suggestion?category=films&mood=relaxing&genre=sci-fi&event=discovery`
    - Headers: `Authorization`, `X-User-Id`
    - Auto-saves: `category` and `itemId` from response

2. **Get Book Suggestions**
    - Endpoint: `GET /suggestion?category=books&mood=happy`
    - Optional filters: genre, event

3. **Get Song Suggestions**
    - Endpoint: `GET /suggestion?category=songs&mood=happy`
    - Optional filters: genre, event

4. **Get Game Suggestions**
    - Endpoint: `GET /suggestion?category=games&mood=dark&event=magic`
    - Optional filters: genre

5. **Get One Item** - Retrieve specific item details
    - Endpoint: `GET /suggestion/{{category}}/{{itemId}}`
    - Variables automatically set from previous requests
    - Headers: `Authorization`, `X-User-Id`

#### Step 3: View History

1. **Get User History** - View all user interactions
    - Endpoint: `GET /history`
    - Auto-saves: `historyItemId`
    - Shows all past searches and suggestions

2. **Get History Item** - View specific history entry
    - Endpoint: `GET /history/{{historyItemId}}`

3. **Get User Stats** - View user statistics
    - Endpoint: `GET /history/stats`

**Note**: In the UI, the history page allows users to mark/unmark items as favorites directly from the history view.

#### Step 4: Manage Favorites

1. **Add Favorite** - Add item to favorites (can be done from history page)
    - Endpoint: `POST /favorite`
    - Body: `{itemId: "{{itemId}}", category: "{{category}}", title: "..."}`
    - Auto-saves: `favoriteId`

2. **Get All Favorites** - List all favorites
    - Endpoint: `GET /favorite`

3. **Get Favorites by Category** - Filter by category
    - Endpoint: `GET /favorite?category={{category}}`

4. **Check Is Favorite** - Check if item is favorited
    - Endpoint: `GET /favorite/check/{{category}}/{{itemId}}`

5. **Delete Favorite** - Remove from favorites (can be done from history page)
    - Endpoint: `DELETE /favorite/{{favoriteId}}`

#### Step 5: Check Health and Statistics (no auth required)

1. **API Gateway Health** - Check API Gateway state
    - Endpoint: `GET /health`

2. **Metrics** - View app metrics
    - Endpoint: `GET /metrics`

#### Step 6: Cleanup

1. **Logout** - End user session
    - Endpoint: `DELETE /auth/sessions`
    - Clears all saved tokens and variables

#### Step 7: Try to fetch data without being logged in

Run any of the following requests (should return 401 Unauthorized):

1. **Get Profile** - Verify authentication fails
    - Endpoint: `GET /auth/users/me`

2. **Get Film Suggestions** - Should fail without token
    - Endpoint: `GET /suggestion?category=films&mood=relaxing`

3. **Get User History** - Should fail without token
    - Endpoint: `GET /history`

#### Step 8: Log in

1. **Login** - Authenticate existing user
    - Endpoint: `POST /auth/sessions`
    - Body: Same as signup
    - Auto-saves: `accessToken` and `userId`
    - Response includes HATEOAS links

#### Step 9: Verify functionality after re-login

After logging back in, verify that all endpoints work correctly:
- **Step 2**: Get suggestions (should work with new token)
- **Step 3**: View history (should include previous searches from before logout)
- **Step 4**: Manage favorites (add/view/delete items, including from history page)

### 4. Running the Full Test Suite

Postman allows you to run the entire collection sequentially:

1. Click on the collection name
2. Click **Run collection**
3. Select all requests or specific folders
4. Click **Run Suggestify Microservices**

The tests include automatic assertions and variable management, so the entire flow runs smoothly.

## Monitoring

The system includes comprehensive monitoring with Prometheus and Grafana for observability and performance tracking.

### Prometheus Metrics

**Access Prometheus**:
- URL: http://localhost:9090
- Collection interval: 15 seconds
- Retention: 15 days

**Available Metrics**:
Each service exposes metrics at `/metrics` endpoint:
- `http_requests_total` - Total HTTP requests by method, route, status
- `http_request_duration_seconds` - Request latency histogram
- `http_request_size_bytes` - Request payload sizes
- `http_response_size_bytes` - Response payload sizes
- `nodejs_heap_size_bytes` - Memory usage
- `nodejs_external_memory_bytes` - External memory
- `process_cpu_user_seconds_total` - CPU usage

**Example Queries**:
```promql
# Request rate per second
rate(http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate (4xx and 5xx)
rate(http_requests_total{status=~"4..|5.."}[5m])
```

### Grafana Dashboards

**Access Grafana**:
- URL: http://localhost:3050
- Username: `admin`
- Password: `admin` (change on first login)
- Prometheus datasource: http://prometheus:9090 (auto-configured)

**Pre-built Dashboards** (located in `infrastructure/monitoring/provisioning/dashboards/`):

1. **Request Rate Dashboard** (`request-rate.json`)
    - Total requests per second across all services
    - Requests by service
    - Requests by HTTP method
    - Real-time request throughput

2. **Correct Rate Dashboard** (`correct-rate.json`)
    - Successful requests (2xx status codes)
    - Success rate percentage by service
    - Success trends over time

3. **Error Rate Dashboard** (`error-rate.json`)
    - 4xx client errors by endpoint
    - 5xx server errors by service
    - Error trends and patterns
    - Top error-prone endpoints

4. **P95 Latency Dashboard** (`P95-latency.json`)
    - 95th percentile response times
    - Latency by service
    - Latency by endpoint
    - Latency trends and anomalies

**Dashboard Import**:
- Dashboards are auto-loaded on Grafana startup
- Manual import: Dashboards → Import → Upload JSON file

### Health Checks

All services expose health endpoints for monitoring.

**Important**: Individual microservice ports (3001-3004) are **NOT exposed** to localhost for security. Only the API Gateway (port 3000) is accessible from the host.

**Check API Gateway** (only exposed service):
```bash
curl http://localhost:3000/health  # API Gateway
```

**Check Individual Microservices** (from inside Docker network):
```bash
# Method 1: Via docker exec into the container
docker exec auth-service wget -qO- http://localhost:3001/health
docker exec suggestion-service wget -qO- http://localhost:3002/health
docker exec history-service wget -qO- http://localhost:3003/health
docker exec favorite-service wget -qO- http://localhost:3004/health

# Method 2: Check container health status (Docker healthcheck)
docker inspect auth-service --format='{{.State.Health.Status}}'
docker inspect suggestion-service --format='{{.State.Health.Status}}'
docker inspect history-service --format='{{.State.Health.Status}}'
docker inspect favorite-service --format='{{.State.Health.Status}}'
```

**Health Check Script**:
```bash
cd backend
npm run docker:health
```

**Health Check Configuration**:
- Interval: 30 seconds
- Timeout: 10 seconds
- Retries: 3
- Start period: 40 seconds (allow service initialization)

### RabbitMQ Management

**Access RabbitMQ Console**:
- URL: http://localhost:15672
- Username: `rabbit`
- Password: `rabbitpass`

**Monitor**:
- Queue depths and message rates
- Consumer status
- Connection health
- Exchange bindings

### Consul Service Discovery

**Access Consul UI**:
- URL: http://localhost:8500

**Features**:
- Service registration status
- Health check results
- Service topology
- Node status

## API Documentation

All requests should be made through the API Gateway at `http://localhost:3000`.

### Key API Features

**1. Automatic `/v1/` Prefix**:
The API Gateway automatically adds the `/v1/` prefix to all routes (configured in `api-gateway/src/main.ts`):
```typescript
app.setGlobalPrefix('v1');
```

When you request:
- `http://localhost:3000/auth/users` → becomes `/v1/auth/users` internally
- `http://localhost:3000/suggestion` → becomes `/suggestion` internally

**Note**: In the examples below, we **omit the `/v1/` prefix** since it's added automatically. Both work:
- ✅ `http://localhost:3000/auth/users` (recommended - cleaner)
- ✅ `http://localhost:3000/v1/auth/users` (also works - explicit)

**2. HATEOAS Response Format**:
All responses are wrapped in a `{ data, links }` envelope for HATEOAS (Hypermedia as the Engine of Application State) navigation:
```json
{
  "data": { /* actual response data */ },
  "links": {
    "self": "/v1/current-endpoint",
    "related": "/v1/related-endpoint"
  }
}
```

**3. Required Headers**:
- `Authorization: Bearer <JWT_TOKEN>` - Required for all authenticated endpoints
- `X-User-Id: <USER_ID>` - Required by Suggestion, History, and Favorite services
- `Content-Type: application/json` - Required for POST requests

**4. RESTful Resource Naming**:
The API follows RESTful conventions with resource-based URLs:
- Users: `/auth/users`
- Sessions: `/auth/sessions`
- Suggestions, History, Favorites: Use HTTP verbs (GET, POST, DELETE) on resource endpoints

### Auth Service (`/auth`)

| Endpoint            | Method | Description                | Auth | Request Body           | Response                                   |
|---------------------|--------|----------------------------|------|------------------------|--------------------------------------------|
| `/auth/users`       | POST   | Register new user (signup) | No   | `{username, password}` | `{data: {user, accessToken}, links}`       |
| `/auth/sessions`    | POST   | Authenticate user (login)  | No   | `{username, password}` | `{data: {user, accessToken}, links}`       |
| `/auth/users/me`    | GET    | Get user profile           | Yes  | -                      | `{data: {id, username, createdAt}, links}` |
| `/auth/sessions`    | DELETE | Revoke token (logout)      | Yes  | -                      | `{data: {message}, links}`                 |

**Validation Rules**:
- `username`: Required, string, 3-50 characters
- `password`: Required, minimum 6 characters

**Example Signup Request**:
```bash
curl -X POST http://localhost:3000/auth/users \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
```

**Example Response**:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "username": "testuser"
    },
    "accessToken": "jwt-token-here"
  },
  "links": {
    "self": "/v1/auth/users",
    "sessions": "/v1/auth/sessions",
    "favorites": "/favorite",
    "history": "/history",
    "suggestions": "/suggestion"
  }
}
```

### Suggestion Service (`/suggestion`)

| Endpoint                      | Method | Description              | Auth  | Headers                      | Query Params                      | Response                       |
|-------------------------------|--------|--------------------------|-------|------------------------------|-----------------------------------|--------------------------------|
| `/suggestion`                 | GET    | Get filtered suggestions | Yes   | `X-User-Id`, `Authorization` | `category, mood?, genre?, event?` | `{data: {type, items}, links}` |
| `/suggestion/:category/:id`   | GET    | Get specific item        | Yes   | `X-User-Id`, `Authorization` | -                                 | `{data: {item}, links}`        |

**Supported Categories**: `films`, `books`, `songs`, `games`

**Available Filters**:
- `mood`: happy, sad, relaxing, dark, nice, energetic, calm
- `genre`: sci-fi, fantasy, action, romance, thriller, comedy, drama, horror
- `event`: discovery, magic, adventure, mystery, celebration

**Caching**:
- Filtered results: 30 minutes TTL
- Individual items: 1 hour TTL

**Example Suggestion Request**:
```bash
curl -X GET "http://localhost:3000/suggestion?category=films&mood=relaxing&genre=sci-fi&event=discovery" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-User-Id: YOUR_USER_ID"
```

**Response** (up to 20 items):
```json
{
  "data": {
    "type": "films",
    "items": [
      {
        "id": "uuid",
        "title": "Interstellar",
        "description": "...",
        "director": "Christopher Nolan",
        "year": 2014,
        "moods": ["relaxing", "happy"],
        "genres": ["sci-fi"],
        "events": ["discovery"]
      }
    ]
  },
  "links": {
    "self": "/suggestion?category=films&mood=relaxing&genre=sci-fi&event=discovery",
    "favorites": "/favorite",
    "history": "/history"
  }
}
```

### History Service (`/history`)

| Endpoint         | Method | Description                | Auth    | Headers                      | Response                        |
|------------------|--------|----------------------------|---------|------------------------------|---------------------------------|
| `/history`       | GET    | Get all user history       | Yes     | `X-User-Id`, `Authorization` | `{data: {items: [...]}, links}` |
| `/history/stats` | GET    | Get user statistics        | Yes     | `X-User-Id`, `Authorization` | `{data: {stats}, links}`        |
| `/history/:id`   | GET    | Get specific history entry | Yes     | `X-User-Id`, `Authorization` | `{data: {historyItem}, links}`  |

**Note**: The `/stats` endpoint must come before `/:id` in the route order.

**Example Stats Response**:
```json
{
  "data": {
    "totalSearches": 42,
    "categoriesSearched": {
      "films": 20,
      "books": 12,
      "songs": 8,
      "games": 2
    },
    "mostCommonMood": "happy",
    "mostCommonGenre": "sci-fi",
    "lastSearchAt": "2026-05-20T10:30:00Z"
  },
  "links": {
    "self": "/history/stats",
    "history": "/history",
    "suggestions": "/suggestion"
  }
}
```

### Favorite Service (`/favorite`)

| Endpoint                            | Method   | Description                                   | Auth  | Headers                      | Request Body                 | Response                               |
|-------------------------------------|----------|-----------------------------------------------|-------|------------------------------|------------------------------|----------------------------------------|
| `/favorite`                         | GET      | Get all favorites (optional ?category filter) | Yes   | `X-User-Id`, `Authorization` | -                            | `{data: {favorites: [...]}, links}`    |
| `/favorite/:id`                     | GET      | Get specific favorite                         | Yes   | `X-User-Id`, `Authorization` | -                            | `{data: {favorite}, links}`            |
| `/favorite/check/:category/:itemId` | GET      | Check if item is favorited                    | Yes   | `X-User-Id`, `Authorization` | -                            | `{data: {isFavorite: boolean}, links}` |
| `/favorite`                         | POST     | Add to favorites                              | Yes   | `X-User-Id`, `Authorization` | `{itemId, category, title?}` | `{data: {favorite}, links}`            |
| `/favorite/:id`                     | DELETE   | Remove from favorites                         | Yes   | `X-User-Id`, `Authorization` | -                            | `204 No Content`                       |

**Example Add Favorite Request**:
```bash
curl -X POST http://localhost:3000/favorite \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-User-Id: YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "item-uuid",
    "category": "films",
    "title": "Interstellar"
  }'
```

**Example Response**:
```json
{
  "data": {
    "id": "favorite-uuid",
    "userId": "user-uuid",
    "itemId": "item-uuid",
    "category": "films",
    "title": "Interstellar",
    "createdAt": "2026-05-20T10:30:00Z"
  },
  "links": {
    "self": "/favorite/favorite-uuid"
  }
}
```

**Unique Constraint**: Each user can favorite an item only once per category.

### Health & Monitoring

| Endpoint   | Method | Description          | Auth   | Response                             |
|------------|--------|----------------------|--------|--------------------------------------|
| `/health`  | GET    | Service health check | No     | `{data: {status: "ok"}, links}`      |
| `/metrics` | GET    | Prometheus metrics   | No     | Prometheus text format (not wrapped) |

### Error Responses

All endpoints return standardized error responses:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

**Common Status Codes**:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate favorite)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

### Rate Limiting

- **Limit**: 100 requests per minute per client
- **Header**: `X-RateLimit-Remaining` shows remaining requests
- **Reset**: Counter resets every 60 seconds

## Frontend Application

The project includes a modern Angular 22 frontend application with standalone components.

### Features

- **Authentication UI**: Login and signup forms with JWT token management
- **Smart Search**: Filter content by category, mood, genre, and events
- **Recommendations Display**: Browse personalized suggestions
- **Favorites Management**: Add, view, and remove favorite items
- **History Tracking**: View past searches and patterns
- **Responsive Design**: Mobile-friendly SCSS styling

### Architecture

**Standalone Components** (Angular 22):
- No NgModules - fully standalone architecture
- Component-level imports for better tree-shaking
- Built-in control flow (`@if`, `@for`) instead of structural directives
- `inject()` function for dependency injection
- Lazy-loaded routes for optimal performance

**State Management**:
- Angular Signals for reactive state
- RxJS for async operations and HTTP calls
- Computed properties for derived state

**HTTP Interceptors**:
- `AuthInterceptor`: Automatically adds JWT tokens to requests
- `HateoasInterceptor`: Handles HATEOAS navigation links

### Routes

| Route                      | Component                       | Description                          |
|----------------------------|---------------------------------|--------------------------------------|
| `/`                        | MainPageComponent               | Home with search and recommendations |
| `/recommendations-history` | RecommendationsHistoryComponent | View past searches                   |
| `/favorites`               | FavoritesComponent              | Manage favorite items                |

### Running the Frontend

**Development Mode**:
```bash
cd frontend
npm install
npm start
```
Access at: http://localhost:4200

**Production Build**:
```bash
npm run build
# Output in dist/ directory
```

**Docker Production**:
```bash
docker build -t suggestify-frontend .
docker run -p 80:80 suggestify-frontend
```
Access at: http://localhost

### Environment Configuration

**Development** (`frontend/src/app/constants/urls.ts`):
```typescript
export const BASE_URL = 'http://localhost:3000';
```

**Production**: Update BASE_URL to your API Gateway domain:
```typescript
export const BASE_URL = 'https://api.yourdomain.com';
```

### Key Services

**SuggestionService**:
- Fetch filtered suggestions
- Get individual items
- Cache results in memory

**FavoriteService**:
- Add/remove favorites
- List user favorites
- Check favorite status

**LoginService**:
- User signup and login
- Token storage in localStorage
- Auth state management with Signals

**NavigationService**:
- Parse HATEOAS links from API responses
- Navigate to related resources
- Dynamic link generation

## Development

### Local Development Setup

**Install Dependencies for All Services**:
```bash
cd backend/services/auth-service && npm install
cd ../api-gateway && npm install
cd ../suggestion-service && npm install
cd ../history-service && npm install
cd ../favorite-service && npm install
```

**Run Service Locally** (requires local databases):
```bash
cd backend/services/auth-service
npm run start:dev  # Hot-reload enabled
```

### Adding a New Microservice

**Step-by-Step Guide**:

1. **Generate NestJS Project**:
   ```bash
   cd backend/services
   nest new your-service-name
   cd your-service-name
   ```

2. **Install Dependencies**:
   ```bash
   # For PostgreSQL
   npm install @nestjs/typeorm typeorm pg

   # For MongoDB
   npm install @nestjs/mongoose mongoose

   # Common dependencies
   npm install @nestjs/microservices amqplib cache-manager
   ```

3. **Add Health Check & Metrics**:
   ```bash
   npm install @nestjs/terminus @willsoto/nestjs-prometheus
   ```

4. **Create Dockerfile** in service root

5. **Add to Docker Compose** (`infrastructure/docker-compose.yml`)

6. **Register with API Gateway**

7. **Add Postman Endpoints** to collection

8. **Write Tests** (unit + e2e)

### Code Quality

#### Backend Linting & Formatting

**From `backend/` directory**:
```bash
# Lint all backend services
npm run lint:all

# Auto-fix linting issues
npm run lint:fix

# Lint specific service
cd services/auth-service
npm run lint
```

#### Frontend Linting & Formatting

**From `frontend/` directory**:
```bash
# Lint frontend
npm run lint

# Auto-fix linting issues
npm run lint -- --fix
```

**Configuration**:
- **ESLint**: TypeScript strict mode, NestJS rules (backend), Angular rules (frontend)
- **Prettier**: Integrated with ESLint
- **EditorConfig**: Consistent formatting across editors

### Testing Strategy

#### Backend Tests

**Unit Tests** (Jest) - **From `backend/` directory**:
```bash
# Run all backend unit tests
npm run test:all

# Watch mode (auto-rerun on changes)
cd services/auth-service
npm run test:watch

# Coverage report
npm run test:coverage
```

**E2E Tests** (Supertest) - **From `backend/` directory**:
```bash
# Run all backend E2E tests
npm run test:e2e

# Specific service E2E
cd services/auth-service
npm run test:e2e
```

#### Frontend Tests

**From `frontend/` directory**:
```bash
# Run frontend unit tests
npm run test

# Watch mode
npm run test -- --watch

# Coverage report
npm run test -- --code-coverage

# E2E tests (if configured)
npm run e2e
```

**Test Coverage Goals**:
- Minimum 80% code coverage (both backend and frontend)
- 100% coverage for auth/security flows
- Performance tests for caching
- Security tests (SQL injection, XSS, etc.)

### Database Operations

**TypeORM Migrations**:
```bash
cd backend/services/auth-service

# Generate migration from entity changes
npm run migration:generate -- -n AddEmailColumn

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show
```

**Seeding Data**:
```bash
# Seed development data
cd backend/services/suggestion-service
npm run seed

# Clear and reseed
npm run seed:clear && npm run seed
```

### Debugging

**VS Code Debug Configuration** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Debug: Auth Service",
      "port": 9229,
      "restart": true,
      "sourceMaps": true
    }
  ]
}
```

**Run in debug mode**:
```bash
npm run start:debug
# Then attach debugger in VS Code (F5)
```

### Performance Optimization

**Database Optimization**:
- Add indexes on frequently queried fields
- Use eager loading for related entities
- Enable query logging to identify slow queries

**Caching**:
- Redis for frequently accessed data
- Set appropriate TTL values
- Cache invalidation on updates

**Docker Optimization**:
- Multi-stage builds reduce image size
- Use alpine base images
- Layer caching for faster builds

## Troubleshooting

**Note**:
- `docker-compose` commands run from **project root**
- `npm run docker:*` scripts run from **`backend/`** directory

### Common Issues & Solutions

#### 1. Port Already in Use

**Problem**: Service fails to start with "EADDRINUSE" error

**Solution**:
```bash
# Linux/Mac - Find process using port
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change port in service .env file
PORT=3010
```

#### 2. Database Connection Failed

**Problem**: Cannot connect to PostgreSQL/MongoDB

**Solution**:
```bash
# Check if database containers are running
# Windows PowerShell:
docker ps -f name=postgres
docker ps -f name=mongodb

# Linux/Mac/Git Bash:
docker ps | grep postgres
docker ps | grep mongo

# Check database logs
docker logs postgres-auth
docker logs mongodb

# Verify credentials in .env match docker-compose.yml
# Default: postgres/postgres, root/rootpass

# Restart database containers
docker-compose restart postgres-auth mongodb
```

#### 3. Docker Build Fails

**Problem**: "npm install" fails during Docker build

**Solution**:
```bash
# Clear Docker build cache
docker builder prune -a

# Rebuild with no cache
cd backend
docker-compose build --no-cache

# Check for network issues
docker run --rm alpine ping -c 3 registry.npmjs.org
```

#### 4. Service Health Check Failing

**Problem**: Service marked as unhealthy

**Solution**:
```bash
# Check service logs (from backend/ directory)
cd backend
npm run docker:logs auth

# Test health endpoint via Docker
docker exec auth-service wget --quiet --tries=1 --spider http://localhost:3001/health

# Or check via API Gateway
curl http://localhost:3000/health

# Increase health check timeout in docker-compose.yml
healthcheck:
  timeout: 30s  # Increase from 10s
  start_period: 60s  # Increase from 40s
```

#### 5. RabbitMQ Connection Issues

**Problem**: Services can't connect to RabbitMQ

**Solution**:
```bash
# Check RabbitMQ is running
# Windows PowerShell:
docker ps -f name=rabbitmq

# Linux/Mac/Git Bash:
docker ps | grep rabbitmq

# Access RabbitMQ management console
open http://localhost:15672
# Login: rabbit / rabbitpass

# Check queues and connections
# Restart RabbitMQ if needed
docker-compose restart rabbitmq
```

#### 6. Redis Cache Not Working

**Problem**: Cache always misses

**Solution**:
```bash
# Check Redis is running
# Windows PowerShell:
docker ps -f name=redis

# Linux/Mac/Git Bash:
docker ps | grep redis

# Test Redis connection
docker exec -it redis redis-cli
> AUTH redispass
> PING  # Should return PONG
> KEYS *  # View cached keys

# Clear cache if corrupted
> FLUSHALL
```

#### 7. JWT Token Issues

**Problem**: "Unauthorized" errors with valid token

**Possible Causes**:
- Token expired (check `JWT_EXPIRATION` in .env)
- Token blacklisted after logout
- JWT_SECRET mismatch between services

**Solution**:
```bash
# Ensure all services use same JWT_SECRET
# Check in auth-service and api-gateway .env

# Generate new token by logging in again
curl -X POST http://localhost:3000/auth/login \
  -d '{"username":"user","password":"pass"}'

# Verify token is included in requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/auth/profile
```

#### 8. Prometheus/Grafana Not Showing Data

**Problem**: Dashboards are empty

**Solution**:
```bash
# Verify Prometheus is scraping
open http://localhost:9090/targets
# All targets should show "UP"

# Check Prometheus config
docker exec prometheus cat /etc/prometheus/prometheus.yml

# Restart Prometheus
docker-compose restart prometheus

# Re-import Grafana dashboards
# Dashboards → Import → Upload JSON from
# infrastructure/monitoring/provisioning/dashboards/
```

#### 9. Out of Memory

**Problem**: Container crashes with OOM error

**Solution**:
```bash
# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory: 8GB

# Add memory limits to docker-compose.yml
services:
  auth-service:
    mem_limit: 512m

# Check memory usage
docker stats
```

#### 10. Frontend Can't Connect to Backend

**Problem**: CORS errors or connection refused

**Solution**:
```bash
# Verify API Gateway is running
curl http://localhost:3000/health

# Check CORS configuration in api-gateway
# Should include http://localhost:4200

# Update frontend BASE_URL
# frontend/src/app/constants/urls.ts
export const BASE_URL = 'http://localhost:3000';

# Clear browser cache and restart frontend
npm start --clearCache
```

#### 11. Frontend Container Not Running

**Problem**: Frontend not accessible at http://localhost:4200

**Solution**:
```bash
# Check if frontend container is running
# Windows PowerShell:
docker ps -f name=frontend

# Linux/Mac/Git Bash:
docker ps | grep frontend

# If not running, check logs
docker logs frontend

# Check if container exited
# Windows PowerShell:
docker ps -a -f name=frontend

# Linux/Mac/Git Bash:
docker ps -a | grep frontend

# Restart frontend container
docker-compose restart frontend

# Check health status
docker inspect frontend --format='{{.State.Health.Status}}'

# Test Nginx is responding
curl -I http://localhost:4200

# Rebuild if needed (from project root)
docker-compose up -d --build frontend
```

**Common Frontend Issues**:
- **Port 4200 already in use**: Change port in root `docker-compose.yml` or kill process using port
- **Build failed**: Check `docker logs frontend` for Angular build errors
- **404 on refresh**: Nginx config handles this with `try_files $uri $uri/ /index.html`
- **Assets not loading**: Check browser console, verify Nginx is serving static files

### Complete Reset

When all else fails, perform a complete reset:

```bash
# Stop and remove everything (from project root)
docker-compose down -v

# Remove all Docker volumes (WARNING: deletes all data)
docker volume prune -f

# Remove all unused Docker images
docker image prune -a -f

# Clear npm cache
npm cache clean --force

# Reinstall dependencies (optional, if needed)
cd backend/services/auth-service
rm -rf node_modules package-lock.json
npm install

# Rebuild and start everything (from project root)
cd ../../..
docker-compose up -d --build

# Or start backend only (from backend/)
cd backend
npm run docker:start

# Verify backend services are healthy
npm run docker:health

# Verify frontend is accessible
curl -I http://localhost:4200

# Check all containers
docker ps
```

### Getting Help

If you encounter issues not covered here:

1. **Check Logs**: `npm run docker:logs [service-name]`
2. **Check GitHub Issues**: Search for similar problems
3. **Enable Debug Logging**: Set `LOG_LEVEL=debug` in .env
4. **Test Endpoints**: Use Postman collection for systematic testing
5. **Verify Environment**: Ensure all prerequisites are met

# Phase 0.1: Nx Monorepo Setup - Implementation Plan

## Overview

Install and configure Nx for the existing NestJS + Angular project. This phase **ONLY** sets up Nx workspace infrastructure and migrates existing apps to the Nx structure **WITHOUT** extracting shared libraries.

## Scope - Phase 0.1 Only

✅ **In Scope:**
- Install Nx and configure workspace
- Migrate 5 NestJS services to apps/ (keeping duplicated code)
- Migrate Angular frontend to apps/
- Configure build caching and affected commands
- Update Docker to work with new structure
- Update CI/CD

❌ **Out of Scope (Future Phases):**
- NO shared library extraction (Phase 0.4)
- NO infrastructure folder move (Phase 0.2)
- NO RxJS fix (Phase 0.3)

## Configuration Decisions

- **Package Manager**: npm (keep existing)
- **Nx Cloud**: No (local caching only, can enable later)
- **Migration Strategy**: All apps at once
- **Git Branch**: Work in current branch (dev)
- **Estimated Time**: 4-5 hours

## Target Structure After Migration

```
nest-project/
├── apps/
│   ├── frontend/                    # Angular 18 (migrated as-is)
│   ├── api-gateway/                 # NestJS gateway (with duplicated code)
│   ├── auth-service/                # NestJS auth (with duplicated code)
│   ├── suggestion-service/          # NestJS suggestions (with duplicated code)
│   ├── history-service/             # NestJS history (with duplicated code)
│   └── favorite-service/            # NestJS favorites (with duplicated code)
├── libs/                            # Empty for now (Phase 0.4)
├── backend/                         # Keep existing structure
│   ├── infrastructure/              # Keep here (Phase 0.2 will move)
│   └── scripts/                     # Keep remove-duplicate-rxjs.js
├── nx.json                          # Nx workspace config
├── tsconfig.base.json               # Root TypeScript config
└── package.json                     # Root dependencies
```

## Implementation Steps

### Step 1: Initialize Nx Workspace (45 min)

1. **Install Nx globally:**
   ```bash
   npm install -g nx@latest
   ```

2. **Add name to root package.json:**
   Nx requires the root package.json to have a name field.
   ```json
   {
     "name": "suggestify-monorepo",
     "version": "1.0.0",
     "private": true,
     ...
   }
   ```

3. **Initialize Nx in existing workspace:**
   ```bash
   npx nx@latest init --integrated
   ```
   This creates:
   - `nx.json` with basic configuration
   - `.nx/cache` directory
   - Nx dependencies in package.json

   Note: We'll skip the plugin prompts for now and install what we need in Step 2

4. **Configure `nx.json`:**
   ```json
   {
     "$schema": "./node_modules/nx/schemas/nx-schema.json",
     "defaultBase": "dev",
     "namedInputs": {
       "default": ["{projectRoot}/**/*", "sharedGlobals"],
       "production": [
         "default",
         "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
         "!{projectRoot}/tsconfig.spec.json",
         "!{projectRoot}/jest.config.[jt]s"
       ],
       "sharedGlobals": []
     },
     "targetDefaults": {
       "build": {
         "dependsOn": ["^build"],
         "inputs": ["production", "^production"],
         "cache": true
       },
       "test": {
         "inputs": ["default", "^production"],
         "cache": true
       },
       "lint": {
         "inputs": ["default"],
         "cache": true
       }
     },
     "tasksRunnerOptions": {
       "default": {
         "runner": "nx/tasks-runners/default",
         "options": {
           "cacheableOperations": ["build", "lint", "test", "e2e"],
           "cacheDirectory": ".nx/cache"
         }
       }
     }
   }
   ```

5. **Create `tsconfig.base.json`:**
   ```json
   {
     "compileOnSave": false,
     "compilerOptions": {
       "rootDir": ".",
       "sourceMap": true,
       "declaration": false,
       "moduleResolution": "node",
       "emitDecoratorMetadata": true,
       "experimentalDecorators": true,
       "target": "ES2021",
       "module": "esnext",
       "lib": ["ES2021", "dom"],
       "skipLibCheck": true,
       "skipDefaultLibCheck": true,
       "baseUrl": ".",
       "paths": {}
     },
     "exclude": ["node_modules", "tmp"]
   }
   ```
   Note: No path mappings yet (Phase 0.4 will add them)

### Step 2: Install Nx Plugins (5 min)

Before migrating services, install the required Nx plugins:

```bash
npm install --save-dev @nx/nest @nx/node @nx/webpack @nx/angular
```

These plugins are needed to:
- `@nx/nest` - Generate and build NestJS applications
- `@nx/node` - Node.js executors and utilities
- `@nx/webpack` - Webpack build executor
- `@nx/angular` - Generate and build Angular applications

### Step 3: Migrate Backend Services (2 hours)

For each service: api-gateway, auth-service, suggestion-service, history-service, favorite-service

1. **Generate Nx application:**
2. 
   ```bash
   npx nx g @nx/nest:application --name=<service-name> --directory=apps/<service-name> --skipPackageJson
   ```

2. **Copy existing code:**
   ```bash
   # Remove generated files
   rm -rf apps/<service-name>/src/*

   # Copy source AS-IS (keep all duplicated code)
   cp -r backend/services/<service-name>/src/* apps/<service-name>/src/

   # Copy configs
   cp backend/services/<service-name>/nest-cli.json apps/<service-name>/
   cp backend/services/<service-name>/tsconfig.json apps/<service-name>/
   cp backend/services/<service-name>/.eslintrc.js apps/<service-name>/ 2>/dev/null || true
   ```

3. **Key Points:**
   - **Do NOT modify imports** - keep existing relative paths
   - **Keep all infrastructure folders** (metrics, consul, circuit-breaker, health)
   - **No code changes** - just copy as-is

4. **Configure `project.json`:**
   ```json
   {
     "name": "<service-name>",
     "$schema": "../../node_modules/nx/schemas/project-schema.json",
     "sourceRoot": "apps/<service-name>/src",
     "projectType": "application",
     "targets": {
       "build": {
         "executor": "@nx/webpack:webpack",
         "outputs": ["{options.outputPath}"],
         "options": {
           "target": "node",
           "compiler": "tsc",
           "outputPath": "dist/apps/<service-name>",
           "main": "apps/<service-name>/src/main.ts",
           "tsConfig": "apps/<service-name>/tsconfig.app.json",
           "webpackConfig": "apps/<service-name>/webpack.config.js"
         }
       },
       "serve": {
         "executor": "@nx/js:node",
         "options": {
           "buildTarget": "<service-name>:build"
         }
       },
       "lint": {
         "executor": "@nx/eslint:lint"
       },
       "test": {
         "executor": "@nx/jest:jest",
         "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
         "options": {
           "jestConfig": "apps/<service-name>/jest.config.ts"
         }
       }
     },
     "tags": ["scope:backend", "type:app"]
   }
   ```

5. **Keep `backend/services/` for now** (delete after verification)

### Step 4: Migrate Frontend (1 hour)

1. **Generate Angular application:**
   ```bash
   npx nx g @nx/angular:application --name=frontend --directory=apps/frontend --style=scss --routing=true --skipPackageJson
   ```

2. **Copy existing frontend:**
   ```bash
   # Remove generated files
   rm -rf apps/frontend/src/*

   # Copy source
   cp -r frontend/src/* apps/frontend/src/

   # Copy configs
   cp frontend/angular.json apps/frontend/ 2>/dev/null || true
   cp frontend/tsconfig.json apps/frontend/
   cp frontend/.eslintrc.json apps/frontend/ 2>/dev/null || true
   ```

3. **Configure `project.json`:**
   ```json
   {
     "name": "frontend",
     "$schema": "../../node_modules/nx/schemas/project-schema.json",
     "projectType": "application",
     "sourceRoot": "apps/frontend/src",
     "prefix": "app",
     "targets": {
       "build": {
         "executor": "@angular-devkit/build-angular:application",
         "outputs": ["{options.outputPath}"],
         "options": {
           "outputPath": "dist/apps/frontend",
           "index": "apps/frontend/src/index.html",
           "browser": "apps/frontend/src/main.ts",
           "polyfills": ["zone.js"],
           "tsConfig": "apps/frontend/tsconfig.app.json",
           "inlineStyleLanguage": "scss",
           "assets": [
             "apps/frontend/src/favicon.ico",
             "apps/frontend/src/assets"
           ],
           "styles": ["apps/frontend/src/styles.scss"],
           "scripts": []
         }
       },
       "serve": {
         "executor": "@angular-devkit/build-angular:dev-server",
         "configurations": {
           "development": {
             "buildTarget": "frontend:build:development"
           }
         },
         "defaultConfiguration": "development"
       },
       "test": {
         "executor": "@angular-devkit/build-angular:karma",
         "options": {
           "polyfills": ["zone.js", "zone.js/testing"],
           "tsConfig": "apps/frontend/tsconfig.spec.json",
           "assets": ["apps/frontend/src/assets"],
           "styles": ["apps/frontend/src/styles.scss"]
         }
       },
       "lint": {
         "executor": "@nx/eslint:lint"
       }
     },
     "tags": ["scope:frontend", "type:app"]
   }
   ```

4. **Keep `frontend/` folder for now** (delete after verification)

### Step 5: Update Docker Configuration (1 hour)

**Important**: Keep infrastructure in `backend/infrastructure/` for now (Phase 0.2 will move it)

1. **Create Nx-aware Dockerfile template:**

Create `backend/infrastructure/Dockerfile.nx-services`:
```dockerfile
# Multi-stage build for Nx NestJS apps
ARG SERVICE_NAME
ARG SERVICE_PORT=3000

# Stage 1: Builder
FROM node:20-alpine AS builder
ARG SERVICE_NAME

WORKDIR /app

# Copy workspace files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nx.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY apps/${SERVICE_NAME} ./apps/${SERVICE_NAME}

# Build with Nx
RUN npx nx build ${SERVICE_NAME} --prod

# Stage 2: Production
FROM node:20-alpine AS production
ARG SERVICE_NAME
ARG SERVICE_PORT

RUN apk add --no-cache dumb-init

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist/apps/${SERVICE_NAME} ./dist

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE ${SERVICE_PORT}

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${SERVICE_PORT}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

2. **Update `backend/infrastructure/docker-compose.yml`:**

For each backend service, update the build section:
```yaml
auth-service:
  build:
    context: ../..  # Changed from .
    dockerfile: backend/infrastructure/Dockerfile.nx-services
    args:
      SERVICE_NAME: auth-service
      SERVICE_PORT: 3001
  # ... rest remains the same
```

Repeat for all 5 services (api-gateway, auth-service, suggestion-service, history-service, favorite-service)

3. **Update root `package.json` scripts:**
```json
{
  "scripts": {
    "start": "docker compose -f backend/infrastructure/docker-compose.yml up -d --build",
    "stop": "docker compose -f backend/infrastructure/docker-compose.yml down && node backend/scripts/stop-and-reset.js",
    "reset": "docker compose -f backend/infrastructure/docker-compose.yml down -v",
    "logs": "docker compose -f backend/infrastructure/docker-compose.yml logs -f",
    "build:all": "nx run-many --target=build --all",
    "test:all": "nx run-many --target=test --all",
    "lint:all": "nx run-many --target=lint --all",
    "affected:build": "nx affected --target=build",
    "affected:test": "nx affected --target=test",
    "affected:lint": "nx affected --target=lint"
  }
}
```

### Step 6: Update CI/CD Pipeline (30 min)

Update `.github/workflows/angular-test.yml`:

```yaml
name: Frontend + Backend Tests

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for Nx affected commands

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Derive appropriate SHAs for Nx affected commands
        uses: nrwl/nx-set-shas@v4

      - name: Cache Nx
        uses: actions/cache@v3
        with:
          path: .nx/cache
          key: nx-${{ runner.os }}-${{ github.sha }}
          restore-keys: |
            nx-${{ runner.os }}-

      - name: Run affected linting
        run: npx nx affected --target=lint --parallel=3

      - name: Run affected tests
        run: npx nx affected --target=test --parallel=3

      - name: Upload frontend coverage
        if: success()
        uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage
          path: coverage/apps/frontend

      - name: Build affected apps
        run: npx nx affected --target=build --parallel=3
```

### Step 7: Verification (1 hour)

0. **Install missing dependencies:**
   ```bash
   npm install --save-dev @nx/playwright @playwright/test @nx/eslint-plugin @eslint/js eslint typescript-eslint webpack-cli
   ```
   Note: These are referenced by e2e projects, ESLint config, and webpack build configs generated in Steps 3-4

1. **Verify Nx graph:**
   ```bash
   npx nx graph
   ```
   - Check all apps appear
   - No circular dependencies
   - No unexpected dependencies

2. **Test builds:**
   ```bash
   # Test single app first
   npx nx build api-gateway

   # Build all apps
   npx nx run-many --target=build --all

   # Build only affected (simulate PR)
   npx nx affected --target=build --base=HEAD~1
   ```

3. **Test individual services:**
   ```bash
   # Start api-gateway
   npx nx serve api-gateway

   # In another terminal, test health
   curl http://localhost:3000/health
   ```

4. **Test all tests:**
   ```bash
   npx nx run-many --target=test --all
   ```

5. **Test Docker builds:**
   ```bash
   # Start all services
   npm run start

   # Check health endpoints
   curl http://localhost:3000/health  # api-gateway
   curl http://localhost:3001/health  # auth-service
   curl http://localhost:3002/health  # suggestion-service
   curl http://localhost:3003/health  # history-service
   curl http://localhost:3004/health  # favorite-service

   # Check frontend
   curl http://localhost:4200

   # Stop services
   npm run stop
   ```

6. **Test caching:**
   ```bash
   # Build once
   npx nx build api-gateway

   # Build again - should be instant (cached)
   npx nx build api-gateway
   ```

### Step 8: Cleanup (30 min)

**Only proceed after ALL verification passes!**

1. **Remove old structure:**
   ```bash
   rm -rf backend/services
   rm -rf frontend
   ```

   **Note**: Keep `backend/scripts/remove-duplicate-rxjs.js` - Phase 0.3 will remove it

2. **Update README.md:**

Add Nx commands section:
```markdown
## Development with Nx

### Serve Applications
- Frontend: `npx nx serve frontend`
- API Gateway: `npx nx serve api-gateway`
- Auth Service: `npx nx serve auth-service`
- Any service: `npx nx serve <app-name>`

### Build
- Build all: `npx nx run-many --target=build --all`
- Build affected: `npx nx affected --target=build`
- Build specific: `npx nx build <app-name>`

### Test
- Test all: `npx nx run-many --target=test --all`
- Test affected: `npx nx affected --target=test`
- Test specific: `npx nx test <app-name>`

### Lint
- Lint all: `npx nx run-many --target=lint --all`
- Lint affected: `npx nx affected --target=lint`

### Nx Utilities
- View dependency graph: `npx nx graph`
- Clear cache: `npx nx reset`
- See what's affected: `npx nx affected:graph`

### Docker (unchanged)
- Start all: `npm run start`
- Stop all: `npm run stop`
- Reset volumes: `npm run reset`
- View logs: `npm run logs`
```

3. **Commit changes:**

User will commit manually when ready.

## Verification Checklist

Before marking Phase 0.1 complete:

### Functionality
- [ ] All services start with `npx nx serve <app>`
- [ ] Health endpoints respond (ports 3000-3004)
- [ ] Docker Compose brings up all services
- [ ] API Gateway routes to all services
- [ ] Consul registers all services
- [ ] Frontend loads on http://localhost:4200

### Testing
- [ ] All unit tests pass: `npx nx run-many --target=test --all`
- [ ] All e2e tests pass
- [ ] Frontend tests pass with coverage
- [ ] No test failures introduced

### Build
- [ ] All apps build successfully
- [ ] Docker images build for all services
- [ ] No TypeScript errors
- [ ] Build output in `dist/apps/` structure

### Nx Features
- [ ] Dependency graph displays correctly
- [ ] Affected commands work: `npx nx affected --target=build`
- [ ] Build caching works (second build is instant)
- [ ] Test caching works
- [ ] Lint caching works

### CI/CD
- [ ] GitHub Actions workflow runs successfully
- [ ] Affected commands run in CI
- [ ] Nx cache works in CI (if enabled)
- [ ] All jobs pass

## Rollback Strategy

If something goes wrong:

### Quick Rollback
Since we're working in the dev branch:
```bash
git status          # Check uncommitted changes
git restore .       # Restore all changes
git clean -fd       # Remove untracked files
```

Or restore specific areas:
```bash
git restore apps/
git restore nx.json tsconfig.base.json package.json
```

### Safe Migration Points
Recommended to commit after each step:
- After Step 1: "chore: initialize Nx workspace"
- After Step 2: "feat: migrate backend services to Nx"
- After Step 3: "feat: migrate frontend to Nx"
- After Step 4: "feat: update Docker for Nx"
- After Step 5: "feat: update CI/CD for Nx"

Can use `git reset --soft HEAD~1` to undo last commit if needed.

## Benefits After Phase 0.1

### Build Performance
- 50-80% faster incremental builds with Nx caching
- Local cache speeds up repeated builds
- Only rebuild what changed

### CI Performance
- Only affected projects build/test
- Saves CI compute time and costs
- Faster feedback on PRs

### Developer Experience
- Single commands to build/test all apps
- Visual dependency graph: `npx nx graph`
- Affected commands: `npx nx affected --target=build`
- Better understanding of project structure

### Foundation for Future Phases
- Phase 0.2: Move infrastructure to root
- Phase 0.3: Remove RxJS hack (Nx handles it)
- Phase 0.4: Extract shared libraries (80% code reduction)
- Phase 0.5: Pre-commit hooks

## Next Steps After Phase 0.1

### Phase 0.2: Restructure Infrastructure Folder (0.5 day)
- Move `backend/infrastructure/` to root `infrastructure/`
- Update docker-compose paths
- Update CI/CD references

### Phase 0.3: Fix RxJS Duplication Hack (0.5 day)
- Remove `backend/scripts/remove-duplicate-rxjs.js`
- Let Nx handle dependency deduplication properly

### Phase 0.4: Extract Shared Libraries (2-3 days)
- Create libs/backend/metrics
- Create libs/backend/consul (make configurable)
- Create libs/backend/circuit-breaker
- Create libs/backend/health
- Update all services to use shared libraries
- Eliminate ~1,250 lines of duplicated code

### Phase 0.5: Pre-commit Hooks (0.5 day)
- Install Husky + lint-staged
- Run ESLint + Prettier on commit
- Run tests before push
- Enforce code quality

## Common Issues & Solutions

### Issue: "Cannot find module '@nx/...'"
**Solution:**
```bash
npm install --save-dev @nx/nest @nx/angular @nx/webpack @nx/js @nx/eslint
```

### Issue: Build fails with "Cannot find tsconfig"
**Solution:** Ensure tsconfig.base.json exists at root and all apps have their own tsconfig.json

### Issue: Tests fail after migration
**Solution:** Check that test files are copying correctly and jest.config.ts paths are updated

### Issue: Docker build fails
**Solution:** Verify build context is `../..` (two levels up) and paths reference `apps/<service-name>`

### Issue: Nx cache not working
**Solution:**
```bash
npx nx reset  # Clear cache
npx nx build <app> --skip-nx-cache  # Bypass cache for debugging
```

### Issue: Circular dependency errors
**Solution:** Check `nx graph` - apps should not depend on each other, only on libs (in Phase 0.4)

## Critical Files Reference

Files to reference during migration:

1. **backend/services/api-gateway/src/**
   - Template service structure

2. **backend/services/auth-service/src/**
   - PostgreSQL + TypeORM pattern

3. **backend/services/history-service/src/**
   - MongoDB + Mongoose pattern

4. **frontend/src/**
   - Angular app structure

5. **backend/infrastructure/docker-compose.yml**
   - Docker orchestration to update

6. **.github/workflows/angular-test.yml**
   - CI/CD pipeline to update

## Timeline Summary

- **Step 1 (Nx Init)**: 45 minutes
- **Step 2 (Backend)**: 2 hours
- **Step 3 (Frontend)**: 1 hour
- **Step 4 (Docker)**: 1 hour
- **Step 5 (CI/CD)**: 30 minutes
- **Step 6 (Verification)**: 1 hour
- **Step 7 (Cleanup)**: 30 minutes

**Total: 6.5-7 hours** (can be done in 1-2 days)

---

**Phase 0.1 Status**: Ready to implement
**Next Phase**: Phase 0.2 - Restructure Infrastructure Folder

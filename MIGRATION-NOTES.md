# Migration Notes: Nx Monorepo Adoption

This document records non-obvious decisions and breaking changes introduced during the Nx workspace migration. See `ENHANCEMENT-PLAN.md` for the full roadmap and `PHASE-0.2-PACKAGE-UPDATES.md` for the detailed Phase 0.2 log.

---

## Phase 0.1 — Nx Workspace Setup

### Project layout change

All application source code moved from:
- `backend/services/<name>/` → `apps/<name>/`
- `frontend/` → `apps/frontend/`

Docker build contexts in `backend/infrastructure/docker-compose.yml` updated to use `../../apps/<name>` paths.

### Build system

| Project | Executor | Notes |
|---|---|---|
| `api-gateway` | `@nx/webpack:webpack` | custom webpack config at `apps/api-gateway/webpack.config.js` |
| `auth-service` | `@nx/webpack:webpack` | same pattern |
| `suggestion-service` | `@nx/webpack:webpack` | same pattern |
| `history-service` | `@nx/webpack:webpack` | same pattern |
| `favorite-service` | `@nx/webpack:webpack` | same pattern |
| `frontend` | `@angular/build:application` | Angular CLI builder, Vite under the hood |

### CI/CD

`.github/workflows/angular-test.yml` updated from legacy Angular-only to full Nx affected pipeline:
- `npx nx affected --target=lint --parallel=3`
- `npx nx affected --target=test --parallel=3`
- `npx nx affected --target=build --parallel=3`
- Requires `fetch-depth: 0` for `nx-set-shas` to compute the base SHA.

---

## Phase 0.2 — Package Updates & Quality

### Backend test infrastructure (new)

Backend services had no Jest setup after the Nx migration. Added to all 5 services:

- `apps/<service>/jest.config.ts` — ts-jest transform, `testEnvironment: 'node'`
- `apps/<service>/tsconfig.spec.json` — extends service tsconfig, adds `jest` and `node` types
- `apps/<service>/project.json` — added `test` target using `@nx/jest:jest` executor

> **Note**: The `@nx/jest:jest` executor is deprecated as of Nx 23 and will be removed in Nx 24. Migration to inferred targets (`nx g @nx/jest:convert-to-inferred`) is deferred to Phase 0.3+.

### Frontend test executor

Frontend uses `@angular/build:unit-test` (Vitest 4), **not** `@nx/jest:jest`. Coverage requires `@vitest/coverage-v8` as a dev dependency.

### ESLint flat config

All projects now use ESLint flat config (`.eslintrc.js` removed from `api-gateway`, replaced by `eslint.config.mjs`).

Required packages added:
- `angular-eslint` — provides `nx.configs["flat/angular"]` and `nx.configs["flat/angular-template"]`
- `eslint-plugin-playwright` — required by `test/e2e/frontend/eslint.config.mjs`

### Angular 22 modernization

The following breaking/style changes were applied to the Angular frontend to pass `angular-eslint` rules:

| Rule | Change |
|---|---|
| `@angular-eslint/prefer-control-flow` | All `*ngIf` / `*ngFor` replaced with `@if` / `@for` in 7 templates |
| `@angular-eslint/prefer-inject` | Constructor injection converted to `inject()` in 9 files |
| `@angular-eslint/no-output-native` | `@Output() cancel` renamed to `@Output() loginCancel` in `LoginComponent`; all call sites updated |

**Affected templates**: `favorites`, `header`, `login`, `main-page`, `recommendations`, `recommendations-history`, `smart-picks`.

**Affected class files**: all of the above components + `auth.interceptor.ts`, `hateoas.interceptor.ts`.

### Removed packages

- `vite-tsconfig-paths` — was installed but unused; the frontend `tsconfig.json` defines no `paths` aliases.

### Backend E2E tests (deferred)

The Nx-generated backend E2E test scaffolding under `test/e2e/` contains only placeholder stubs (no real assertions). Rewriting them against running services is tracked as **Phase 0.3** in `ENHANCEMENT-PLAN.md`.

---

## Running tests after migration

```bash
# Frontend (Vitest)
npm exec -- nx run frontend:test

# Backend (Jest / ts-jest)
npm exec -- nx run auth-service:test
npm exec -- nx run-many -t test -p api-gateway auth-service suggestion-service history-service favorite-service

# Coverage
npm exec -- nx run frontend:test --coverage          # requires @vitest/coverage-v8
npm exec -- nx run api-gateway:test -- --coverage   # Jest --coverage flag
```

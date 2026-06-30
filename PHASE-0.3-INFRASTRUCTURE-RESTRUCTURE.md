# Phase 0.3: Restructure Infrastructure Folder - Implementation Plan

## Overview

Move `backend/infrastructure/` to root-level `infrastructure/`. The infrastructure folder orchestrates the entire system — frontend, all backend services, databases, message broker, service discovery, and monitoring. Keeping it nested inside `backend/` is misleading because it is not backend-only.

## Scope

✅ **In Scope:**
- Move `backend/infrastructure/` → `infrastructure/`
- Update all path references in docker-compose, npm scripts, and helper scripts
- Update root `docker-compose.yml` include directive
- Update documentation references

❌ **Out of Scope:**
- No changes to Dockerfile content (only their location)
- No changes to docker-compose service definitions
- No changes to monitoring configuration
- No infrastructure feature changes
- No CI/CD pipeline (not yet set up — Phase 6)

## Why This Matters

### Current State
```
nest-project/
├── backend/
│   ├── infrastructure/       ← orchestrates the WHOLE system
│   │   ├── docker-compose.yml
│   │   ├── Dockerfile.frontend
│   │   ├── Dockerfile.nx-services
│   │   ├── .env
│   │   └── monitoring/
│   └── scripts/
│       └── stop-and-reset.js
├── apps/                     ← frontend lives here too
└── docker-compose.yml        ← thin wrapper that includes backend/infrastructure/
```

The `backend/infrastructure/` folder:
- Contains `Dockerfile.frontend` — not backend at all
- Contains `docker-compose.yml` that starts the Angular frontend container
- Manages Prometheus/Grafana which monitor all services
- Is clearly a workspace-level concern, not a backend concern

### Target State
```
nest-project/
├── infrastructure/           ← workspace-level, owns the whole system
│   ├── docker-compose.yml
│   ├── Dockerfile.frontend
│   ├── Dockerfile.nx-services
│   ├── .env
│   └── monitoring/
├── backend/
│   └── scripts/
│       └── stop-and-reset.js
├── apps/
└── docker-compose.yml        ← updated include path
```

## Current Folder Contents

```
backend/infrastructure/
├── .env                                         JWT_SECRET=<generated>
├── Dockerfile.frontend                          Angular build → nginx
├── Dockerfile.nx-services                       NestJS multi-stage build
├── docker-compose.yml                           Full stack (15 services)
└── monitoring/
    ├── prometheus.yml                           Scrape targets config
    └── provisioning/
        ├── dashboards/
        │   ├── dashboard-provider.yml
        │   ├── P95-latency-dashboard.json
        │   ├── correct-rate-dashboard.json
        │   ├── error-rate-dashboard.json
        │   └── request-rate-dashboard.json
        └── datasources/
            └── prometheus.yml
```

## All References to Update

### Functional (break if not updated)

| File                                                  | Current reference                                    | Updated reference                                                  |
|-------------------------------------------------------|------------------------------------------------------|--------------------------------------------------------------------|
| `docker-compose.yml` (root)                           | `include: backend/infrastructure/docker-compose.yml` | `include: infrastructure/docker-compose.yml`                       |
| `package.json` (root) — `start`                       | `-f backend/infrastructure/docker-compose.yml`       | `-f infrastructure/docker-compose.yml`                             |
| `package.json` (root) — `stop`                        | `-f backend/infrastructure/docker-compose.yml`       | `-f infrastructure/docker-compose.yml`                             |
| `package.json` (root) — `reset`                       | `-f backend/infrastructure/docker-compose.yml`       | `-f infrastructure/docker-compose.yml`                             |
| `package.json` (root) — `logs`                        | `-f backend/infrastructure/docker-compose.yml`       | `-f infrastructure/docker-compose.yml`                             |
| `backend/package.json` — `docker:start`               | `cd infrastructure`                                  | `cd ../../infrastructure` (or drop — root scripts supersede these) |
| `backend/package.json` — `docker:logs`                | `cd infrastructure`                                  | `cd ../../infrastructure` (or drop)                                |
| `backend/scripts/stop-and-reset.js`                   | `path.join(__dirname, '../infrastructure')`          | `path.join(__dirname, '../../infrastructure')`                     |
| `infrastructure/docker-compose.yml` — build contexts  | `context: ../..`                                     | `context: ..`                                                      |
| `infrastructure/docker-compose.yml` — Dockerfile refs | `dockerfile: backend/infrastructure/Dockerfile.*`    | `dockerfile: infrastructure/Dockerfile.*`                          |

### Documentation (no functional impact)

| File                             | Update needed                               |
|----------------------------------|---------------------------------------------|
| `README.md`                      | Path references to `backend/infrastructure` |
| `ENHANCEMENT-PLAN.md`            | Phase 0.3 description mentions old path     |
| `PHASE-0.2-PACKAGE-UPDATES.md`   | "Next Steps" section                        |
| `PHASE-0.2-COMPLETION-REPORT.md` | Any path references                         |
| `PHASE-0.1-COMPLETION-REPORT.md` | Any path references                         |
| `MIGRATION-NOTES.md`             | Any path references                         |

---

## Implementation Steps

### Step 1: Move the folder (10 min)

```bash
mv backend/infrastructure infrastructure
```

Verify:
```bash
ls infrastructure/
# Dockerfile.frontend  Dockerfile.nx-services  docker-compose.yml  .env  monitoring/
```

### Step 2: Update root `docker-compose.yml` (5 min)

**File:** `docker-compose.yml`

Before:
```yaml
include:
  - backend/infrastructure/docker-compose.yml
```

After:
```yaml
include:
  - infrastructure/docker-compose.yml
```

### Step 3: Update build contexts and Dockerfile paths inside docker-compose (15 min)

**File:** `infrastructure/docker-compose.yml`

The file moved from `backend/infrastructure/` (2 levels deep) to `infrastructure/` (1 level deep), so build context changes.

**Build context** — all 6 service blocks:

Before (relative to `backend/infrastructure/`):
```yaml
context: ../..
```

After (relative to `infrastructure/`):
```yaml
context: ..
```

**Dockerfile paths** — all 6 service blocks:

Before:
```yaml
dockerfile: backend/infrastructure/Dockerfile.nx-services
```
After:
```yaml
dockerfile: infrastructure/Dockerfile.nx-services
```

Before (frontend):
```yaml
dockerfile: backend/infrastructure/Dockerfile.frontend
```
After:
```yaml
dockerfile: infrastructure/Dockerfile.frontend
```

**Volume mounts** — no change needed. Paths like `./monitoring/prometheus.yml` are relative to the compose file location and will still resolve correctly after the move.

### Step 4: Update root `package.json` scripts (5 min)

**File:** `package.json`

Before:
```json
"start": "docker compose -f backend/infrastructure/docker-compose.yml up -d --build",
"stop":  "docker compose -f backend/infrastructure/docker-compose.yml down && node backend/scripts/stop-and-reset.js",
"reset": "docker compose -f backend/infrastructure/docker-compose.yml down -v",
"logs":  "docker compose -f backend/infrastructure/docker-compose.yml logs -f"
```

After:
```json
"start": "docker compose -f infrastructure/docker-compose.yml up -d --build",
"stop":  "docker compose -f infrastructure/docker-compose.yml down && node backend/scripts/stop-and-reset.js",
"reset": "docker compose -f infrastructure/docker-compose.yml down -v",
"logs":  "docker compose -f infrastructure/docker-compose.yml logs -f"
```

### Step 5: Update `backend/scripts/stop-and-reset.js` (15 min)

**File:** `backend/scripts/stop-and-reset.js`

The script resolves the infrastructure path relative to its own location (`backend/scripts/`).

Before:
```javascript
const infrastructurePath = path.join(__dirname, '../infrastructure');
```

After:
```javascript
const infrastructurePath = path.join(__dirname, '../../infrastructure');
```

Also update any `.env` write path if present:
```javascript
// Before
path.join(__dirname, '../infrastructure/.env')
// After
path.join(__dirname, '../../infrastructure/.env')
```

### Step 6: Update `backend/package.json` legacy scripts (10 min)

**File:** `backend/package.json`

These legacy scripts use `cd infrastructure` relative to the `backend/` directory. After the move, `infrastructure/` is no longer inside `backend/`.

Before:
```json
"docker:start": "cd infrastructure && docker-compose up -d --build",
"docker:logs":  "cd infrastructure && docker-compose logs -f"
```

After (update to point to root-level infrastructure):
```json
"docker:start": "cd ../infrastructure && docker-compose up -d --build",
"docker:logs":  "cd ../infrastructure && docker-compose logs -f"
```

> **Note:** Root-level `npm start` / `npm run logs` supersede these. Consider removing the backend-level scripts entirely to avoid duplication.

### Step 7: Smoke test docker-compose config (15 min)

Validate the compose file parses correctly and paths resolve:

```bash
docker compose -f infrastructure/docker-compose.yml config
```

This command resolves all `include`, `context`, and volume paths and prints the merged config. It does not start any containers. Fix any path errors before proceeding.

Also validate via root wrapper:
```bash
docker compose config
```

### Step 8: Update documentation references (30 min)

Search for remaining references:
```bash
grep -r "backend/infrastructure" --include="*.md" -l
```

Update each file found — replace `backend/infrastructure` → `infrastructure` in:
- `README.md`
- `ENHANCEMENT-PLAN.md`
- `PHASE-0.2-PACKAGE-UPDATES.md` (Next Steps section)
- `PHASE-0.2-COMPLETION-REPORT.md`
- `PHASE-0.1-COMPLETION-REPORT.md`
- `MIGRATION-NOTES.md`

### Step 9: Full stack verification (60 min)

```bash
# Build and start all containers
npm start

# Wait ~90s for all services to become healthy, then check health endpoints
curl http://localhost:3000/health     # api-gateway
curl http://localhost:4200            # frontend
curl http://localhost:9090/-/ready    # prometheus
curl http://localhost:3050/api/health # grafana

# Stop everything
npm stop
```

---

## Verification Checklist

### Path changes
- [ ] `infrastructure/` folder exists at workspace root
- [ ] `backend/infrastructure/` folder is gone
- [ ] `docker-compose.yml` (root) — include path updated
- [ ] `infrastructure/docker-compose.yml` — all 6 `context: ..` (not `../..`)
- [ ] `infrastructure/docker-compose.yml` — all Dockerfile refs use `infrastructure/Dockerfile.*`
- [ ] `package.json` (root) — all 4 scripts use `infrastructure/docker-compose.yml`
- [ ] `backend/scripts/stop-and-reset.js` — path updated to `../../infrastructure`
- [ ] `backend/package.json` — legacy scripts updated or removed

### Functional verification
- [ ] `docker compose -f infrastructure/docker-compose.yml config` — no errors
- [ ] `docker compose config` (root wrapper) — no errors
- [ ] `npm start` — all containers start
- [ ] `curl http://localhost:3000/health` — api-gateway responds
- [ ] `curl http://localhost:4200` — frontend responds
- [ ] `npm stop` — all containers stop cleanly

### Documentation
- [ ] No remaining `backend/infrastructure` references in `*.md` files

---

## Rollback Strategy

If anything goes wrong, the move is fully reversible:

```bash
# Move folder back
mv infrastructure backend/infrastructure

# Revert file changes with git
git checkout docker-compose.yml
git checkout package.json
git checkout backend/package.json
git checkout backend/scripts/stop-and-reset.js
```

---

## Timeline Summary

| Step | Task                                                        | Time            |
|------|-------------------------------------------------------------|-----------------|
| 1    | Move the folder + verify git state                          | 10 min          |
| 2    | Update root docker-compose.yml                              | 5 min           |
| 3    | Update build contexts and Dockerfile paths                  | 15 min          |
| 4    | Update root package.json scripts                            | 5 min           |
| 5    | Update stop-and-reset.js                                    | 15 min          |
| 6    | Update backend/package.json                                 | 10 min          |
| 7    | Smoke test docker-compose config                            | 15 min          |
| 8    | Update documentation references                             | 30 min          |
| 9    | Full stack verification (docker compose up + health checks) | 60 min          |
|      | **Total**                                                   | **~2h 45min**   |

---

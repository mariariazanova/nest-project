# Phase 1.6: Development Tools — Completion Report

**Project**: Suggestify
**Phase**: 1.6 — Development Tools
**Status**: ✅ COMPLETE
**Date Completed**: July 20, 2026

---

## Executive Summary

Phase 1.6 added pgAdmin, Mongo Express, and Redis Commander as opt-in local dev services in a separate `infrastructure/docker-compose.dev.yml`. The file is layered on top of the main `docker-compose.yml` using Docker Compose's multi-file merge — the main compose is unchanged. Two npm scripts (`start:dev`, `stop:dev`) expose the combined stack without requiring developers to type the full `-f` flags. Three issues were found and fixed during bring-up: a network declaration conflict, a pgAdmin email validation regression in a newer image version, and Redis Commander being connected only to DB 0 while each service uses its own DB slot (0–4).

---

## Accomplishments

### Step 1: `infrastructure/docker-compose.dev.yml` ✅

Created a separate compose file with three services:

| Service           | Image                                   | Port        |
| ----------------- | --------------------------------------- | ----------- |
| `pgadmin`         | `dpage/pgadmin4:latest`                 | 5050 → 80   |
| `mongo-express`   | `mongo-express:latest`                  | 8081 → 8081 |
| `redis-commander` | `rediscommander/redis-commander:latest` | 8082 → 8081 |

All three attach to `microservices-network` and depend on the relevant database containers from the main compose. `pgadmin-data` volume persists pgAdmin server registrations across restarts.

---

### Step 2: npm scripts ✅

Added `start:dev` and `stop:dev` to `package.json`:

```json
"start:dev": "docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml up -d --build",
"stop:dev":  "docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml down"
```

`npm run start` (main stack only) is unchanged.

---

## Issues Encountered & Root Cause Analysis

### Issue 1: `microservices-network declared as external, but could not be found`

**Severity**: Startup failure (fixed)

**Problem**: Running `npm run start:dev` failed immediately — Docker Compose refused to start because `microservices-network` was declared `external: true` in `docker-compose.dev.yml` but the network did not exist yet.

**Root Cause**: The original plan declared the network as external in the dev compose file (the assumption being that the main stack would be started first and the network would pre-exist). When both files are passed together as `-f ... -f ...`, Docker Compose merges them at parse time before starting any containers. The merged config contained two conflicting declarations for the same network: the main compose creates it (`driver: bridge`), while the dev compose expects it to already exist (`external: true`). Docker Compose rejects this conflict.

**Solution**: Removed the entire `networks:` top-level section from `docker-compose.dev.yml`. The network definition from the main compose is inherited automatically during merge. Services in the dev compose reference `microservices-network` at the service level only.

---

### Issue 2: pgAdmin container restarting — `.local` TLD rejected

**Severity**: Container crash loop (fixed)

**Problem**: After removing the network conflict, pgAdmin started but immediately entered a restart loop. Logs showed:

```
'admin@suggestify.local' does not appear to be a valid email address.
Validation output: The part after the @-sign is a special-use or reserved name
that cannot be used with email.
```

**Root Cause**: A newer version of the `dpage/pgadmin4:latest` image added stricter email validation using the `email-validator` Python library, which rejects `.local` as a reserved/special-use TLD. The plan used `admin@suggestify.local` because it is a recognisable local-only domain, but this image version will not accept it.

**Solution**: Changed `PGADMIN_DEFAULT_EMAIL` from `admin@suggestify.local` to `admin@admin.com`. Updated the plan file to match.

---

### Issue 3: Redis Commander showing no cache keys

**Severity**: Missing data (fixed)

**Problem**: After a suggestion request was made, Redis Commander at `http://localhost:8082` showed no keys.

**Root Cause**: The original `REDIS_HOSTS` value was `local:redis:6379:0:redispass` — connecting only to Redis DB `0` (used by api-gateway). Each service uses its own DB slot:

| Service            | Redis DB |
| ------------------ | -------- |
| api-gateway        | `0`      |
| auth-service       | `1`      |
| suggestion-service | `2`      |
| favorite-service   | `3`      |
| history-service    | `4`      |

Suggestion cache keys are written to DB `2`. Redis Commander on DB `0` saw nothing.

**Solution**: Changed `REDIS_HOSTS` to connect to all 5 DB slots with named labels:

```
api-gateway:redis:6379:0:redispass,auth:redis:6379:1:redispass,suggestions:redis:6379:2:redispass,favorites:redis:6379:3:redispass,history:redis:6379:4:redispass
```

Redis Commander now shows 5 named connections in the left sidebar, each scoped to one service's DB slot.

---

## Verification Checklist

- ✅ `infrastructure/docker-compose.dev.yml` created
- ✅ `npm run start:dev` starts all 3 dev tool containers without error
- ✅ `http://localhost:5050` — pgAdmin loads; login `admin@admin.com` / `admin`; 3 Postgres servers added manually (one-time setup)
- ✅ `http://localhost:8081` — Mongo Express loads; `history_db` → `suggestionhistories` collection visible
- ✅ `http://localhost:8082` — Redis Commander loads; 5 named DB connections; suggestion cache keys visible after first request
- ✅ Main `infrastructure/docker-compose.yml` not modified
- ✅ `npm run start` (original script) unchanged

---

## Plan vs Actual Comparison

| Step                         | Estimate    | Actual         | Notes                                        |
| ---------------------------- | ----------- | -------------- | -------------------------------------------- |
| 1 — `docker-compose.dev.yml` | 30 min      | ~30 min        | Straightforward                              |
| 2 — Docker verification      | 15 min      | ~1 hour        | Three issues found and fixed during bring-up |
| **Total**                    | **~45 min** | **~1.5 hours** |                                              |

> **Why it took longer:** All three issues were discovered only at runtime — they could not be caught by reading the plan or the compose file alone. The network conflict was architectural (multi-file merge behaviour), the pgAdmin email issue was an undocumented breaking change in the image, and the Redis DB slot issue was invisible until a real suggestion request was made and the expected cache key was absent.

---

## Files Created

| File                                    | Description                                               |
| --------------------------------------- | --------------------------------------------------------- |
| `infrastructure/docker-compose.dev.yml` | Dev-only overlay: pgAdmin, Mongo Express, Redis Commander |
| `PHASE-1.6-COMPLETION-REPORT.md`        | This file                                                 |

## Files Modified

| File                     | Change                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `package.json`           | Added `start:dev` and `stop:dev` scripts                                                  |
| `PHASE-1.6-DEV-TOOLS.md` | Updated email to `admin@admin.com`; removed external network declaration from yaml sample |

---

## Findings from Verification

### Finding 1: pgAdmin server registration is not persisted declaratively

pgAdmin requires manually adding server connections (host, port, db, user, password) through the UI on first use. The `pgadmin-data` volume persists these registrations across restarts, but the initial setup is still manual. A `servers.json` pre-configuration file could automate this — excluded from scope as one-time manual setup is acceptable for local dev, but worth noting for onboarding new developers.

### Finding 2: Redis DB slot map is implicit

The mapping of service → Redis DB slot (auth=1, suggestions=2, favorites=3, history=4, api-gateway=0) exists only in each service's `app.module.ts`. There is no central config file or comment documenting it. The Redis Commander `REDIS_HOSTS` label names now make this visible in the UI, but a comment in `docker-compose.yml` or `docker-compose.dev.yml` would help future developers.

### Finding 3: `mongo-express` has no authentication

`ME_CONFIG_BASICAUTH: false` disables HTTP basic auth on Mongo Express. Anyone who can reach port 8081 can read and modify all MongoDB data. This is intentional for local dev convenience but should not be exposed on shared dev machines or any non-localhost network interface.

---

**Report Generated**: July 20, 2026
**Phase Status**: ✅ COMPLETE
**Next Phase**: Phase 1.7 — Graceful Shutdown & Circuit Breaker

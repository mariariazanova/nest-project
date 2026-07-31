# Phase 1.6: Development Tools — Implementation Plan

## Overview

Adds pgAdmin, Mongo Express, and Redis Commander as opt-in local dev services in a separate `docker-compose.dev.yml`. Seed data is already complete and runs automatically on startup. The main `docker-compose.yml` is not modified.

## Scope

✅ **In Scope:**

- `infrastructure/docker-compose.dev.yml` — pgAdmin (3 Postgres instances), Mongo Express (MongoDB), Redis Commander (Redis)

❌ **Out of Scope:**

- Custom pgAdmin `servers.json` pre-configuration file — manual connection setup on first use is sufficient for local dev

## Why This Matters

Currently inspecting Postgres, MongoDB, or Redis data requires CLI tools (`psql`, `mongosh`, `redis-cli`) or external GUI apps. Developers debugging data issues during local development have no web-based access to databases from within the Docker network.

pgAdmin, Mongo Express, and Redis Commander are standard containerised tools that run alongside the stack. They are not needed in production and should not be in the main `docker-compose.yml`. A separate `docker-compose.dev.yml` file enables them with a single command override.

**Note on seed data:** `SeedService.seedData()` already runs automatically on suggestion-service startup (`apps/suggestion-service/src/main.ts` lines 28–32). Moods, genres, events, books, films, games, and songs are populated on first start if the tables are empty. No changes needed.

---

## Implementation Steps

### Step 1: `infrastructure/docker-compose.dev.yml` (30 min)

Create a separate compose file. Run alongside the main compose with:

```bash
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml up -d
```

Or stop only dev tools while keeping the stack running:

```bash
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml stop pgadmin mongo-express redis-commander
```

**`infrastructure/docker-compose.dev.yml`**:

```yaml
# Development tools — NOT for production.
# Run with: docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml up -d

services:
  # pgAdmin — web UI for all 3 PostgreSQL instances
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@admin.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - '5050:80'
    volumes:
      - pgadmin-data:/var/lib/pgadmin
    networks:
      - microservices-network
    depends_on:
      - postgres-auth
      - postgres-suggestions
      - postgres-favorites
    restart: unless-stopped

  # Mongo Express — web UI for MongoDB (history-service)
  mongo-express:
    image: mongo-express:latest
    container_name: mongo-express
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: root
      ME_CONFIG_MONGODB_ADMINPASSWORD: rootpass
      ME_CONFIG_MONGODB_URL: mongodb://root:rootpass@mongodb:27017/
      ME_CONFIG_BASICAUTH: false
    ports:
      - '8081:8081'
    networks:
      - microservices-network
    depends_on:
      mongodb:
        condition: service_healthy
    restart: unless-stopped

  # Redis Commander — web UI for Redis
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: redis-commander
    environment:
      REDIS_HOSTS: local:redis:6379:0:redispass
    ports:
      - '8082:8081'
    networks:
      - microservices-network
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  pgadmin-data:

networks:
  microservices-network:
    external: true
    name: microservices-network
```

**First-use pgAdmin setup** (manual, one-time):

1. Open `http://localhost:5050`, log in with `admin@admin.com` / `admin`
2. Add Server → General name: `Auth DB` → Connection host: `postgres-auth`, port: `5432`, database: `auth_db`, user: `postgres`, password: `postgres`
3. Repeat for `postgres-suggestions` (port `5432`, db `suggestions_db`) and `postgres-favorites` (port `5432`, db `favorites_db`)

**Port assignments:**

| Tool            | URL                    | Connects to                         |
| --------------- | ---------------------- | ----------------------------------- |
| pgAdmin         | http://localhost:5050  | postgres-auth/suggestions/favorites |
| Mongo Express   | http://localhost:8081  | mongodb                             |
| Redis Commander | http://localhost:8082  | redis                               |
| RabbitMQ UI     | http://localhost:15672 | rabbitmq (already in main compose)  |
| Consul UI       | http://localhost:8500  | consul (already in main compose)    |

---

### Step 2: Build and verification (15 min)

```bash
# Start full stack with dev tools
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml up -d

# Verify dev tools are running
docker ps | grep -E "pgadmin|mongo-express|redis-commander"

# Open in browser
open http://localhost:5050    # pgAdmin
open http://localhost:8081    # Mongo Express
open http://localhost:8082    # Redis Commander
```

---

## Verification Checklist

- [ ] `infrastructure/docker-compose.dev.yml` created
- [ ] `docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml up -d` starts all 3 dev tool containers without error
- [ ] `http://localhost:5050` — pgAdmin loads and can connect to all 3 Postgres instances
- [ ] `http://localhost:8081` — Mongo Express loads and shows `history_db`
- [ ] `http://localhost:8082` — Redis Commander loads and shows Redis keys
- [ ] Main `infrastructure/docker-compose.yml` is not modified

---

## Rollback Strategy

```bash
# Stop dev tools and remove volume
docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.dev.yml \
  stop pgadmin mongo-express redis-commander
docker volume rm infrastructure_pgadmin-data
rm infrastructure/docker-compose.dev.yml
```

---

## Timeline Summary

| Step      | Task                                                                  | Time          |
| --------- | --------------------------------------------------------------------- | ------------- |
| 1         | `docker-compose.dev.yml` with pgAdmin, Mongo Express, Redis Commander | 30 min        |
| 2         | Docker verification                                                   | 1 hour        |
| **Total** |                                                                       | **1.5 hours** |

---

## Notes on What Is Already Done

- **Seed data** (`SeedService.seedData()`) — already implemented and runs automatically on `suggestion-service` startup. Tables are populated on first start if empty. No changes needed.
- **Seed data for development** — moods, genres, events, books, films, games, songs are all seeded from `apps/suggestion-service/src/data-base/data/`. The suggestion endpoint is usable immediately after `docker compose up`.

---

**Phase 1.6 Status**: Ready to implement
**Next Phase**: Phase 1.7 — Graceful Shutdown & Infrastructure Reliability

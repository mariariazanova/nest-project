# Migration Workflow

This document covers day-to-day TypeORM migration usage for the three PostgreSQL services: `auth-service`, `suggestion-service`, and `favorite-service`.

MongoDB (`history-service`) uses `migrate-mongo` — see Step 10 of PHASE-1.1-DATABASE-MIGRATIONS.md.

---

## Services and databases

| Service            | Database         | Port |
| ------------------ | ---------------- | ---- |
| auth-service       | `auth_db`        | 5432 |
| suggestion-service | `suggestions_db` | 5433 |
| favorite-service   | `favorites_db`   | 5434 |

---

## Prerequisites

PostgreSQL containers must be running before any migration command:

```bash
docker compose -f infrastructure/docker-compose.yml up postgres-auth postgres-suggestions postgres-favorites -d
```

---

## Commands

All commands are available as Nx targets. Run from the workspace root.

```bash
# Show which migrations are applied [X] and pending [ ]
npm exec nx -- run auth-service:"migration:show"

# Apply all pending migrations
npm exec nx -- run auth-service:"migration:run"

# Revert the last applied migration
npm exec nx -- run auth-service:"migration:revert"

# Generate a new migration by diffing entities vs current DB schema
npm exec nx -- run auth-service:"migration:generate" --args="--name=AddEmailToUser"
```

Replace `auth-service` with `suggestion-service` or `favorite-service` as needed.

### Without Nx (run from the service directory)

```bash
cd apps/auth-service

npx typeorm-ts-node-commonjs migration:show     -d src/data-source.ts
npx typeorm-ts-node-commonjs migration:run      -d src/data-source.ts
npx typeorm-ts-node-commonjs migration:revert   -d src/data-source.ts
npx typeorm-ts-node-commonjs migration:generate src/migrations/AddEmailToUser -d src/data-source.ts
```

Set `TS_NODE_PROJECT=tsconfig.app.json` if you see `Cannot find name 'process'` errors:

```bash
# PowerShell
$env:TS_NODE_PROJECT="tsconfig.app.json"

# Bash
export TS_NODE_PROJECT=tsconfig.app.json
```

---

## Adding a new migration

1. **Edit the entity** — add, rename, or remove a field
2. **Generate** — TypeORM diffs entity vs current DB schema and writes the migration file:
   ```bash
   npm exec nx -- run auth-service:"migration:generate" --args="--name=AddEmailToUser"
   ```
3. **Review** the generated file in `apps/auth-service/src/migrations/` — verify the SQL is correct
4. **Run** — applies all pending migrations:
   ```bash
   npm exec nx -- run auth-service:"migration:run"
   ```
5. **Commit** entity change and migration file together in the same PR

On the next deploy, `migrationsRun: true` in `app.module.ts` applies pending migrations automatically on service startup.

---

## Rolling back

```bash
# Revert the last applied migration (runs its down() method)
npm exec nx -- run auth-service:"migration:revert"
```

Repeat to revert multiple migrations one at a time.

---

## Rules

1. **Never edit a migration file after it has been run** against any environment. Create a new migration instead.
2. **Always commit the entity change and its migration together** in the same PR.
3. **Never re-enable `synchronize: true`** — it is destructive in production (drops columns TypeORM doesn't recognise).
4. Migration files in `src/migrations/` are permanent history — do not delete them.

---

## Special case: PostgreSQL ENUM changes

TypeORM's `migration:generate` **cannot detect enum value additions** — `ALTER TYPE enum_name ADD VALUE` is never produced automatically. Any time you add a value to a TypeScript enum used as a `@Column({ type: 'enum' })`, you must write the migration manually.

**Steps:**

```bash
# 1. Add the new value to the TypeScript enum
# 2. Generate an empty migration file
npm exec nx -- run auth-service:"migration:generate" --args="--name=AddAdminRole"
# 3. Open the generated file and fill in up() and down() manually:
```

```typescript
async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE 'admin'`);
}

async down(queryRunner: QueryRunner): Promise<void> {
  // PostgreSQL does not support DROP VALUE directly.
  // Recreate the type without the new value:
  await queryRunner.query(`
    CREATE TYPE "public"."users_role_enum_old" AS ENUM('user');
    ALTER TABLE "users"
      ALTER COLUMN "role" TYPE "public"."users_role_enum_old"
      USING "role"::text::"public"."users_role_enum_old";
    DROP TYPE "public"."users_role_enum";
    ALTER TYPE "public"."users_role_enum_old" RENAME TO "users_role_enum";
  `);
}
```

**Enums in this project that will be affected as features grow:**

- `CategoryType` in `suggestion-service` — if new media categories are added
- Role enum — when RBAC is introduced in Phase 3 (`user` → `user | admin`)

---

## Checking migration status in the database

TypeORM records every applied migration in a `migrations` table:

```bash
docker exec postgres-auth psql -U postgres -d auth_db -c "SELECT * FROM migrations"
```

```
 id |   timestamp   |            name
----+---------------+----------------------------
  1 | 1783082720307 | InitialSchema1783082720307
```

`[X]` in `migration:show` means a row exists here. `[ ]` means it has not been applied yet.

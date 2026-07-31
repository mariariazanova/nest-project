# Phase 1.1: Database Migrations Setup

**Project**: Suggestify
**Phase**: 1.1 — Database Migrations (TypeORM)
**Estimate**: 2-3 days (1 developer)
**Depends on**: Phase 0.x complete ✅

---

## Goal

- Replace `synchronize: true` with proper TypeORM migrations in all 3 PostgreSQL services
- Create a CLI-compatible `DataSource` config per service
- Add `migration:generate`, `migration:run`, `migration:revert` scripts via Nx targets
- Generate initial migrations from the current entity state
- Auto-run migrations on container startup (`migrationsRun: true`)
- Document the migration workflow for the team
- Fix existing entity type bugs surfaced during the audit

MongoDB (history-service) is schemaless — TypeORM migrations do not apply. Mongoose schema validation notes included at the end.

---

## Current State

| Service            | DB Type    | Port  | Database         | synchronize                   | Migrations |
| ------------------ | ---------- | ----- | ---------------- | ----------------------------- | ---------- |
| auth-service       | PostgreSQL | 5432  | `auth_db`        | `true` (dev) / `false` (prod) | ❌ None    |
| suggestion-service | PostgreSQL | 5433  | `suggestions_db` | `true` (dev) / `false` (prod) | ❌ None    |
| favorite-service   | PostgreSQL | 5434  | `favorites_db`   | `true` (dev) / `false` (prod) | ❌ None    |
| history-service    | MongoDB    | 27017 | `history_db`     | N/A (Mongoose)                | N/A        |

### Entities per service

**auth-service** (1 entity)

- `UserEntity` — `id (uuid)`, `username (unique)`, `password`, `createdAt`, `updatedAt`

**suggestion-service** (10 entities + join tables)

- `BookEntity`, `FilmEntity`, `GameEntity`, `SongEntity` — content tables
- `MoodEntity`, `GenreEntity`, `EventEntity` — classification tables
- `UserEntity`, `UserSuggestionEntity`, `UserSuggestionCategoryEntity` — user tracking
- 12 join tables auto-created by ManyToMany relations

**favorite-service** (1 entity)

- `FavoriteEntity` — `id (uuid)`, `userId (indexed)`, `itemId`, `category (enum)`, `title?`, `createdAt`, unique constraint `(userId, itemId, category)`

### Known bugs (found during audit)

- `BookEntity.id`, `GenreEntity.id`, `EventEntity.id` declared as `number` but decorated with `@PrimaryGeneratedColumn('uuid')` — should be `string`
- `suggestion-service/MoodEntity` — all 4 `@ManyToMany` inverse references point to `.genres` instead of `.moods` — wrong join table used for reverse lookups
- `suggestion-service/UserEntity` — `username` has no `unique: true` constraint, unlike `auth-service/UserEntity` — duplicate usernames allowed
- `suggestion-service/UserSuggestionCategoryEntity` — `mediaType` has no `@Index()` — unindexed filter column
- `suggestion-service/UserSuggestionEntity.criteria` — stored as `jsonb` but has fixed structure `{ mood, category, genre, event }` referencing existing entities — loses referential integrity and per-field indexing (deferred to Phase 2)
- `suggestion-service/UserEntity` — has a `password` column; suggestion-service has no business storing credentials — auth-service owns authentication
- `history-service/SuggestionHistory` — indexes already defined in Mongoose schema; migrate-mongo initial migration must not duplicate them

---

## Step 1: Create DataSource config files (1 hour)

TypeORM CLI needs a standalone `DataSource` instance (not the NestJS module) to generate and run migrations. Create one per PostgreSQL service.

### `apps/auth-service/src/data-source.ts`

```typescript
import { DataSource } from 'typeorm';
import { UserEntity } from './users/entities/user.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'auth_db',
  entities: [UserEntity],
  migrations: ['src/migrations/*.ts'],
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});
```

### `apps/suggestion-service/src/data-source.ts`

```typescript
import { DataSource } from 'typeorm';
import { BookEntity } from './suggestion/entities/book.entity';
import { FilmEntity } from './suggestion/entities/film.entity';
import { GameEntity } from './suggestion/entities/game.entity';
import { SongEntity } from './suggestion/entities/song.entity';
import { MoodEntity } from './shared/entities/mood.entity';
import { GenreEntity } from './shared/entities/genre.entity';
import { EventEntity } from './shared/entities/event.entity';
import { UserEntity } from './suggestion/entities/user.entity';
import { UserSuggestionEntity } from './suggestion/entities/user-suggestions.entity';
import { UserSuggestionCategoryEntity } from './suggestion/entities/user-suggestion-categories.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5433', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'suggestions_db',
  entities: [
    BookEntity,
    FilmEntity,
    GameEntity,
    SongEntity,
    MoodEntity,
    GenreEntity,
    EventEntity,
    UserEntity,
    UserSuggestionEntity,
    UserSuggestionCategoryEntity,
  ],
  migrations: ['src/migrations/*.ts'],
});
```

### `apps/favorite-service/src/data-source.ts`

```typescript
import { DataSource } from 'typeorm';
import { FavoriteEntity } from './favorite/entities/favorite.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5434', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'favorites_db',
  entities: [FavoriteEntity],
  migrations: ['src/migrations/*.ts'],
});
```

---

## Step 2: Add Nx migration targets (30 min)

Add custom executor targets to each service's `project.json`. This keeps migration commands within the Nx workflow so they benefit from caching and affected detection.

### Pattern (same for all 3 services — adjust paths)

Add under `"targets"` in `apps/auth-service/project.json`:

```json
"migration:generate": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx typeorm-ts-node-commonjs migration:generate src/migrations/{args.name} -d src/data-source.ts",
    "cwd": "apps/auth-service"
  }
},
"migration:run": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts",
    "cwd": "apps/auth-service"
  }
},
"migration:revert": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx typeorm-ts-node-commonjs migration:revert -d src/data-source.ts",
    "cwd": "apps/auth-service"
  }
},
"migration:show": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx typeorm-ts-node-commonjs migration:show -d src/data-source.ts",
    "cwd": "apps/auth-service"
  }
}
```

Apply the same block to `apps/suggestion-service/project.json` and `apps/favorite-service/project.json` with their respective `cwd` values.

### Usage

```bash
# Generate a migration (postgres must be running, name is required)
npm exec nx -- run auth-service:migration:generate --args="--name=InitialSchema"

# Run all pending migrations
npm exec nx -- run auth-service:migration:run

# Revert the last applied migration
npm exec nx -- run auth-service:migration:revert

# Show migration status
npm exec nx -- run auth-service:migration:show
```

### Install `typeorm-ts-node-commonjs` wrapper

TypeORM ships a separate CLI wrapper for ts-node CJS environments. Add it to root `devDependencies`:

```bash
npm install --save-dev typeorm
```

`typeorm-ts-node-commonjs` is included in the `typeorm` package — no separate install needed.

---

## Step 3: Fix entity type bugs (30 min)

These type mismatches will cause TypeScript errors once strict checks are enabled and will produce incorrect migration output (numeric ID columns instead of uuid).

### Files to fix

| File                                                             | Field | Current type | Correct type |
| ---------------------------------------------------------------- | ----- | ------------ | ------------ |
| `apps/suggestion-service/src/suggestion/entities/book.entity.ts` | `id`  | `number`     | `string`     |
| `apps/suggestion-service/src/shared/entities/genre.entity.ts`    | `id`  | `number`     | `string`     |
| `apps/suggestion-service/src/shared/entities/event.entity.ts`    | `id`  | `number`     | `string`     |

### Fix pattern (same for all 3 files)

```typescript
// Before
@PrimaryGeneratedColumn('uuid')
id: number;

// After
@PrimaryGeneratedColumn('uuid')
id: string;
```

### Fix 2 — `MoodEntity` wrong inverse relation references

All 4 `@ManyToMany` decorators in `apps/suggestion-service/src/shared/entities/mood.entity.ts` reference the wrong inverse property. They point to `book.genres`, `film.genres`, etc. instead of `book.moods`, `film.moods`, etc. The `@JoinTable` definitions in the owning entities (`BookEntity`, `FilmEntity`, etc.) are correct and define the proper join tables — but TypeORM uses the inverse reference to identify which join table to use for reverse lookups. The wrong reference silently routes `moodEntity.books` through the genre join table instead of the mood join table.

```typescript
// Before (wrong)
@ManyToMany(() => BookEntity, (book) => book.genres)
books: BookEntity[];

@ManyToMany(() => FilmEntity, (film) => film.genres)
films: FilmEntity[];

@ManyToMany(() => SongEntity, (song) => song.genres)
songs: SongEntity[];

@ManyToMany(() => GameEntity, (game) => game.genres)
games: GameEntity[];

// After (correct)
@ManyToMany(() => BookEntity, (book) => book.moods)
books: BookEntity[];

@ManyToMany(() => FilmEntity, (film) => film.moods)
films: FilmEntity[];

@ManyToMany(() => SongEntity, (song) => song.moods)
songs: SongEntity[];

@ManyToMany(() => GameEntity, (game) => game.moods)
games: GameEntity[];
```

### Fix 3 — `UserSuggestionEntity.criteria` stored as JSONB — documented, deferred to Phase 2

`UserChoice` is a fixed-structure object `{ mood: string, category: string, genre: string, event: string }`. These 4 fields reference entities that already exist in the database (`MoodEntity`, `GenreEntity`, `EventEntity`). Storing them as a JSONB blob has two concrete problems:

**No referential integrity** — any string can be stored, including values that don't exist in `MoodEntity` or `GenreEntity`. A typo like `"mood": "haapy"` passes silently.

**No per-field indexing** — querying `WHERE criteria->>'genre' = 'action'` requires a GIN index on the JSONB column or a full table scan. Individual B-tree indexes per field are not possible on JSONB sub-keys.

The correct model would be 4 FK columns:

```typescript
// Better data model (Phase 2 refactor)
@ManyToOne(() => MoodEntity)
mood: MoodEntity;

@ManyToOne(() => GenreEntity)
genre: GenreEntity;

@ManyToOne(() => EventEntity)
event: EventEntity;

@Column()
category: CategoryType;
```

**Why deferred**: Changing from JSONB to FK columns requires a data migration (read existing JSONB, look up IDs, write FK values) and a schema migration. This is a breaking change that touches the suggestion engine logic. Scheduled for Phase 2 when the suggestion feature is refactored.

**No action in Phase 1.1** — document the issue, leave JSONB in place.

---

### Fix 4 — `suggestion-service/UserEntity` missing unique constraint on `username`

`auth-service/UserEntity` has `@Column({ unique: true })` on `username`. `suggestion-service/UserEntity` does not — duplicate usernames are allowed, which is a data integrity gap.

```typescript
// Before
@Column()
username: string;

// After
@Column({ unique: true })
username: string;
```

### Fix 5 — `suggestion-service/UserEntity` stores a `password` column

`suggestion-service/UserEntity` currently has:

```typescript
@Column()
password: string;
```

Suggestion-service has no business storing credentials. Authentication is owned exclusively by auth-service. Storing passwords here means:

- Any compromise of `suggestions_db` exposes password hashes
- Password changes in auth-service are not reflected here (data divergence)
- The field is never read by suggestion-service logic — it is dead weight with security implications

**Fix**: remove the `password` field from the entity. TypeORM will generate a migration to `DROP COLUMN password` from the `users` table in `suggestions_db`.

```typescript
// Before
@Column()
username: string;

@Column()
password: string;   // ← remove this

// After
@Column({ unique: true })  // combined with Fix 4
username: string;
```

No cascade changes needed — nothing in suggestion-service reads or writes the password column.

---

## Step 4: Audit decorator usage across all entities (30 min)

Before generating migrations, verify that every index decorator is the right choice — wrong decorators produce unnecessary indexes (write overhead, wasted storage) or missing constraints (data integrity holes).

### Decorator decision rules (recap)

| Decorator                         | Creates                                      | Use when                                 |
| --------------------------------- | -------------------------------------------- | ---------------------------------------- |
| `@PrimaryGeneratedColumn('uuid')` | Primary key + index                          | Identifying column, auto-generated UUID  |
| `@Column({ unique: true })`       | Unique constraint + implicit index           | Single column must be unique             |
| `@Unique([...])` on class         | Composite unique constraint + implicit index | _Combination_ of columns must be unique  |
| `@Index()`                        | Index only, no constraint                    | Fast lookups, duplicates allowed         |
| `@ManyToOne` / `@OneToMany`       | FK index created automatically by TypeORM    | Relational join — no manual index needed |

### Audit results — current codebase

| Entity                            | Field                        | Decorator                            | Verdict                                         |
| --------------------------------- | ---------------------------- | ------------------------------------ | ----------------------------------------------- |
| All entities                      | `id`                         | `@PrimaryGeneratedColumn('uuid')`    | ✅ Correct                                      |
| `auth/UserEntity`                 | `username`                   | `@Column({ unique: true })`          | ✅ Correct — single column uniqueness           |
| `suggestion/MoodEntity`           | `name`                       | `@Column({ unique: true })`          | ✅ Correct                                      |
| `suggestion/GenreEntity`          | `name`                       | `@Column({ unique: true })`          | ✅ Correct                                      |
| `suggestion/EventEntity`          | `name`                       | `@Column({ unique: true })`          | ✅ Correct                                      |
| `suggestion/UserEntity`           | `username`                   | `@Column()`                          | ❌ **Missing `unique: true` — fixed in Step 3** |
| `suggestion/MoodEntity`           | inverse relations            | `@ManyToMany((book) => book.genres)` | ❌ **Wrong inverse ref — fixed in Step 3**      |
| `suggestion/UserSuggestionEntity` | `user`                       | `@ManyToOne`                         | ✅ TypeORM auto-creates FK index                |
| `favorite/FavoriteEntity`         | `(userId, itemId, category)` | `@Unique([...])` on class            | ✅ Correct — composite uniqueness               |
| `favorite/FavoriteEntity`         | `userId`                     | `@Index()`                           | ❌ **Redundant — remove**                       |

### Redundant index explained — `FavoriteEntity.userId`

```typescript
@Entity('favorites')
@Unique(['userId', 'itemId', 'category'])   // creates composite index (userId, itemId, category)
export class FavoriteEntity {

  @Column({ nullable: false })
  @Index()                                   // ← creates a second index on (userId) alone
  userId: string;
```

PostgreSQL's **leftmost prefix rule**: a composite index `(userId, itemId, category)` can already answer queries that filter on `userId` alone, because `userId` is the leftmost column. The separate `@Index()` creates a duplicate index that is never chosen by the query planner — it only adds overhead on every `INSERT`, `UPDATE`, and `DELETE`.

```
Query: WHERE userId = 'abc'
  ✅ Answered by composite index (userId, itemId, category) — leftmost prefix match
  ✗  Separate @Index() on userId is never used
```

`@Index()` on `userId` alone would only be justified if `userId` were **not** the leftmost column — e.g. `@Unique(['itemId', 'userId', 'category'])`.

### Fix

Remove `@Index()` from `FavoriteEntity.userId`:

```typescript
// Before
@Column({ nullable: false })
@Index()           // ← remove this
userId: string;

// After
@Column({ nullable: false })
userId: string;
```

The `@Unique(['userId', 'itemId', 'category'])` class decorator already covers all `userId`-based lookups.

---

## Step 5: Add performance indexes to suggestion-service (30 min)

Do this **before** generating the initial migration so that indexes are included in the baseline `CREATE INDEX` statements, not as a separate follow-up migration.

### Why these fields

The suggestion-service is the only service with content data that users actively search and filter. The existing unique constraints on `MoodEntity.name`, `GenreEntity.name`, `EventEntity.name` already create implicit indexes. Missing indexes are on the content fields that filters and searches hit.

### Changes — add `@Index()` decorator

**`apps/suggestion-service/src/suggestion/entities/book.entity.ts`**

```typescript
@Index() title: string;
@Index() author: string;
```

**`apps/suggestion-service/src/suggestion/entities/film.entity.ts`**

```typescript
@Index() title: string;
@Index() director?: string;
@Index() year?: number;
```

**`apps/suggestion-service/src/suggestion/entities/game.entity.ts`**

```typescript
@Index() title: string;
@Index() year?: number;
```

**`apps/suggestion-service/src/suggestion/entities/song.entity.ts`**

```typescript
@Index() title: string;
@Index() singer: string;
```

**`apps/suggestion-service/src/suggestion/entities/user-suggestion-categories.entity.ts`**

```typescript
@Index() mediaId: string;     // look up which users got a specific item suggested
@Index() mediaType: CategoryType;  // filter suggestions by content type (books, films, etc.)
```

### Full index map after this step

| Entity                         | Field                        | Index type                  | Purpose                                                 |
| ------------------------------ | ---------------------------- | --------------------------- | ------------------------------------------------------- |
| `BookEntity`                   | `title`                      | B-tree                      | Search/filter by title                                  |
| `BookEntity`                   | `author`                     | B-tree                      | Filter by author                                        |
| `FilmEntity`                   | `title`                      | B-tree                      | Search/filter by title                                  |
| `FilmEntity`                   | `director`                   | B-tree                      | Filter by director                                      |
| `FilmEntity`                   | `year`                       | B-tree                      | Filter by release year                                  |
| `GameEntity`                   | `title`                      | B-tree                      | Search/filter by title                                  |
| `GameEntity`                   | `year`                       | B-tree                      | Filter by release year                                  |
| `SongEntity`                   | `title`                      | B-tree                      | Search/filter by title                                  |
| `SongEntity`                   | `singer`                     | B-tree                      | Filter by singer                                        |
| `UserSuggestionCategoryEntity` | `mediaId`                    | B-tree                      | Reverse lookup: which users got this item suggested     |
| `UserSuggestionCategoryEntity` | `mediaType`                  | B-tree                      | Filter suggestions by content type (books, films, etc.) |
| `MoodEntity`                   | `name`                       | Unique (existing)           | Lookup by name                                          |
| `GenreEntity`                  | `name`                       | Unique (existing)           | Lookup by name                                          |
| `EventEntity`                  | `name`                       | Unique (existing)           | Lookup by name                                          |
| `FavoriteEntity`               | `userId`                     | B-tree (existing)           | Fast user favorites lookup                              |
| `FavoriteEntity`               | `(userId, itemId, category)` | Unique composite (existing) | Duplicate prevention + lookup                           |
| `UserEntity` (auth)            | `username`                   | Unique (existing)           | Login lookup                                            |

> **Note on title search**: `@Index()` creates a B-tree index, which speeds up exact matches and prefix queries (`LIKE 'term%'`). For mid-string search (`ILIKE '%term%'`), a PostgreSQL GIN index with `pg_trgm` extension is more effective — this can be added as a separate migration once full-text search is implemented in Phase 2.

---

## Step 6: Generate initial migrations (45 min)

With `synchronize: true` in development, the database schema already matches the entities. The initial migration must capture the current state so TypeORM tracks it going forward.

**Prerequisites**: The relevant PostgreSQL container must be running.

```bash
# Start only the databases
docker compose -f infrastructure/docker-compose.yml up postgres-auth postgres-suggestions postgres-favorites -d

# Generate initial migration for each service
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=auth_db \
  npm exec nx -- run auth-service:migration:generate --args="--name=InitialSchema"

DB_HOST=localhost DB_PORT=5433 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=suggestions_db \
  npm exec nx -- run suggestion-service:migration:generate --args="--name=InitialSchema"

DB_HOST=localhost DB_PORT=5434 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=favorites_db \
  npm exec nx -- run favorite-service:migration:generate --args="--name=InitialSchema"
```

Each command creates a timestamped file:

```
apps/auth-service/src/migrations/1234567890123-InitialSchema.ts
apps/suggestion-service/src/migrations/1234567890124-InitialSchema.ts
apps/favorite-service/src/migrations/1234567890125-InitialSchema.ts
```

**Review the generated files** before committing — verify the `up()` method contains `CREATE TABLE` statements that match the entity definitions. The `down()` method should `DROP TABLE` in reverse order.

---

## Step 7: Update TypeORM module config in each service (30 min)

Replace `synchronize: true` with explicit migrations config in all 3 app modules.

### Before (current pattern in all services)

```typescript
TypeOrmModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    // ...
    synchronize: config.get('NODE_ENV') !== 'production',
    logging: config.get('NODE_ENV') !== 'production',
    entities: [...],
  }),
})
```

### After

```typescript
TypeOrmModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    // ...
    synchronize: false,               // never auto-sync
    migrationsRun: true,             // run pending migrations on startup
    logging: config.get('NODE_ENV') !== 'production',
    entities: [...],
    migrations: [__dirname + '/migrations/*.js'],   // compiled output path
  }),
})
```

**Note on `__dirname + '/migrations/*.js'`**: At runtime NestJS executes compiled JS from `dist/`. The migration files are compiled alongside the service. The glob pattern resolves relative to the compiled output directory.

### auth-service — SSL consistency fix

While updating, also add SSL config to suggestion-service and favorite-service (currently missing, unlike auth-service):

```typescript
ssl: config.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
```

### suggestion-service — missing entities in TypeORM config

`apps/suggestion-service/src/app.module.ts` currently registers only 7 of the 10 entities. `UserEntity`, `UserSuggestionEntity`, and `UserSuggestionCategoryEntity` are absent from the `entities` array — TypeORM's `synchronize` and `migrationsRun` do not create or migrate those tables.

This is a **runtime bug**: the `user_suggestions` and `user_suggestion_categories` tables are currently unmanaged by TypeORM even with `synchronize: true`.

Add the 3 missing imports alongside the existing entities while updating the module config:

```typescript
entities: [
  BookEntity, FilmEntity, GameEntity, SongEntity,
  MoodEntity, GenreEntity, EventEntity,
  UserEntity, UserSuggestionEntity, UserSuggestionCategoryEntity,  // ← add these 3
],
```

### MongoDB service — disable `autoIndex` in production

Only `history-service` uses `MongooseModule` (`suggestion-service` is PostgreSQL only). With the default `autoIndex: true`, Mongoose rebuilds all indexes on every startup — fine for development, expensive in production where it blocks the connection until complete on large collections.

Update the `MongooseModule.forRootAsync` config:

```typescript
// apps/history-service/src/app.module.ts
MongooseModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    uri: config.get('MONGODB_URI'),
    autoIndex: config.get('NODE_ENV') !== 'production', // ← add this line
  }),
});
```

In dev (`NODE_ENV=development`) Mongoose still auto-creates indexes on startup. In production indexes are created once by the migrate-mongo migration run — Mongoose skips the rebuild.

---

## Step 8: Verify locally (1 hour)

### 6a. Drop and recreate databases (clean state test)

```bash
# Bring everything down and wipe volumes
docker compose -f infrastructure/docker-compose.yml down -v

# Start fresh
docker compose -f infrastructure/docker-compose.yml up -d
```

On startup each service should log:

```
[TypeORM] Running migrations...
[TypeORM] Migration InitialSchema has been executed successfully.
```

### 6b. Verify via migration:show

```bash
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=auth_db \
  npm exec nx -- run auth-service:migration:show
```

Expected output:

```
[X] 1234567890123-InitialSchema
```

`[X]` = applied, `[ ]` = pending.

### 6c. Run all services and smoke-test endpoints

```bash
# Health checks
curl http://localhost:3000/health   # api-gateway
curl http://localhost:3001/health   # auth-service
curl http://localhost:3002/health   # suggestion-service
curl http://localhost:3003/health   # favorite-service
curl http://localhost:3004/health   # history-service
```

---

## Step 9: Document migration workflow (30 min)

Add a `MIGRATIONS.md` at the workspace root explaining day-to-day usage.

### Adding a new field to an entity

```bash
# 1. Edit the entity file
# 2. Generate migration (DB must be running with current schema)
DB_HOST=localhost DB_PORT=5432 ... \
  npm exec nx -- run auth-service:migration:generate --args="--name=AddEmailToUser"

# 3. Review the generated file in src/migrations/
# 4. Commit both the entity change and the migration file together
# 5. On next deploy, migrationsRun: true applies it automatically
```

### Rolling back

```bash
# Revert the last applied migration
DB_HOST=localhost ... npm exec nx -- run auth-service:migration:revert
```

### Rules

1. **Never edit a migration file after it has been run** against any environment (dev, staging, prod). Create a new migration instead.
2. **Always commit the entity change and its migration together** in the same PR.
3. **Never use `synchronize: true` again** — it is destructive in production (drops columns TypeORM doesn't see).
4. The `migrations/` folder is source-controlled. Each file is permanent history.

### Special case: PostgreSQL ENUM changes

TypeORM's `migration:generate` **cannot detect enum value additions** — `ALTER TYPE enum_name ADD VALUE` is never produced automatically. Any time you add a value to a TypeScript enum used as a `@Column({ type: 'enum' })`, you must write the migration by hand.

**Steps when adding an enum value:**

```bash
# 1. Add the new value to the TypeScript enum
# 2. Create an empty migration (don't use migration:generate — it produces nothing)
npm exec nx -- run auth-service:migration:generate --args="--name=AddAdminRole"
# 3. Open the generated file and replace the empty up()/down() bodies:
```

```typescript
async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE 'admin'`);
}

async down(queryRunner: QueryRunner): Promise<void> {
  // PostgreSQL does not support DROP VALUE.
  // Reverting requires recreating the type without the new value:
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

**Enums in this project that will be affected as features are added:**

- `CategoryType` in `suggestion-service` — if new media categories are introduced
- Role enum — when RBAC is added in Phase 3 (`user` → `user | admin`)

---

## Step 10: MongoDB migrations — history-service with migrate-mongo (1 hour)

TypeORM does not apply to MongoDB. Instead, use **`migrate-mongo`** — the standard Node.js migration tool for MongoDB. The workflow is identical to TypeORM: write `up()` / `down()`, commit alongside schema changes, run CLI to apply.

### Install

```bash
npm install --save-dev migrate-mongo
```

### Create config file

**`apps/history-service/migrate-mongo-config.js`**

```javascript
module.exports = {
  mongodb: {
    url:
      process.env.MONGODB_URI ??
      'mongodb://root:rootpass@localhost:27017/history_db?authSource=admin',
    databaseName: process.env.DB_NAME ?? 'history_db',
    options: {},
  },
  migrationsDir: 'src/migrations',
  changelogCollectionName: 'migrations', // stored in MongoDB, same idea as TypeORM migrations table
  migrationFileExtension: '.js',
};
```

### Add Nx targets to `apps/history-service/project.json`

```json
"migration:create": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx migrate-mongo create {args.name}",
    "cwd": "apps/history-service"
  }
},
"migration:up": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx migrate-mongo up",
    "cwd": "apps/history-service"
  }
},
"migration:down": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx migrate-mongo down",
    "cwd": "apps/history-service"
  }
},
"migration:status": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx migrate-mongo status",
    "cwd": "apps/history-service"
  }
}
```

### What Mongoose already handles — do NOT duplicate in migrate-mongo

Reading `suggestion-history.schema.ts` reveals that indexes are already defined in the Mongoose schema and created automatically on connection (`autoIndex: true` default):

```typescript
@Prop({ required: true, index: true })
userId: string;                                           // single-field index ← Mongoose manages

@Prop({ default: Date.now, index: true })
timestamp: Date;                                          // single-field index ← Mongoose manages

SuggestionHistorySchema.index({ userId: 1, timestamp: -1 });   // compound ← Mongoose manages
SuggestionHistorySchema.index({ 'criteria.category': 1 });     // nested field ← Mongoose manages
```

migrate-mongo must NOT recreate these — duplicating them wastes storage and creates conflicting index names.

### What migrate-mongo is for in this service

migrate-mongo's role here is **future structural changes** that Mongoose schema alone can't handle:

- Renaming a field across all existing documents (`$rename`)
- Changing a field type (e.g., `criteria.category` from string to array)
- Dropping an obsolete field from all documents
- Adding MongoDB collection-level validation rules (`$jsonSchema`)

### Create initial migration — baseline marker + collection validation

The first migration establishes migrate-mongo tracking and adds MongoDB-level schema validation (a layer of data integrity the Mongoose schema alone cannot enforce at the database engine level):

```bash
npm exec nx -- run history-service:migration:create --args="--name=InitialValidation"
```

Edit the generated file:

```javascript
module.exports = {
  async up(db) {
    // collMod requires the collection to exist — create it if this is a fresh DB
    const collections = await db
      .listCollections({ name: 'suggestionhistories' })
      .toArray();
    if (collections.length === 0) {
      await db.createCollection('suggestionhistories');
    }

    // Add collection-level JSON Schema validation
    // This enforces required fields at the MongoDB engine level,
    // independent of whether the app uses Mongoose or connects directly.
    await db.command({
      collMod: 'suggestionhistories',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['userId', 'criteria', 'suggestions', 'timestamp'],
          properties: {
            userId: { bsonType: 'string', description: 'required string' },
            criteria: { bsonType: 'object', description: 'required object' },
            suggestions: { bsonType: 'array', description: 'required array' },
            timestamp: { bsonType: 'date', description: 'required date' },
          },
        },
      },
      validationLevel: 'moderate', // validates only on insert/update, not existing docs
      validationAction: 'error',
    });
  },

  async down(db) {
    // Remove validation rules
    await db.command({
      collMod: 'suggestionhistories',
      validator: {},
      validationLevel: 'off',
    });
  },
};
```

### Run migrations

```bash
MONGODB_URI=mongodb://root:rootpass@localhost:27017/history_db?authSource=admin \
  npm exec nx -- run history-service:migration:up
```

### Run on NestJS startup via lifecycle hook

Unlike TypeORM (`migrationsRun: true`), migrate-mongo has no built-in NestJS integration. Wire it via `OnModuleInit`:

**`apps/history-service/src/database/database-migration.service.ts`**

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as migrateMongoDb from 'migrate-mongo';

@Injectable()
export class DatabaseMigrationService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit() {
    const { up } = migrateMongoDb;
    const migrated = await up(this.connection.db, this.connection.getClient());
    migrated.forEach((name) => this.logger.log(`Migration applied: ${name}`));
  }
}
```

Register in `AppModule` as a provider.

### TypeORM vs migrate-mongo comparison

|                   | TypeORM (PostgreSQL)  | migrate-mongo (MongoDB)            |
| ----------------- | --------------------- | ---------------------------------- |
| Config file       | `data-source.ts`      | `migrate-mongo-config.js`          |
| Generate          | Auto-diffs entities   | Manual — you write `up()`/`down()` |
| Run               | `migration:run`       | `migration:up`                     |
| Revert            | `migration:revert`    | `migration:down`                   |
| Track applied     | `migrations` table    | `migrations` collection            |
| Auto-run on start | `migrationsRun: true` | `OnModuleInit` service             |

---

## Step 11: Fix Redis configuration across services (20 min)

### Problem 1 — Redis DB slot collision

Three services share Redis database `/0`. Any cache key used by two of those services under the same name silently overwrites the other's cached value.

| Service            | Current Redis DB | Target Redis DB  |
| ------------------ | ---------------- | ---------------- |
| auth-service       | `/1`             | `/1` (no change) |
| suggestion-service | `/0` ❌          | `/2`             |
| favorite-service   | `/0` ❌          | `/3`             |
| history-service    | `/0` ❌          | `/4`             |

Update the Redis URL in each affected service's `app.module.ts`:

```typescript
// suggestion-service — change /0 → /2
const url = `redis://:${redisPassword}@${redisHost}:${redisPort}/2`;

// favorite-service — change /0 → /3
const url = `redis://:${redisPassword}@${redisHost}:${redisPort}/3`;

// history-service — change /0 → /4
const url = `redis://:${redisPassword}@${redisHost}:${redisPort}/4`;
```

### Problem 2 — missing `connectionTimeout` in favorite-service and history-service

`auth-service` and `suggestion-service` pass `{ connectionTimeout: 10_000 }` to `KeyvRedis`. Without this option, a Redis outage causes the other two services to hang indefinitely on any cache read or write.

```typescript
// Before (favorite-service, history-service)
new KeyvRedis(url);

// After
new KeyvRedis(url, { connectionTimeout: 10_000 });
```

### Problem 3 — Redis `maxmemory-policy` not configured

Redis default eviction policy is `noeviction` — when memory fills up Redis returns an error on writes instead of evicting old data. For a cache workload the correct policy is `allkeys-lru` (evict the least recently used keys to make room for new ones).

Update the Redis command in `infrastructure/docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  command: >
    redis-server
    --requirepass ${REDIS_PASSWORD:-redispass}
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
```

In production (Terraform / ElastiCache), set `maxmemory-policy = allkeys-lru` in the parameter group.

---

## Bonus: tsconfig paths for data-source.ts

If the DataSource files import from `@suggestify/backend/*` path aliases, `ts-node` needs to resolve them. Add a `tsconfig.migration.json` per service if needed:

```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

Then pass it to the CLI:

```bash
npx typeorm-ts-node-commonjs --tsconfig tsconfig.migration.json migration:run -d src/data-source.ts
```

The DataSource files in this plan only import local entities (no `@suggestify/*` aliases), so this step is optional.

---

## File Changes Summary

| File                                                                                   | Change                                                                                                    |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/auth-service/src/data-source.ts`                                                 | New — TypeORM CLI DataSource                                                                              |
| `apps/suggestion-service/src/data-source.ts`                                           | New — TypeORM CLI DataSource                                                                              |
| `apps/favorite-service/src/data-source.ts`                                             | New — TypeORM CLI DataSource                                                                              |
| `apps/auth-service/src/migrations/*.ts`                                                | New — generated initial migration                                                                         |
| `apps/suggestion-service/src/migrations/*.ts`                                          | New — generated initial migration                                                                         |
| `apps/favorite-service/src/migrations/*.ts`                                            | New — generated initial migration                                                                         |
| `apps/auth-service/project.json`                                                       | Add migration:generate/run/revert/show targets                                                            |
| `apps/suggestion-service/project.json`                                                 | Add migration:generate/run/revert/show targets                                                            |
| `apps/favorite-service/project.json`                                                   | Add migration:generate/run/revert/show targets                                                            |
| `apps/auth-service/src/app.module.ts`                                                  | `synchronize: false`, `migrationsRun: true`, `migrations: [...]`                                          |
| `apps/suggestion-service/src/app.module.ts`                                            | Same + add SSL config + add 3 missing entities + fix Redis DB slot (`/0` → `/2`)                          |
| `apps/favorite-service/src/app.module.ts`                                              | Same + add SSL config + fix Redis DB slot (`/0` → `/3`) + add `connectionTimeout: 10_000` to `KeyvRedis`  |
| `apps/history-service/src/app.module.ts`                                               | Set `autoIndex` by env + fix Redis DB slot (`/0` → `/4`) + add `connectionTimeout: 10_000` to `KeyvRedis` |
| `apps/favorite-service/src/favorite/entities/favorite.entity.ts`                       | Remove redundant `@Index()` on `userId` (covered by composite unique index)                               |
| `apps/suggestion-service/src/shared/entities/mood.entity.ts`                           | Fix wrong inverse refs: `.genres` → `.moods` on all 4 `@ManyToMany`                                       |
| `apps/suggestion-service/src/suggestion/entities/user.entity.ts`                       | Add `unique: true` to `username` column; remove `password` column                                         |
| `apps/suggestion-service/src/suggestion/entities/book.entity.ts`                       | Fix `id: number` → `id: string`; add `@Index()` on `title`, `author`                                      |
| `apps/suggestion-service/src/suggestion/entities/film.entity.ts`                       | Add `@Index()` on `title`, `director`, `year`                                                             |
| `apps/suggestion-service/src/suggestion/entities/game.entity.ts`                       | Add `@Index()` on `title`, `year`                                                                         |
| `apps/suggestion-service/src/suggestion/entities/song.entity.ts`                       | Add `@Index()` on `title`, `singer`                                                                       |
| `apps/suggestion-service/src/shared/entities/genre.entity.ts`                          | Fix `id: number` → `id: string`                                                                           |
| `apps/suggestion-service/src/shared/entities/event.entity.ts`                          | Fix `id: number` → `id: string`                                                                           |
| `apps/suggestion-service/src/suggestion/entities/user-suggestion-categories.entity.ts` | Add `@Index()` on `mediaId` and `mediaType`                                                               |
| `apps/history-service/migrate-mongo-config.js`                                         | New — migrate-mongo config                                                                                |
| `apps/history-service/src/migrations/*.js`                                             | New — initial indexes migration                                                                           |
| `apps/history-service/project.json`                                                    | Add migration:create/up/down/status targets                                                               |
| `apps/history-service/src/database/database-migration.service.ts`                      | New — OnModuleInit migration runner                                                                       |
| `infrastructure/docker-compose.yml`                                                    | Redis: add `--maxmemory 256mb --maxmemory-policy allkeys-lru` to command                                  |
| `MIGRATIONS.md`                                                                        | New — migration workflow documentation                                                                    |

---

## Timeline Summary

| Step      | Description                                                                       | Min estimate | Realistic (with checks & fixes)                                                                       |
| --------- | --------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| 1         | Create DataSource config files                                                    | 1 hour       | 1.5 hours — verify env var names match docker-compose; fix wrong import paths                         |
| 2         | Add Nx migration targets                                                          | 30 min       | 1 hour — run `migration:show` to confirm CLI resolves; fix ts-node/typeorm install issues             |
| 3         | Fix entity bugs (id types, MoodEntity inverses, username unique, password column) | 30 min       | 1.5 hours — run build after fixes; check if removing `password` breaks any imports                    |
| 4         | Audit decorator usage                                                             | 30 min       | 30 min — read-only review, no fixes expected beyond what Step 3 already covers                        |
| 5         | Add performance indexes to suggestion-service                                     | 30 min       | 45 min — verify no duplicate indexes against existing constraints                                     |
| 6         | Generate initial migrations                                                       | 45 min       | 2–3 hours — review all 3 migrations line by line; fix SQL if schema drift found from synchronize:true |
| 7         | Update TypeORM module config + missing entities + autoIndex                       | 30 min       | 1 hour — run affected build after changes; fix missing imports for newly registered entities          |
| 8         | Verify locally (drop/recreate, migration:show, health checks)                     | 1 hour       | 2–3 hours — iteration cycles: fix migration SQL → drop volumes → restart → repeat until clean         |
| 9         | Document migration workflow + ENUM special case                                   | 30 min       | 30 min — writing only, no code changes                                                                |
| 10        | MongoDB migrations with migrate-mongo                                             | 1 hour       | 2 hours — test migration:up, migration:status, migration:down; fix DatabaseMigrationService wiring    |
| 11        | Fix Redis DB slots + connectionTimeout + maxmemory-policy                         | 20 min       | 45 min — restart all 4 services; verify cache operations succeed on new slots                         |
| **Total** |                                                                                   | **~7 hours** | **~15 hours (2–3 days)**                                                                              |

Steps 6 and 8 carry the highest variance — schema drift from `synchronize: true` may require manual SQL corrections and multiple Docker volume wipe cycles before migrations run cleanly end-to-end.

---

## Out of Scope

- Cross-service transactions — each service owns its own database
- Seed data scripts — separate concern, Phase 1 dev tools (Step 6 in enhancement plan)
- Migration CI gate (run migrations in CI before deploy) — Phase 6 deployment automation
- Full-text search indexes (GIN + pg_trgm for `ILIKE '%term%'`) — Phase 2 when search feature is implemented
- `UserSuggestionEntity.criteria` JSONB → FK columns refactor — Phase 2, requires data migration + suggestion engine changes

---

## Risk Factors

| Risk                                                                                            | Likelihood | Mitigation                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| Generated migration does not match existing schema (drift from `synchronize: true`)             | Medium     | Review `up()` SQL carefully; test with `down -v` + fresh start                                               |
| `suggestion-service` initial migration is large (10 entities + 12 join tables)                  | Low        | Review, don't edit — just confirm it's correct                                                               |
| `migrationsRun: true` delays container startup on cold start                                    | Low        | Initial migration is fast; acceptable tradeoff vs manual run                                                 |
| Entity type bugs (`id: number`) affect generated migration SQL                                  | High       | Fix type bugs in Step 3 **before** generating migrations                                                     |
| migrate-mongo duplicates Mongoose-managed indexes                                               | High       | Initial migration uses collection validation only — indexes left to Mongoose                                 |
| `criteria` JSONB stores invalid mood/genre values                                               | Medium     | Accepted for Phase 1.1; FK refactor deferred to Phase 2                                                      |
| `suggestion-service` missing 3 entities in TypeORM config (`user_suggestions` tables unmanaged) | High       | Fixed in Step 7 — add `UserEntity`, `UserSuggestionEntity`, `UserSuggestionCategoryEntity` to entities array |
| Redis key collision — 3 services sharing DB `/0`                                                | Medium     | Fixed in Step 11 — assign each service its own DB slot                                                       |
| Mongoose `autoIndex` rebuilds indexes on every production startup                               | Low        | Fixed in Step 7 — set `autoIndex: NODE_ENV !== 'production'` in both MongoDB services                        |

---

**Phase 1.1 Status**: Ready to implement
**Next Phase**: Phase 1.2 — Structured Logging with Correlation IDs

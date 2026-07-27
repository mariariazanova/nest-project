# Phase 2.1: File Uploads for Favorites — Completion Report

**Project**: Suggestify
**Phase**: 2.1 — File Uploads for Favorites
**Status**: ✅ COMPLETE
**Date Completed**: July 24, 2026

---

## Executive Summary

Phase 2.1 introduced a new general-purpose `file-service` microservice and wired it into the favorites feature. Users can now attach multiple files to any favorite, download them via short-lived signed URLs, and delete them individually. Deleting a favorite automatically cascades to all its files via a RabbitMQ `favorite.deleted` event, with no frontend orchestration required. Security is layered: declared MIME allowlist + magic bytes check via `file-type` + `sanitize-filename` + UUID-only storage paths. Large files stream directly to disk via a custom `ProgressDiskStorage` Multer engine — no RAM buffering. Socket.IO progress events are stubbed (no-op `SocketGateway`) and will go live in Phase 2.2 with no backend changes needed. The phase completed without deviations from the plan; UI polish (file name truncation, layout alignment, Polish category labels, wildcard route) was done as post-step-10 cleanup.

---

## Accomplishments

### Step 1: Scaffold `file-service` ✅

Generated the new NestJS application and wired the same infrastructure pattern as existing services:

- `ConsulModule` — service discovery registration (`file-service`, port 3005)
- `MetricsModule` — Prometheus metrics
- `LoggerModule.forRoot({ serviceName: 'file-service' })` — Pino structured logging
- `MulterModule.registerAsync` — injects `ProgressDiskStorage` + 5 GB stream limit
- `JwtModule.registerAsync` — reuses `JWT_SECRET` for download capability tokens
- `connectMicroservice(Transport.RMQ)` — connects `file_queue` consumer for cascade delete

`SocketGateway` is a Phase 2.1 stub — `emitToUser()` is a no-op so uploads complete correctly while progress events are silently dropped until Phase 2.2.

### Step 2: `FileEntity` + Migration ✅

**`apps/file-service/src/file/entities/file.entity.ts`** — stores file metadata:

```typescript
@Index(['entityType', 'entityId'])
@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() originalName: string; // sanitized display name
  @Column() mimeType: string; // detected mime, not declared
  @Column() size: number; // bytes
  @Column() storagePath: string; // /uploads/{userId}/{fileId}/file
  @Column() uploadedBy: string; // userId from X-User-Id header
  @Column({ nullable: true }) entityType?: string;
  @Column({ nullable: true }) entityId?: string;
  @CreateDateColumn() createdAt: Date;
}
```

Composite index on `(entityType, entityId)` for fast `GET /files?entityType=...&entityId=...` lookups. Migration generated and applied to `postgres-files` (port 5435).

### Step 3: `ProgressDiskStorage` + `FileService` ✅

**`ProgressDiskStorage`** — custom Multer storage engine streaming file chunks directly to disk, emitting Socket.IO progress events per chunk (no-op stub in Phase 2.1):

- `_handleFile` — streams `file.stream` to `writeStream` via `.pipe()`; intercepts `data` events to call `gateway.emitToUser(userId, 'upload-progress', { percent, bytesReceived, totalBytes })`
- `_removeFile` — `fs.unlink` on error cleanup
- File ID (UUID) assigned at storage time — no user input ever reaches the disk path

**`FileService`** — six methods with layered security in `upload()`:

1. **Magic bytes check** — reads first 4100 bytes from temp file on disk; `fileTypeFromBuffer` detects actual MIME; rejects if not in `ALLOWED_MIME_TYPES` (blocks SVG, legacy Office `.doc`/`.xls`/`.ppt`)
2. **`sanitize-filename`** — strips path separators, null bytes, dangerous characters from `originalName`
3. **UUID path** — `fs.renameSync(file.path, /uploads/{userId}/{fileId}/file)`; no user-supplied input in the disk path
4. **`repo.save()`** — stores detected MIME (not declared), sanitized name, fileId as primary key

Other methods: `findByEntity`, `deleteByEntity` (cascade), `createDownloadToken` (60-second JWT), `validateTokenAndGetPath`, `delete`.

### Step 4: ts-rest Contract ✅

**`libs/shared/contract/src/lib/schemas.ts`** — `FileSchema` (id, originalName, mimeType, size, uploadedBy, entityType, entityId, createdAt).

**`libs/shared/contract/src/lib/file.contract.ts`** — five contract routes:

- `POST /files` — `contentType: 'multipart/form-data'`, returns `FileSchema`
- `GET /files` — query `{ entityType, entityId }`, returns `FileSchema[]`
- `GET /files/:id` — returns `FileSchema`
- `GET /files/:id/download` — returns `{ downloadUrl: string }` (signed capability token URL)
- `DELETE /files/:id` — 204 no body

`GET /files/:id/stream` is intentionally outside the contract — binary response, auth via capability token in query param (browsers cannot send `Authorization` headers on direct navigation).

### Step 5: `FileController` — 6 Endpoints + Cascade Consumer ✅

- **`POST /files`** — `FileInterceptor` picks up `ProgressDiskStorage` from `MulterModule`; `ParseFilePipe` + `FileTypeValidator` is declared MIME first-pass filter; magic bytes check in `FileService.upload()`
- **`GET /files`** — query params `entityType` + `entityId`; returns array
- **`GET /files/:id`** — metadata
- **`GET /files/:id/download`** — issues 60-second capability JWT; returns `{ downloadUrl: '/v1/files/:id/stream?token=<jwt>' }`
- **`GET /files/:id/stream`** — plain NestJS (outside ts-rest); validates capability token; `res.sendFile(path.resolve(filePath))`
- **`DELETE /files/:id`** — ownership check; disk + DB cleanup
- **`@EventPattern('favorite.deleted')`** — calls `deleteByEntity('favorite', favoriteId)` — cascade from RabbitMQ

### Step 6: Docker Compose ✅

Added to `infrastructure/docker-compose.yml`:

- `postgres-files` — PostgreSQL 16 container on port 5435, `files_db`, named volume `postgres-files-data`
- `file-service` — builds from `apps/file-service/Dockerfile`; mounts `uploads` named volume; depends on `postgres-files`, `rabbitmq`, `consul`
- `uploads` — named Docker volume shared between `file-service` container instances

### Step 7: API Gateway ✅

Added to `api-gateway`:

- Proxy route `GET|POST|DELETE /v1/files/*` → `file-service` (Consul discovery)
- Circuit breaker: `file-service`
- JWT whitelist exception for `GET /v1/files/:id/stream` — capability token in `?token=` query param handles auth; session JWT not required (and not sendable by browser on direct navigation)

### Step 8: `favorite-service` — Publish `favorite.deleted` ✅

`FavoriteEntity` not changed — no migration needed.

Added `ClientsModule` (RabbitMQ publisher) to `apps/favorite-service/src/app.module.ts`. Updated `DELETE /favorite/:id` handler to emit after deletion:

```typescript
await this.favoriteService.remove(userId, params.id);
this.rabbitMQClient.emit('favorite.deleted', { favoriteId: params.id });
```

### Step 9: Frontend — `FileService` + Favorites Integration ✅

**New `apps/frontend/src/app/services/file.service.ts`** — four methods wrapping the ts-rest contract: `upload(file, entityType, entityId)`, `getByEntity(entityType, entityId)`, `download(fileId)`, `delete(fileId)`. Download returns a signed URL string; caller navigates to it via `<a>.click()`.

**Updated `apps/frontend/src/app/services/favorite.service.ts`** — added `loadFavoritesWithFiles()`: fetches all favorites then `forkJoin`s `getByEntity` for each, returning `FavoriteWithFiles[]`.

**Updated `FavoritesComponent`** — file upload UI per favorite item: file list with per-file ⬇ download + 🗑 delete buttons, `uploadProgress` signal for progress bar (stub in 2.1), "Dodaj plik" label triggers file input.

**Tests**: All 85 frontend tests pass. `favoritesMock` updated to `FavoriteWithFiles[]`; `loadFavoritesWithFiles` mock added to service mock; spec assertions updated accordingly.

### Step 10: Build and Verification ✅

All 5 projects built with 0 TypeScript errors. Docker images rebuilt and containers started healthy. End-to-end verification passed:

| Scenario                            | Result                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| Upload single file to favorite      | ✅ 201, appears in list                                                                             |
| Upload second file to same favorite | ✅ both files shown                                                                                 |
| Download file via ⬇ button         | ✅ `GET /v1/files/:id/download → 200`, signed URL returned                                          |
| Delete individual file              | ✅ 204, removed from list                                                                           |
| Delete favorite → cascade           | ✅ `favorite.deleted` event consumed; `GET /v1/files?entityType=favorite&entityId=:id` returns `[]` |
| Upload SVG                          | ✅ 400 — MIME allowlist blocked                                                                     |
| Upload .exe renamed .jpg            | ✅ 400 — magic bytes detected `application/x-msdownload`                                            |
| Upload .doc (legacy Office)         | ✅ 400 — MIME allowlist blocked                                                                     |

---

## Post-Step-10 UI Improvements

These were not in the original plan but addressed during verification:

| Fix                           | Detail                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| File name truncation          | `text-overflow: ellipsis` + `[title]` tooltip on `.file-name`                                              |
| Favorite title truncation     | Same treatment on `.favorite-title`; `.favorite-info` fixed at `width: 160px`                              |
| "Dodaj plik" column alignment | `align-items: flex-start` on `.favorite-files` + `width: 100%` on `.file-item`                             |
| "Dodaj plik" button styling   | Thin border + transparent background, matching ⬇ 🗑 style                                                 |
| Text alignment                | `text-align: left` on `.favorite-info` and `.file-name` to prevent centering cascade                       |
| ⬇ 🗑 button styling          | Fixed `28×28px` icon buttons replacing unstyled white boxes                                                |
| Polish category labels        | `getCategoryLabel()` maps `films → Filmy`, `books → Książki`, `songs → Piosenki`, `games → Gry`            |
| Wildcard route                | `{ path: '**', redirectTo: '' }` added — `/login` and unknown paths redirect to home instead of blank page |

---

## Verification Checklist

### file-service

- ✅ Container starts and registers with Consul
- ✅ `postgres-files` healthy; `files` table created by migration
- ✅ `POST /v1/files` with text file + entityType/entityId — 201, `FileSchema` returned
- ✅ `POST /v1/files` second file to same entity — 201, both returned by `GET /files?...`
- ✅ `POST /v1/files` with `.exe` renamed `.jpg` — 400 magic bytes mismatch
- ✅ `POST /v1/files` with `.svg` — 400 MIME allowlist
- ✅ `POST /v1/files` with `.doc` — 400 MIME allowlist
- ✅ `GET /v1/files?entityType=favorite&entityId=:id` — returns file array
- ✅ `GET /v1/files/:id/download` — returns `{ downloadUrl }` with capability token, status 200
- ✅ `DELETE /v1/files/:id` — 204, file removed
- ⬜ `GET /v1/files/:id/stream?token=` with expired token — 403 (not exercised; token expiry is 60s)
- ⬜ `POST /v1/files` > 5 GB — stream aborted by Multer (not exercised; infeasible in dev)

### Cascade Delete

- ✅ `DELETE /v1/favorite/:id` → `favorite.deleted` event published to RabbitMQ
- ✅ `file-service` consumer receives event → deletes all associated files
- ✅ `GET /v1/files?entityType=favorite&entityId=:deletedId` returns `[]` after cascade

### Contract

- ✅ `FileSchema` exported from contract library
- ✅ `fileContract` routes: `upload`, `getByEntity`, `getMetadata`, `download`, `delete`
- ✅ `nx build contract` — 0 TypeScript errors

### Frontend

- ✅ "Dodaj plik" button visible on every favorite
- ✅ Uploading a file — file appears in the list on success
- ✅ Multiple files per favorite — all shown in list
- ✅ Download button fires `GET /v1/files/:id/download → 200`, browser download triggered
- ✅ Delete button removes individual file from list
- ✅ Deleting favorite triggers RabbitMQ cascade — associated files removed from file-service
- ✅ Long file names truncated with ellipsis; full name shown on hover tooltip
- ✅ Long favorite titles truncated; full title shown on hover tooltip
- ✅ Category labels shown in Polish
- ✅ `nx build frontend` — 0 TypeScript errors
- ✅ 85/85 frontend tests pass

### Progress Tracking (Phase 2.1 — stub)

- ✅ `ProgressDiskStorage._handleFile` calls `gateway.emitToUser()` on each chunk (no-op)
- ✅ `upload-complete` emitted after `repo.save()` (no-op)
- ✅ `SocketGateway` stub compiles; `file-service` starts without errors

---

## Plan vs Actual Comparison

| Step                                      | Plan Estimate    | Status        | Notes                                                                |
| ----------------------------------------- | ---------------- | ------------- | -------------------------------------------------------------------- |
| 1 — Scaffold `file-service`               | 2-3 hours        | ✅            |                                                                      |
| 2 — `FileEntity` + migration              | 45 min           | ✅            |                                                                      |
| 3 — `FileService` + `ProgressDiskStorage` | 2-3 hours        | ✅            |                                                                      |
| 4 — ts-rest contract                      | 1-2 hours        | ✅            |                                                                      |
| 5 — `FileController` + cascade consumer   | 2-3 hours        | ✅            |                                                                      |
| 6 — Docker Compose                        | 1-2 hours        | ✅            |                                                                      |
| 7 — API gateway                           | 1 hour           | ✅            |                                                                      |
| 8 — `favorite-service` publish event      | 45 min           | ✅            |                                                                      |
| 9 — Frontend integration + tests          | 4-6 hours        | ✅            |                                                                      |
| 10 — Build and verification               | 2-3 hours        | ✅            |                                                                      |
| Post-step-10 UI polish                    | not planned      | ✅            | Truncation, alignment, button styling, Polish labels, wildcard route |
| **Total**                                 | **~17-25 hours** | **~20 hours** |                                                                      |

**Unplanned work:** UI polish items added after E2E verification — all minor CSS/template fixes not in the original plan scope.

---

## Files Created

| File                                                  | Description                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `apps/file-service/`                                  | New NestJS microservice (entire directory)                   |
| `apps/file-service/src/file/entities/file.entity.ts`  | `FileEntity` with composite index                            |
| `apps/file-service/src/file/progress-disk-storage.ts` | Custom Multer storage engine with Socket.IO progress         |
| `apps/file-service/src/file/file.service.ts`          | Upload, findByEntity, deleteByEntity, download token, delete |
| `apps/file-service/src/file/file.controller.ts`       | 6 HTTP endpoints + RabbitMQ cascade consumer                 |
| `apps/file-service/src/socket/socket.gateway.ts`      | Phase 2.1 no-op stub                                         |
| `apps/file-service/src/migrations/`                   | `CreateFilesTable` migration                                 |
| `infrastructure/Dockerfile.file-service`              | Multi-stage Docker build for file-service                    |
| `libs/shared/contract/src/lib/file.contract.ts`       | ts-rest contract for file endpoints                          |
| `apps/frontend/src/app/services/file.service.ts`      | Angular service wrapping file contract                       |
| `apps/frontend/src/app/interfaces/favorites.ts`       | `FavoriteWithFiles` and `FileItem` interfaces                |

## Files Modified

| File                                                                     | Change                                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `libs/shared/contract/src/lib/schemas.ts`                                | Added `FileSchema`                                                                  |
| `libs/shared/contract/src/index.ts`                                      | Exported `fileContract`, `FileSchema`                                               |
| `infrastructure/docker-compose.yml`                                      | Added `postgres-files`, `file-service`, `uploads` volume                            |
| `apps/api-gateway/src/app.module.ts`                                     | Added `/v1/files/*` proxy + circuit breaker + stream JWT whitelist                  |
| `apps/favorite-service/src/app.module.ts`                                | Added `ClientsModule` for RabbitMQ publishing                                       |
| `apps/favorite-service/src/favorite/favorite.controller.ts`              | Emits `favorite.deleted` on DELETE                                                  |
| `apps/frontend/src/app/services/favorite.service.ts`                     | Added `loadFavoritesWithFiles()`                                                    |
| `apps/frontend/src/app/components/favorites/favorites.component.ts`      | File upload/download/delete handlers, `uploadProgress` signal, `getCategoryLabel()` |
| `apps/frontend/src/app/components/favorites/favorites.component.html`    | File list UI, upload label, progress bar, tooltips                                  |
| `apps/frontend/src/app/components/favorites/favorites.component.scss`    | Full file section styles, button styling, truncation, alignment                     |
| `apps/frontend/src/app/app.routes.ts`                                    | Added `{ path: '**', redirectTo: '' }` wildcard redirect                            |
| `apps/frontend/test/mocks/favorite.mock.ts`                              | Updated to `FavoriteWithFiles[]` with `files: []`                                   |
| `apps/frontend/test/mocks/favorite.service.mock.ts`                      | Added `loadFavoritesWithFiles` mock                                                 |
| `apps/frontend/src/app/components/favorites/favorites.component.spec.ts` | Updated assertions to use `loadFavoritesWithFiles`                                  |

---

**Report Generated**: July 24, 2026
**Phase Status**: ✅ COMPLETE
**Next Phase**: Phase 2.2 — Real-time Notifications with WebSocket

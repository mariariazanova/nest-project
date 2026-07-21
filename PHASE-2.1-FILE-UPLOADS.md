# Phase 2.1: File Uploads for Favorites — Implementation Plan

## Overview

Introduces a new general-purpose `file-service` microservice that handles uploading, downloading, and deleting files of any supported type. The service stores the association between a file and any entity via `entityType` + `entityId` columns on `FileEntity` — no other service needs to know about files at all. `FavoriteEntity` is not changed. Cascade delete is handled via RabbitMQ: when a favorite is deleted, `favorite-service` publishes a `favorite.deleted` event; `file-service` subscribes and deletes all files associated with that favorite automatically.

## Scope

✅ **In Scope:**

- `apps/file-service/` — new NestJS microservice (same infrastructure pattern as existing services: Consul, health, metrics, Pino logging)
- `apps/file-service/src/file/entities/file.entity.ts` — `FileEntity` (id, originalName, mimeType, size, storagePath, uploadedBy, entityType, entityId, createdAt)
- `apps/file-service/src/file/file.service.ts` — upload, findByEntity, deleteByEntity, download token, stream path, delete
- `apps/file-service/src/file/file.controller.ts` — 6 endpoints + RabbitMQ consumer for cascade delete
- New `postgres-files` PostgreSQL container (port 5435) in `docker-compose.yml`
- `uploads` Docker named volume mounted into `file-service`
- `apps/api-gateway/src/` — add `/v1/files/*` proxy route + circuit breaker for `file-service`
- `libs/shared/contract/src/lib/file.contract.ts` — new ts-rest contract
- `libs/shared/contract/src/lib/schemas.ts` — add `FileSchema`
- `apps/favorite-service/src/favorite/favorite.controller.ts` — publish `favorite.deleted` RabbitMQ event on `DELETE /favorite/:id`
- `apps/frontend/src/app/services/file.service.ts` — new Angular service (upload with entityType/entityId, getByEntity, download, delete)
- `apps/frontend/src/app/services/favorite.service.ts` — update `removeFavorite` to delete associated file before publishing; update favorites loading to include file data
- `apps/frontend/src/app/components/favorites/` — file upload UI per item

❌ **Out of Scope:**

- File uploads for entity types other than favorites — `file-service` is general-purpose but Phase 2.1 only wires the frontend integration for favorites; suggestions, users, and other entities are not connected yet
- S3 / cloud object storage — local Docker volume for now; production storage backend decided in Phase 6.2/6.4
- Virus scanning (ClamAV) — deferred to Phase 3.6; mitigated here by magic bytes validation + strict MIME allowlist + UUID storage paths
- Image resizing / thumbnail generation
- File sharing between users — files are owned by `uploadedBy` userId

## Deviations from ENHANCEMENT-PLAN.md

`ENHANCEMENT-PLAN.md` Phase 2.1 is a high-level sketch. The following decisions document implementation details that go beyond what the sketch specifies.

---

### 1. Multiple files per entity instead of one

**Original:** `ENHANCEMENT-PLAN.md` says "Create a new `file-service` microservice for file upload/download/delete" — does not specify how many files per entity or how the association is stored.

**Decision:** Multiple files per entity — `FileEntity` is its own table with `entityType` + `entityId` columns; `GET /files?entityType=favorite&entityId=:id` returns an array.

**Why:** A user should be able to attach multiple files (e.g. a photo and a PDF) to the same favorite. A single FK or path column cannot support this without a schema redesign later. The `entityType`/`entityId` pattern also makes the service reusable for any entity type (suggestions, user avatars) with no schema changes.

---

### 2. Custom `ProgressDiskStorage` instead of default Multer storage

**Original:** "Install multer, file validation libraries" — implied default `memoryStorage` (entire file buffered in RAM).

**Decision:** Custom `ProgressDiskStorage` Multer storage engine using `diskStorage` — file streams directly to disk; `file.stream.on('data', chunk)` intercepts each chunk to emit Socket.IO progress events.

**Why:** The requirement is to support large files (700 MB–1 GB+). With `memoryStorage`, a 1 GB video sits entirely in Node.js heap for the duration of the upload — not viable. `diskStorage` was the natural fix, but standard `diskStorage` gives no way to emit per-chunk progress. A custom storage engine solves both: streams to disk without RAM pressure, and intercepts `file.stream` data events to emit real progress. TUS (resumable upload protocol with multiple PATCH requests) was also evaluated but ruled out because a single HTTP connection was preferred over multiple requests.

---

### 3. Layered security instead of basic size + MIME validation

**Original:** "Add file validation (size limits, MIME types)."

**Decision:** Multiple layers:

- **Multer stream limit** (5 GB) — aborts upload mid-stream before the file is fully written, server never sees oversized content
- **Declared MIME allowlist** (controller `FileTypeValidator`) — first-pass filter on what the browser claims
- **Magic bytes check** via `file-type` (service) — reads actual file header bytes from disk after Multer writes the temp file; catches executables renamed to `.jpg`
- **`sanitize-filename`** — strips path separators, null bytes, and dangerous characters from `originalName` before storing in DB
- **UUID-only storage path** — `/uploads/{userId}/{fileId}/file`; no user-supplied input ever appears in the disk path, eliminating path traversal entirely
- **SVG and legacy Office blocked** — SVG can embed `<script>` (XSS); `.doc`/`.xls`/`.ppt` support macros; only OOXML variants (`.docx`/`.xlsx`/`.pptx`) allowed

**Why:** Browser-declared MIME type is trivially spoofed — any client can send `Content-Type: image/jpeg` with an executable payload. Each layer catches a different attack vector; no single check is sufficient alone.

---

### 4. Upload progress via Socket.IO (not mentioned in original)

**Original:** No mention of upload progress.

**Decision:** Server emits `upload-progress` (percent, bytesReceived, totalBytes), `upload-complete`, and `upload-error` Socket.IO events. In Phase 2.1 `SocketGateway.emitToUser()` is a no-op stub — upload works fully, events are silently dropped. Phase 2.2 replaces the stub with the real Socket.IO gateway; no backend changes needed.

**Why:** A progress bar is essential UX for large file uploads. With a single HTTP connection (no chunked TUS protocol), XHR `upload.onprogress` gives client-side bytes-sent but the server has no channel to confirm bytes received or report post-upload scan status. Socket.IO solves both: real server-confirmed progress during upload and async events (scan-started, scan-complete, error) after the HTTP request finishes.

---

### 5. Cascade delete via RabbitMQ (not mentioned in original)

**Original:** No mention of what happens to files when a favorite is deleted.

**Decision:** `favorite-service` publishes `favorite.deleted` to RabbitMQ on `DELETE /favorite/:id`; `file-service` subscribes and calls `deleteByEntity('favorite', favoriteId)` to remove all associated files from disk and DB.

**Why:** Without cascade delete, deleting a favorite leaves orphaned files on disk and in the DB forever. Doing the delete synchronously from the frontend (call `DELETE /files` then `DELETE /favorite`) is fragile — a network error between the two calls leaves partial state. RabbitMQ decouples the services: `favorite-service` fires and forgets; `file-service` handles cleanup reliably even if it's temporarily down when the event is published (durable queue).

---

### 6. S3 deferred, migration path made explicit

**Original:** "Configure file storage (local volumes or S3)" — treated as a Phase 2.1 choice.

**Decision:** Local Docker `uploads` volume in Phase 2.1. S3 migration deferred to Phase 6.2/6.4 and isolated to replacing `fs.renameSync` in `FileService.upload()` with an S3 `putObject` call. The API surface, `FileEntity`, `ProgressDiskStorage`, and all endpoints are unchanged when switching storage backends.

**Why:** S3 is a deployment concern, not a feature concern. Coupling it to Phase 2.1 would block the feature on infrastructure setup. Keeping `FileService.upload()` as the only place that touches the file system means storage backend is swappable with a single focused change.

---

## Why This Matters

### Why a dedicated `file-service` and not `favorite-service`

Putting file upload logic inside `favorite-service` would tie it to one domain. The moment another entity needs file storage — a suggestion cover image, a user avatar — the logic would have to be duplicated or pulled out anyway. A dedicated `file-service` knows nothing about favorites: the association is just data (`entityType='favorite'`, `entityId=:uuid`) stored on `FileEntity`. Any future entity type uses the same six endpoints with a different `entityType` value, with no code or schema changes in either `file-service` or the calling service.

There is also a separation-of-concerns benefit at the infrastructure level: `file-service` has its own `postgres-files` database, its own `uploads` volume, and its own RabbitMQ consumer queue. A problem in file storage (disk full, slow scan) cannot bring down the favorites feature, and the file-service can be scaled independently if upload throughput demands it.

### Implementation decisions

`FavoriteEntity` is not touched and stores no file reference. Multiple files per entity are supported from day one via the `FileEntity` table. Cascade delete via RabbitMQ means deleting a favorite automatically cleans up its files without any frontend orchestration.

---

## Implementation Steps

### Step 1: Scaffold `file-service` (2-3 hours)

Generate the new NestJS application:

```bash
npm exec nx -- g @nx/nest:app file-service --directory=apps/file-service
```

Wire the same infrastructure modules already used by other services. All shared infrastructure comes from `@suggestify/backend/*` libraries:

```typescript
// apps/file-service/src/app.module.ts
import { ConsulModule } from '@suggestify/backend/consul';
import { MetricsModule } from '@suggestify/backend/metrics';
import { LoggerModule } from '@suggestify/backend/logger';

@Module({
  imports: [
    TsRestModule.register({ isGlobal: true }),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ ... }),       // connect to postgres-files (see Step 6)
    JwtModule.registerAsync({ ... }),           // reuse JWT_SECRET env var
    MulterModule.registerAsync({              // async because uploadDir comes from ConfigService
      imports: [ConfigModule],
      inject: [ConfigService, SocketGateway],
      useFactory: (config: ConfigService, gateway: SocketGateway) => ({
        storage: new ProgressDiskStorage(config.get('UPLOAD_TEMP_DIR'), gateway),
        limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB — Multer aborts mid-stream if exceeded
      }),
    }),
    HealthModule,                               // local ./health/health.module (same pattern as other services)
    ConsulModule.forRoot({ serviceName: 'file-service', servicePort: 3005, tags: ['files', 'microservice'] }),
    MetricsModule,
    LoggerModule.forRoot({ serviceName: 'file-service' }),
  ],
  providers: [SocketGateway], // must be here so MulterModule.registerAsync can inject it
})
export class AppModule {}
```

`apps/file-service/src/main.ts` — RabbitMQ consumer is connected via `connectMicroservice()`, same pattern as `history-service`:

```typescript
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
app.enableShutdownHooks();
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
app.setGlobalPrefix('v1');

// RabbitMQ consumer for cascade delete
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL],
    queue: 'file_queue',
    queueOptions: { durable: true },
  },
});

await app.startAllMicroservices();
await app.listen(PORT);
```

---

### Step 2: `FileEntity` (45 min)

`apps/file-service/src/file/entities/file.entity.ts`:

```typescript
@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column()
  size: number; // bytes

  @Column()
  storagePath: string; // /uploads/{uploadedBy}/{id}/file

  @Column()
  uploadedBy: string; // userId from X-User-Id header

  @Column({ nullable: true })
  entityType?: string; // e.g. 'favorite', 'suggestion', 'user'

  @Column({ nullable: true })
  entityId?: string; // UUID of the associated entity

  @CreateDateColumn()
  createdAt: Date;
}
```

`entityType` and `entityId` are nullable — a file can be uploaded without being attached to any entity yet, or attached at upload time. Add a composite index on `(entityType, entityId)` for fast lookups:

```typescript
@Index(['entityType', 'entityId'])
@Entity('files')
export class FileEntity { ... }
```

`apps/file-service/src/data-source.ts` was created in Step 1 following the same pattern as `auth-service`. Migration generation requires a live `postgres-files` database, so it is deferred to Step 6 once Docker Compose is set up.

---

### Step 3: `FileService` + `ProgressDiskStorage` (2-3 hours)

Install input validation packages:

```bash
npm install file-type sanitize-filename
npm install --save-dev @types/sanitize-filename
```

#### `ProgressDiskStorage` — custom Multer storage engine

`apps/file-service/src/file/progress-disk-storage.ts` — streams file to disk while emitting Socket.IO progress events per chunk. Replaces both `memoryStorage` and `diskStorage`:

```typescript
import { StorageEngine } from 'multer';
import { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { SocketGateway } from '../socket/socket.gateway';

export class ProgressDiskStorage implements StorageEngine {
  constructor(
    private readonly tempDir: string,
    private readonly gateway: SocketGateway,
  ) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  _handleFile(req: Request, file: Express.Multer.File, cb: Function) {
    const userId = req.headers['x-user-id'] as string;
    const fileId = uuid();
    const tempPath = path.join(this.tempDir, fileId);
    const total = parseInt(req.headers['content-length'] ?? '0');
    let received = 0;

    const writeStream = fs.createWriteStream(tempPath);

    file.stream.on('data', (chunk: Buffer) => {
      received += chunk.length;
      this.gateway.emitToUser(userId, 'upload-progress', {
        fileId,
        bytesReceived: received,
        totalBytes: total,
        percent: total > 0 ? Math.round((received / total) * 100) : 0,
      });
    });

    file.stream
      .pipe(writeStream)
      .on('error', (err) => {
        fs.unlink(tempPath, () => {});
        cb(err);
      })
      .on('finish', () =>
        cb(null, { filename: fileId, path: tempPath, size: received }),
      );
  }

  _removeFile(_req: Request, file: Express.Multer.File, cb: Function) {
    fs.unlink(file.path, cb);
  }
}
```

`SocketGateway` is stubbed in Phase 2.1 — progress events are silently dropped, upload works correctly. Phase 2.2 replaces the stub with the real implementation; `ProgressDiskStorage` needs no changes.

```typescript
// apps/file-service/src/socket/socket.gateway.ts — Phase 2.1 stub
@Injectable()
export class SocketGateway {
  emitToUser(_userId: string, _event: string, _payload: unknown): void {
    // no-op until Phase 2.2 wires Socket.IO
  }
}
```

#### `FileService` methods

`apps/file-service/src/file/file.service.ts` — six methods:

```typescript
async upload(userId: string, file: Express.Multer.File, entityType?: string, entityId?: string): Promise<FileEntity>
async findByEntity(entityType: string, entityId: string): Promise<FileEntity[]>
async deleteByEntity(entityType: string, entityId: string): Promise<void>
async createDownloadToken(userId: string, fileId: string): Promise<string>
async validateTokenAndGetPath(token: string, fileId: string): Promise<string>
async delete(userId: string, fileId: string): Promise<void>
```

**Storage path:** `/uploads/{userId}/{fileId}/file`

The actual disk path never contains user-supplied input — only the UUID `fileId` and a fixed filename `file`. The original filename is stored only in `FileEntity.originalName`. This eliminates path traversal via crafted filenames entirely.

**`upload` — validation then move from temp to final location:**

```typescript
// 1. Magic bytes check — read first bytes from temp file on disk (no buffer in memory)
const fd = fs.openSync(file.path, 'r');
const header = Buffer.alloc(4100);
fs.readSync(fd, header, 0, 4100, 0);
fs.closeSync(fd);

const detected = await fileTypeFromBuffer(header);
if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
  fs.unlinkSync(file.path); // clean up temp file before throwing
  throw new BadRequestException(
    `File type ${detected?.mime ?? 'unknown'} is not allowed`,
  );
}

// 2. Sanitize original filename — strip path separators, null bytes, dangerous chars
const safeName = sanitize(file.originalname) || 'unnamed';

// 3. Move temp file to final UUID path — no user input in disk path
const fileId = file.filename; // UUID assigned by ProgressDiskStorage
const finalDir = path.join(this.uploadDir, userId, fileId);
fs.mkdirSync(finalDir, { recursive: true });
fs.renameSync(file.path, path.join(finalDir, 'file'));

// 4. Save entity — emit upload-complete via Socket.IO
const entity = await this.repo.save({
  id: fileId,
  originalName: safeName,
  mimeType: detected.mime, // use detected mime, not declared
  size: file.size,
  storagePath: path.join(finalDir, 'file'),
  uploadedBy: userId,
  entityType,
  entityId,
});

this.gateway.emitToUser(userId, 'upload-complete', {
  fileId,
  originalName: entity.originalName,
  mimeType: entity.mimeType,
  size: entity.size,
});

return entity;
```

Key differences from `memoryStorage`: `file.buffer` is never populated — the file is on disk at `file.path` the moment `upload()` is called. Magic bytes check reads the first 4100 bytes from the temp file. `fs.renameSync` replaces `writeFileSync` (atomic on same filesystem).

- `findByEntity` — `WHERE entity_type = $1 AND entity_id = $2`; returns array (supports multiple files per entity in future).
- `deleteByEntity` — find all files matching `entityType` + `entityId`, delete each from disk + DB. Used by the RabbitMQ cascade consumer.
- `createDownloadToken` — verify the file belongs to `userId`, sign a JWT (`{ fileId, storagePath }`, 60s TTL) using `JwtService`, return the token.
- `validateTokenAndGetPath` — verify the JWT, confirm `fileId` matches, check the file exists on disk, return the absolute path.
- `delete` — verify ownership, delete file from disk (`fs.unlinkSync`), delete `FileEntity` from DB.

---

### Step 5: `FileController` — 6 endpoints + cascade consumer (2-3 hours)

`apps/file-service/src/file/file.controller.ts`:

**`POST /files`** — upload with optional entity association (ts-rest, `contentType: 'multipart/form-data'`)

`ProgressDiskStorage` and the 5 GB stream limit are both configured in `MulterModule.registerAsync()` (Step 1). `FileInterceptor` picks them up automatically — no options needed here:

```typescript
@TsRestHandler(c.file.upload)
@UseInterceptors(FileInterceptor('file')) // storage + limits come from MulterModule
async upload(
  @Headers('X-User-Id') userId: string,
  @Body() body: { entityType?: string; entityId?: string },
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new FileTypeValidator({
          // Declared MIME first-pass filter (magic bytes check happens in FileService)
          // SVG excluded — can contain embedded <script> tags (XSS)
          // Legacy Office excluded (.doc/.xls/.ppt) — support macros; allow only OOXML (.docx/.xlsx/.pptx)
          fileType: /^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|x-msvideo|webm)|audio\/(mpeg|wav|ogg|mp4)|application\/(pdf|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation))|text\/(plain|csv))$/,
        }),
      ],
    }),
  ) file: Express.Multer.File,
)
```

Returns: `FileSchema`

**`GET /files`** — get files by entity (ts-rest, query params)

```typescript
@TsRestHandler(c.file.getByEntity)
async getByEntity()
// Query: ?entityType=favorite&entityId=:uuid
// Returns: FileSchema[]
```

**`GET /files/:id`** — get file metadata (ts-rest)

Returns: `FileSchema`

**`GET /files/:id/download`** — returns signed download URL (ts-rest)

Returns: `z.object({ downloadUrl: z.string() })`

**`GET /files/:id/stream?token=`** — streams bytes (plain NestJS, outside ts-rest)

```typescript
@Get(':id/stream')
async stream(@Param('id') id: string, @Query('token') token: string, @Res() res: Response) {
  const filePath = await this.fileService.validateTokenAndGetPath(token, id);
  res.sendFile(filePath);
}
```

**`DELETE /files/:id`** — delete single file (ts-rest)

Returns: 204 no body

**RabbitMQ cascade consumer** — listens for `favorite.deleted` events:

```typescript
@EventPattern('favorite.deleted') // EventPattern, not MessagePattern — favorite-service uses emit() (fire-and-forget), not send()
async onFavoriteDeleted(@Payload() data: { favoriteId: string }) {
  await this.fileService.deleteByEntity('favorite', data.favoriteId);
}
```

---

### Step 6: Docker Compose — `postgres-files` + `file-service` + volume (1-2 hours)

`infrastructure/docker-compose.yml`:

```yaml
file-service:
  build:
    context: ..
    dockerfile: apps/file-service/Dockerfile
  container_name: file-service
  environment:
    PORT: 3005
    DATABASE_HOST: postgres-files
    DATABASE_PORT: 5432
    DATABASE_NAME: files_db
    DATABASE_USER: postgres
    DATABASE_PASSWORD: postgres
    JWT_SECRET: ${JWT_SECRET}
    UPLOAD_DIR: /uploads
    UPLOAD_TEMP_DIR: /uploads/temp
    CONSUL_HOST: consul
    SERVICE_NAME: file-service
    SERVICE_PORT: 3005
    RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
  volumes:
    - uploads:/uploads
  networks: [microservices-network]
  depends_on:
    postgres-files:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy
    consul:
      condition: service_healthy
  restart: unless-stopped

postgres-files:
  image: postgres:16-alpine
  container_name: postgres-files
  environment:
    POSTGRES_DB: files_db
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  ports: ['5435:5432']
  volumes: [postgres-files-data:/var/lib/postgresql/data]
  networks: [microservices-network]
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U postgres']
    interval: 10s
    timeout: 5s
    retries: 5
  restart: unless-stopped

# Top-level volumes additions:
volumes:
  postgres-files-data:
  uploads:
```

After adding the containers, start `postgres-files` and generate + apply the migration:

```bash
docker compose -f infrastructure/docker-compose.yml up postgres-files -d

npm exec nx -- run file-service:"migration:generate" --args="--name=CreateFilesTable"
# Review generated SQL — verify bigint for size, composite index on (entityType, entityId)
npm exec nx -- run file-service:"migration:run"
```

Wire the generated migration class into `app.module.ts`:

```typescript
import { CreateFilesTable<timestamp> } from './migrations/<timestamp>-CreateFilesTable';

// inside TypeOrmModule.forRootAsync useFactory:
migrations: [CreateFilesTable<timestamp>],
```

---

### Step 7: API gateway — proxy + circuit breaker (1 hour)

Add `file-service` to the API gateway following the same pattern as `favorite-service`:

- Proxy route: `GET|POST|DELETE /v1/files/*` → `file-service`
- Circuit breaker name: `file-service`
- Consul discovery key: `file-service`

**Stream endpoint JWT exception:**

`GET /v1/files/:id/stream?token=` must be exempted from the gateway's session JWT (`Authorization` header) check. This is intentional and safe — the browser navigates to this URL directly (e.g. via `<a href="...">`) and cannot attach an `Authorization` header during navigation.

Authentication is still enforced, just via a different mechanism — a **capability token** (short-lived JWT, 60s TTL, signed with the same `JWT_SECRET`) passed in the query param. The only way to obtain a valid capability token is to call `GET /files/:id/download` first, which is session-JWT protected. So the security chain is:

```
GET /files/:id/download   ← gateway checks session JWT ✅
  → file-service validates file ownership
  → returns { downloadUrl: '...?token=<signed-jwt>' }

GET /files/:id/stream?token=  ← gateway skips session JWT (browser navigation)
  → file-service validates capability token: correct signature, not expired, correct fileId ✅
  → streams file
```

Unauthenticated users cannot produce a valid capability token. This is the same pattern used by AWS S3 presigned URLs.

**How to implement the exemption in the gateway:**

Check how the existing JWT guard is applied — look at `apps/api-gateway/src/` for a guard decorated with `@Injectable()` that implements `CanActivate` and reads the `Authorization` header. It is most likely applied globally in `main.ts` via `app.useGlobalGuards()` or in `AppModule` via `APP_GUARD`. Add a route exclusion:

```typescript
// If using a custom guard with route metadata:
@SetMetadata('isPublic', true) // or use a @Public() decorator
// on the proxy handler for /files/:id/stream

// If using app.useGlobalGuards() — switch to APP_GUARD provider
// so NestJS DI can resolve route metadata in the guard:
const canActivate = (context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest();
  if (req.path.match(/\/v1\/files\/[^/]+\/stream/)) return true; // capability token auth, handled by file-service
  // ... existing JWT check
};
```

Read the actual guard implementation before adding the exemption — the exact approach depends on how it is currently structured.

---

### Step 4: ts-rest contract — `file.contract.ts` (1-2 hours)

**`libs/shared/contract/src/lib/schemas.ts`** — add `FileSchema`:

```typescript
export const FileSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  uploadedBy: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  createdAt: z.union([z.string(), z.date()]),
});
```

**`libs/shared/contract/src/lib/file.contract.ts`** — new contract:

```typescript
export const fileContract = c.router({
  upload: {
    method: 'POST',
    path: '/files',
    contentType: 'multipart/form-data',
    body: z.object({
      file: z.any(),
      entityType: z.string().optional(),
      entityId: z.string().uuid().optional(),
    }),
    responses: { [Status.Created]: FileSchema },
  },
  getByEntity: {
    method: 'GET',
    path: '/files',
    query: z.object({
      entityType: z.string(),
      entityId: z.string().uuid(),
    }),
    responses: { [Status.Ok]: z.array(FileSchema) },
  },
  getMetadata: {
    method: 'GET',
    path: '/files/:id',
    responses: { [Status.Ok]: FileSchema },
  },
  download: {
    method: 'GET',
    path: '/files/:id/download',
    responses: { [Status.Ok]: z.object({ downloadUrl: z.string() }) },
  },
  delete: {
    method: 'DELETE',
    path: '/files/:id',
    responses: { [Status.NoContent]: c.noBody() },
  },
});
```

Export from `libs/shared/contract/src/index.ts`.

---

### Step 8: `favorite-service` — publish `favorite.deleted` event (45 min)

`FavoriteEntity` is **not changed** — no migration needed.

Update `DELETE /favorite/:id` handler in `apps/favorite-service/src/favorite/favorite.controller.ts` to publish a RabbitMQ event after deleting the entity:

```typescript
@TsRestHandler(c.favorite.remove)
async remove(@Headers('X-User-Id') userId: string) {
  return tsRestHandler(c.favorite.remove, async ({ params }) => {
    await this.favoriteService.remove(userId, params.id);
    this.rabbitMQClient.emit('favorite.deleted', { favoriteId: params.id });
    return { status: 204, body: undefined };
  });
}
```

Check whether `favorite-service` already has `ClientsModule` wired for RabbitMQ publishing. It has never needed to publish events before (only consumed them via `connectMicroservice`). If `ClientsModule` is not present in `apps/favorite-service/src/app.module.ts`, add it:

```typescript
ClientsModule.register([{
  name: 'RABBITMQ_CLIENT',
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL],
    queue: 'file_queue',
    queueOptions: { durable: true },
  },
}]),
```

Then inject `@Inject('RABBITMQ_CLIENT') private readonly rabbitMQClient: ClientProxy` in the controller.

---

### Step 9: Frontend — `FileService` + favorites integration (4-6 hours)

**New `apps/frontend/src/app/services/file.service.ts`:**

```typescript
@Injectable({ providedIn: 'root' })
export class FileService {
  constructor(private readonly api: TsRestClient) {}

  upload(
    file: File,
    entityType: string,
    entityId: string,
  ): Observable<FileItem> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    return from(this.api.file.upload({ body: formData as any })).pipe(
      map(({ body }) => body),
    );
  }

  getByEntity(entityType: string, entityId: string): Observable<FileItem[]> {
    return from(
      this.api.file.getByEntity({ query: { entityType, entityId } }),
    ).pipe(map(({ body }) => body));
  }

  download(fileId: string, fileName: string): void {
    from(this.api.file.download({ params: { id: fileId } }))
      .pipe(map(({ body }) => body.downloadUrl))
      .subscribe((url) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
      });
  }

  delete(fileId: string): Observable<void> {
    return from(this.api.file.delete({ params: { id: fileId } })).pipe(
      map(() => void 0),
    );
  }
}
```

**Update `apps/frontend/src/app/services/favorite.service.ts`:**

Remove `attachFile` / `detachFile` — no longer needed. When favorites load, fetch associated files in parallel:

```typescript
loadFavoritesWithFiles(): Observable<FavoriteWithFile[]> {
  return this.getAll().pipe(
    switchMap(favorites =>
      favorites.length === 0
        ? of([])
        : forkJoin(
            favorites.map(fav =>
              this.fileService.getByEntity('favorite', fav.id).pipe(
                map(files => ({ ...fav, files })),
              )
            )
          )
    )
  );
}
```

**Cascade delete is automatic** — `removeFavorite` calls `DELETE /favorite/:id` as before; `favorite-service` publishes the event; `file-service` deletes the file. No frontend change needed for cleanup.

**Update favorites UI** (`favorites.component.html` + `.ts`) — each favorite shows a list of attached files with per-file download and delete, plus an "Add file" button to attach more:

```html
<div class="favorite-files">
  @for (file of favorite.files; track file.id) {
  <div class="file-item">
    <span class="file-name">📎 {{ file.originalName }}</span>
    <span class="file-size">{{ formatFileSize(file.size) }}</span>
    <button (click)="downloadFile(file.id, file.originalName)">⬇</button>
    <button (click)="deleteFile(file.id, favorite.id)">🗑</button>
  </div>
  }
  <label class="upload-label">
    📎 Add file
    <input
      type="file"
      hidden
      (change)="onFileSelected($event, favorite.id)"
      accept="image/*,video/*,audio/*,application/pdf,.docx,.xlsx,.pptx,text/*"
    />
  </label>
</div>
```

```typescript
// uploadProgress signal: null = idle, 0-100 = uploading
uploadProgress = signal<Record<string, number>>({});

onFileSelected(event: Event, favoriteId: string): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // Phase 2.1: upload works, progress events are no-ops on the server (stub gateway).
  // Phase 2.2: wire notificationService.on('upload-progress') and on('upload-complete') here
  // to drive the progress bar — no changes to FileService or ProgressDiskStorage needed.

  // HTTP call via ts-rest — triggers streaming upload
  this.fileService.upload(file, 'favorite', favoriteId).subscribe({
    next: (uploaded) => { /* append uploaded to favorite.files signal */ },
    error: () => { /* show error notification */ },
  });
}

downloadFile(fileId: string, fileName: string): void {
  this.fileService.download(fileId, fileName);
}

deleteFile(fileId: string, favoriteId: string): void {
  this.fileService.delete(fileId).subscribe({
    next: () => { /* remove file from favorite.files signal */ },
    error: () => { /* notify */ },
  });
}
```

Progress bar in template — shown while `uploadProgress[fileId]` is set:

```html
@for (fileId of objectKeys(uploadProgress()); track fileId) {
<div class="upload-progress">
  <span>Uploading...</span>
  <progress [value]="uploadProgress()[fileId]" max="100"></progress>
  <span>{{ uploadProgress()[fileId] }}%</span>
</div>
}
```

---

### Step 10: Build and verification (2-3 hours)

```bash
# Lint + build
npm run lint:all
npx nx run-many --target=build --projects=contract,file-service,favorite-service,api-gateway,frontend

# Rebuild and restart
docker compose -f infrastructure/docker-compose.yml build --no-cache=false file-service favorite-service
docker compose -f infrastructure/docker-compose.yml up -d

# Verify infrastructure
docker volume ls | grep uploads
docker ps | grep file-service
docker logs file-service --tail 20  # confirm Consul registration + RabbitMQ connection

# Manual test
# 1. Log in at http://localhost:4200
# 2. Add a favorite
# 3. Click "Attach file" → upload an image, PDF, video, audio file
# 4. Verify file appears on the favorite (name, size)
# 5. Click download → browser downloads the file
# 6. Delete the favorite → verify file deleted from file-service DB and disk (cascade)
# 7. Re-add the favorite → no file attached (confirms cascade worked)
# 8. Upload .exe renamed to .jpg → 400 (magic bytes mismatch)
# 9. Upload .svg → 400 (blocked)
# 10. Upload .doc → 400 (legacy Office blocked)
# 11. Upload file > 5 GB → connection aborted mid-stream (Multer size limit)
# 12. Stop file-service → upload attempt returns 503 (circuit breaker)
```

---

## Verification Checklist

### file-service

- [ ] `file-service` container starts and registers with Consul
- [ ] `postgres-files` container is healthy; `files` table exists with `entity_type`, `entity_id` columns
- [ ] Composite index on `(entity_type, entity_id)` present in DB
- [ ] Migration marked `[X]` in `migration:show`
- [ ] `POST /v1/files` with image + entityType/entityId — 201 with `FileSchema`, entity columns populated
- [ ] `POST /v1/files` with video, audio, PDF, docx — 201 each
- [ ] `POST /v1/files` without entityType/entityId — 201, entity columns null (unattached file)
- [ ] `POST /v1/files` > 5 GB — connection aborted mid-stream by Multer
- [ ] `POST /v1/files` with `.exe` renamed to `.jpg` — 400 (magic bytes)
- [ ] `POST /v1/files` with `.svg` — 400
- [ ] `POST /v1/files` with `.doc` — 400 (legacy Office)
- [ ] `POST /v1/files` with path traversal filename — 201; `originalName` in DB is sanitized
- [ ] Files stored at `/uploads/{userId}/{fileId}/file` (no user input in path)
- [ ] `GET /v1/files?entityType=favorite&entityId=:id` — returns array with the uploaded file
- [ ] `GET /v1/files/:id/download` — 200 with `{ downloadUrl }`
- [ ] `GET /v1/files/:id/stream?token=` — streams binary with correct `Content-Type`
- [ ] `GET /v1/files/:id/stream` with expired token — 401
- [ ] `DELETE /v1/files/:id` — 204; entity removed from DB; file deleted from disk
- [ ] Files persist after `docker restart file-service`

### Cascade Delete

- [ ] `DELETE /v1/favorite/:id` → `favorite.deleted` event published to RabbitMQ
- [ ] `file-service` consumer receives event → deletes all files where `entityType='favorite' AND entityId=:favoriteId`
- [ ] File deleted from disk after cascade
- [ ] `GET /v1/files?entityType=favorite&entityId=:deletedId` returns empty array after cascade

### Contract

- [ ] `FileSchema` exported from contract library
- [ ] `fileContract` has `upload`, `getByEntity`, `getMetadata`, `download`, `delete` routes
- [ ] `nx build contract` — 0 TypeScript errors

### Frontend

- [ ] "Add file" button visible on every favorite
- [ ] Uploading a file — progress bar appears and fills in real time (Socket.IO `upload-progress` events)
- [ ] Progress bar disappears and file appears in the list on `upload-complete` event
- [ ] Uploading a second file to the same favorite — both files appear in the list
- [ ] Download button on each file triggers browser download
- [ ] Delete button removes individual file from the list and from file-service
- [ ] Deleting a favorite triggers cascade — all associated files removed from file-service automatically
- [ ] `nx build frontend` — 0 TypeScript errors

### Progress Tracking (Phase 2.1 — stub; Phase 2.2 — live)

- [ ] `ProgressDiskStorage._handleFile` calls `gateway.emitToUser()` on each chunk (no-op in Phase 2.1, live in Phase 2.2)
- [ ] `upload-complete` called after `repo.save()` (no-op in Phase 2.1, live in Phase 2.2)
- [ ] `SocketGateway` stub compiles and `file-service` starts without errors
- [ ] **Phase 2.2**: replace stub with real `@WebSocketGateway` — progress bar appears in frontend with no further backend changes

---

## Rollback Strategy

```bash
# 1. Revert file-service migration (drops files table)
npm exec nx -- run file-service:"migration:revert"

# 2. Remove uploaded files and volume
docker compose -f infrastructure/docker-compose.yml down
docker volume rm infrastructure_uploads

# 3. Revert code
git checkout apps/file-service/
git checkout apps/favorite-service/src/favorite/favorite.controller.ts
git checkout infrastructure/docker-compose.yml
git checkout libs/shared/contract/src/
git checkout apps/frontend/src/app/services/
git checkout apps/frontend/src/app/components/favorites/
```

`FavoriteEntity` is not changed in this phase — no migration revert needed for `favorite-service`.

---

## Timeline Summary

| Step      | Task                                                                                                                                                | Time                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1         | Scaffold `file-service` (AppModule, Consul, metrics, Pino, Multer, RabbitMQ)                                                                        | 2-3 hours                                                       |
| 2         | `FileEntity` + composite index + data-source + migration                                                                                            | 45 min                                                          |
| 3         | `FileService` + `ProgressDiskStorage` — upload (magic bytes, sanitization, UUID path), findByEntity, deleteByEntity, download token, stream, delete | 2-3 hours                                                       |
| 4         | ts-rest contract — `file.contract.ts` + `FileSchema`                                                                                                | 1-2 hours                                                       |
| 5         | `FileController` — 6 endpoints + RabbitMQ cascade consumer                                                                                          | 2-3 hours                                                       |
| 6         | Docker Compose — `postgres-files`, `file-service`, `uploads` volume                                                                                 | 1-2 hours                                                       |
| 7         | API gateway — proxy route + circuit breaker + stream endpoint JWT exception                                                                         | 1 hour                                                          |
| 8         | `favorite-service` — verify/add `ClientsModule`, publish `favorite.deleted` on delete                                                               | 45 min                                                          |
| 9         | Frontend — `FileService` + favorites load with files + upload UI                                                                                    | 4-6 hours                                                       |
| 10        | Build, Docker rebuild, manual verification                                                                                                          | 2-3 hours                                                       |
| **Total** |                                                                                                                                                     | **~17-25 hours (~3-4 days best case, 5-7 days with debugging)** |

---

## Notes on Dependencies

- **Phase 2.2 (WebSocket Notifications)** — `ProgressDiskStorage` calls `SocketGateway.emitToUser()` which is stubbed as a no-op in Phase 2.1 (upload works fully, progress events are silently dropped). Phase 2.2 replaces the stub with the real Socket.IO gateway; no changes to `ProgressDiskStorage` or `FileService` are needed — progress events start flowing automatically.
- **Phase 1.1 (Database Migrations)** — already implemented. `file-service` follows the same migration setup as existing services.
- **Phase 6.2/6.4 (Terraform / Production Deployment)** — local Docker volume works on a single host but won't survive in multi-instance or managed container environments (ECS, Fargate, Kubernetes). Phase 6.2 must decide the production storage backend — S3/GCS/Azure Blob or EFS. Switching to S3: replace `fs.renameSync` in `FileService.upload()` with `s3.putObject(fs.createReadStream(file.path))` then `fs.unlinkSync(file.path)`. The API surface (endpoints, `FileEntity`, `FileSchema`) and `ProgressDiskStorage` streaming logic remain unchanged — only the final-move step changes.
- **Phase 3.6 (ClamAV Virus Scanning)** — adds AV scanning between the `fs.renameSync` step and `repo.save()` in `FileService.upload()`. File is fully on disk at `file.path` before `upload()` is called, so `clamscan.scanFile(file.path)` works directly. If infected: `fs.unlinkSync(file.path)`, emit `upload-error` via Socket.IO, throw 422.

---

**Phase 2.1 Status**: Ready to implement
**Next Phase**: Phase 2.2 — Real-time Notifications with WebSocket

# Phase 0.5: Extract Infrastructure Modules to Shared Libraries — Implementation Plan

## Overview

Extract ~1,250 lines of duplicated infrastructure code from 5 NestJS services into 4 shared Nx libraries. Every service currently maintains its own copy of metrics, consul, circuit breaker, and health modules. After this phase, each service imports from a shared library and contains only its own business logic.

## Current Duplication Audit

| Module            | Files per service                       | Total lines (×5)              | Duplication % | Notes                                                                             |
|-------------------|-----------------------------------------|-------------------------------|---------------|-----------------------------------------------------------------------------------|
| `metrics`         | 3 files (module + service + controller) | 78 lines × 5 = **390 lines**  | **100%**      | Every byte identical across all 5 services                                        |
| `consul`          | 2 files (module + service)              | 131 lines × 5 = **655 lines** | **~90%**      | Only service name, port, and tags differ                                          |
| `circuit-breaker` | 2 files (module + service)              | ~74 lines × 5 = **370 lines** | **~80%**      | 3 variants; api-gateway has errorFilter; 3 services have an unused `breakers` Map |
| `health`          | 2 files (module + controller)           | ~37 lines × 5 = **185 lines** | **~50%**      | Module identical; controllers differ by DB indicator (TypeORM / Mongoose / HTTP)  |
| **Total**         | **9 files × 5 services = 45 files**     | **~1,600 lines**              |               |                                                                                   |

**After extraction: ~1,250 lines removed, 45 files → 4 library index files + per-service wiring.**

---

## Scope — Phase 0.5 Only

✅ **In Scope:**
- Create 4 Nx libraries: `libs/backend/metrics`, `libs/backend/consul`, `libs/backend/circuit-breaker`, `libs/backend/health`
- Implement each library as a NestJS module
- Update all 5 services to import from shared libraries
- Delete per-service duplicated folders
- Update `tsconfig.base.json` path mappings

❌ **Out of Scope:**
- NO changes to business logic (favorite, suggestion, history, auth modules)
- NO changes to Docker configuration
- NO new features in any library
- NO shared library for non-infrastructure code (API contracts, DTOs — future phases)

---

## Library Design Decisions

### Metrics — copy as-is
All 3 files are 100% identical across every service. Zero changes needed; just move to `libs/backend/metrics` and re-export.

### Consul — `forRoot()` with options
The 5 services differ only in: `serviceName`, `servicePort`, `tags`. The approach is a static `forRoot(options)` factory on `ConsulModule`. Each service passes its specific values at registration time. All other logic (registration, deregistration, discovery, KV store) lives in the shared library unchanged.

### Circuit Breaker — single canonical implementation
Three variants exist across services:
- `api-gateway`: 83 lines, has `errorFilter` for ignoring 4xx HTTP errors
- `auth-service`: 65 lines, cleanest base
- `suggestion / history / favorite`: 66 lines, identical to auth-service but with an unused `private breakers = new Map()` field

**Decision**: Start from auth-service (cleanest) and add `errorFilter` as an optional property on `CircuitBreakerOptions` — this covers api-gateway's needs without imposing it on others. Remove the unused `breakers` Map from all.

### Health — shared module + `HEALTH_INDICATORS` injection token
The `HealthModule` (10 lines) is identical across all 5 services — extract as-is. The `HealthController` (27 lines) shares memory checks across all services but has a per-service DB indicator. Rather than duplicating the memory check logic, use an injection token `HEALTH_INDICATORS` that each service provides. The shared controller handles memory checks + appends the injected indicators.

---

## Target Structure After Phase 0.5

```
nest-project/
├── apps/
│   ├── api-gateway/src/
│   │   ├── app.module.ts              # imports from libs
│   │   ├── health/
│   │   │   └── health.module.ts       # provides HEALTH_INDICATORS (HttpHealthIndicator)
│   │   ├── proxy/                     # business logic (unchanged)
│   │   └── main.ts
│   ├── auth-service/src/
│   │   ├── app.module.ts
│   │   ├── health/
│   │   │   └── health.module.ts       # provides HEALTH_INDICATORS (TypeOrmHealthIndicator)
│   │   └── auth/                      # business logic (unchanged)
│   └── ... (same pattern for remaining 3 services)
│
└── libs/
    └── backend/
        ├── metrics/
        │   ├── src/
        │   │   ├── lib/
        │   │   │   ├── metrics.module.ts
        │   │   │   ├── metrics.service.ts
        │   │   │   └── metrics.controller.ts
        │   │   └── index.ts
        │   └── project.json
        ├── consul/
        │   ├── src/
        │   │   ├── lib/
        │   │   │   ├── consul.module.ts
        │   │   │   ├── consul.options.ts
        │   │   │   └── consul.service.ts
        │   │   └── index.ts
        │   └── project.json
        ├── circuit-breaker/
        │   ├── src/
        │   │   ├── lib/
        │   │   │   ├── circuit-breaker.module.ts
        │   │   │   ├── circuit-breaker.options.ts
        │   │   │   └── circuit-breaker.service.ts
        │   │   └── index.ts
        │   └── project.json
        └── health/
            ├── src/
            │   ├── lib/
            │   │   ├── health.module.ts
            │   │   ├── health.controller.ts
            │   │   └── health.tokens.ts
            │   └── index.ts
            └── project.json
```

---

## Implementation Steps

### Step 1: Generate Library Skeletons (30 min)

First verify the `@nx/nest` plugin is available (used in Phase 0.1 for app generation):

```bash
pnpm nx g @nx/nest:library --help
```

If the command is not found, install the plugin:

```bash
npm install --save-dev @nx/nest
```

Generate all 4 libraries. Use `--buildable` so Nx can compile them independently, and set `--importPath` to the TypeScript alias each service will use:

```bash
pnpm nx g @nx/nest:library \
  --name=metrics \
  --directory=libs/backend/metrics \
  --buildable \
  --importPath=@suggestify/backend/metrics

pnpm nx g @nx/nest:library \
  --name=consul \
  --directory=libs/backend/consul \
  --buildable \
  --importPath=@suggestify/backend/consul

pnpm nx g @nx/nest:library \
  --name=circuit-breaker \
  --directory=libs/backend/circuit-breaker \
  --buildable \
  --importPath=@suggestify/backend/circuit-breaker

pnpm nx g @nx/nest:library \
  --name=health \
  --directory=libs/backend/health \
  --buildable \
  --importPath=@suggestify/backend/health
```

Each generator creates `libs/backend/<name>/src/lib/` with a placeholder module and `src/index.ts`. We replace the placeholder content in the steps below.

Verify the 4 projects appear in the Nx graph:

```bash
pnpm nx graph
```

---

### Step 2: Implement Metrics Library (30 min)

The metrics module is 100% identical across all services. Copy files from any service — `apps/favorite-service/src/infrastructure/metrics/` is the reference.

**`libs/backend/metrics/src/lib/metrics.service.ts`** — copy as-is from any service (55 lines, all identical).

**`libs/backend/metrics/src/lib/metrics.controller.ts`** — copy as-is from any service (13 lines, all identical).

**`libs/backend/metrics/src/lib/metrics.module.ts`** — copy as-is from any service (10 lines, all identical):

```typescript
import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
```

**`libs/backend/metrics/src/index.ts`** — public API surface:

```typescript
export { MetricsModule } from './lib/metrics.module';
export { MetricsService } from './lib/metrics.service';
```

---

### Step 3: Implement Consul Library (1 hour)

The consul service logic is shared; only `serviceName`, `servicePort`, and `tags` differ per service. Use a `forRoot()` pattern to inject these at registration time.

**`libs/backend/consul/src/lib/consul.options.ts`:**

```typescript
export interface ConsulModuleOptions {
  serviceName: string;
  servicePort: number;
  tags?: string[];
}

export const CONSUL_OPTIONS = 'CONSUL_OPTIONS';
```

**`libs/backend/consul/src/lib/consul.service.ts`** — based on any service's consul.service.ts (all are structurally identical). Replace the hardcoded values with injected options:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import * as Consul from 'consul';
import { CONSUL_OPTIONS, ConsulModuleOptions } from './consul.options';

@Injectable()
export class ConsulService implements OnModuleInit, OnModuleDestroy {
  private client: Consul.Consul;
  private serviceId: string;

  constructor(@Inject(CONSUL_OPTIONS) private options: ConsulModuleOptions) {
    this.client = new Consul({
      host: process.env.CONSUL_HOST || 'consul',
      port: parseInt(process.env.CONSUL_PORT || '8500'),
    });
    this.serviceId = `${this.options.serviceName}-${process.env.HOSTNAME || 'localhost'}-${Date.now()}`;
  }

  async onModuleInit() {
    await this.registerService();
  }

  async onModuleDestroy() {
    await this.deregisterService();
  }

  private async registerService() {
    await this.client.agent.service.register({
      id: this.serviceId,
      name: this.options.serviceName,
      address: process.env[`${this.options.serviceName.toUpperCase().replace(/-/g, '_')}_HOST`]
        || this.options.serviceName,
      port: parseInt(process.env.PORT || String(this.options.servicePort)),
      tags: this.options.tags ?? [this.options.serviceName, 'microservice', 'nestjs'],
      check: {
        http: `http://${this.options.serviceName}:${this.options.servicePort}/health`,
        interval: '10s',
        timeout: '5s',
        deregistercriticalserviceafter: '30s',
      },
    });
  }

  private async deregisterService() {
    await this.client.agent.service.deregister(this.serviceId);
  }

  async discoverService(serviceName: string) {
    const result = await this.client.health.service({ service: serviceName, passing: true });
    const services = (result as any)[0] as any[];
    if (!services?.length) throw new Error(`No healthy instances of ${serviceName}`);
    const idx = Math.floor(Math.random() * services.length);
    const svc = services[idx].Service;
    return { host: svc.Address, port: svc.Port };
  }

  async getConfig(key: string) {
    const result = await this.client.kv.get(key);
    return (result as any)?.[0]?.Value
      ? Buffer.from((result as any)[0].Value, 'base64').toString()
      : null;
  }

  async setConfig(key: string, value: string) {
    await this.client.kv.set(key, value);
  }
}
```

**`libs/backend/consul/src/lib/consul.module.ts`:**

```typescript
import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConsulService } from './consul.service';
import { CONSUL_OPTIONS, ConsulModuleOptions } from './consul.options';

@Global()
@Module({})
export class ConsulModule {
  static forRoot(options: ConsulModuleOptions): DynamicModule {
    return {
      module: ConsulModule,
      providers: [
        { provide: CONSUL_OPTIONS, useValue: options },
        ConsulService,
      ],
      exports: [ConsulService],
    };
  }
}
```

**`libs/backend/consul/src/index.ts`:**

```typescript
export { ConsulModule } from './lib/consul.module';
export { ConsulService } from './lib/consul.service';
export { ConsulModuleOptions } from './lib/consul.options';
```

---

### Step 4: Implement Circuit Breaker Library (1 hour)

Base: `apps/auth-service/src/infrastructure/circuit-breaker/circuit-breaker.service.ts` (cleanest, 65 lines). Add optional `errorFilter` from api-gateway's implementation. Remove the unused `breakers` Map from suggestion/history/favorite variants.

**`libs/backend/circuit-breaker/src/lib/circuit-breaker.options.ts`:**

```typescript
export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  errorFilter?: (err: Error) => boolean;
}
```

**`libs/backend/circuit-breaker/src/lib/circuit-breaker.service.ts`:**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker = require('opossum');
import { CircuitBreakerOptions } from './circuit-breaker.options';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  create<T>(
    action: (...args: unknown[]) => Promise<T>,
    options?: CircuitBreakerOptions,
  ): CircuitBreaker {
    const breakerOptions: CircuitBreaker.Options = {
      timeout: options?.timeout ?? 5000,
      errorThresholdPercentage: options?.errorThresholdPercentage ?? 50,
      resetTimeout: options?.resetTimeout ?? 30000,
    };

    if (options?.errorFilter) {
      breakerOptions.errorFilter = options.errorFilter;
    }

    const breaker = new CircuitBreaker(action, breakerOptions);

    breaker.on('open', () =>
      this.logger.warn(`Circuit breaker opened`),
    );
    breaker.on('halfOpen', () =>
      this.logger.log(`Circuit breaker half-open`),
    );
    breaker.on('close', () =>
      this.logger.log(`Circuit breaker closed`),
    );

    return breaker;
  }
}
```

**`libs/backend/circuit-breaker/src/lib/circuit-breaker.module.ts`:**

```typescript
import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';

@Global()
@Module({
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class CircuitBreakerModule {}
```

**`libs/backend/circuit-breaker/src/index.ts`:**

```typescript
export { CircuitBreakerModule } from './lib/circuit-breaker.module';
export { CircuitBreakerService } from './lib/circuit-breaker.service';
export { CircuitBreakerOptions } from './lib/circuit-breaker.options';
```

**api-gateway only**: when registering with api-gateway, pass the errorFilter that ignores 4xx errors:

```typescript
// api-gateway creates its breakers like:
const breaker = this.circuitBreakerService.create(action, {
  errorFilter: (err: any) => err?.response?.status < 500,
});
```

---

### Step 5: Implement Health Library (1 hour)

The `HealthModule` is identical across all services (imports TerminusModule and HttpModule). The `HealthController` shares memory checks but uses different DB indicators. Use the `HEALTH_INDICATORS` injection token so each service contributes its own indicator without duplicating the memory check logic.

**`libs/backend/health/src/lib/health.tokens.ts`:**

```typescript
export const HEALTH_INDICATORS = 'HEALTH_INDICATORS';
```

**`libs/backend/health/src/lib/health.controller.ts`** — base controller with memory checks + injected extra indicators:

```typescript
import { Controller, Get, Inject, Optional } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { HEALTH_INDICATORS } from './health.tokens';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    @Optional()
    @Inject(HEALTH_INDICATORS)
    private indicators: HealthIndicatorFunction[] = [],
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRss('memory_rss', 512 * 1024 * 1024),
      ...this.indicators,
    ]);
  }
}
```

**`libs/backend/health/src/lib/health.module.ts`:**

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

**`libs/backend/health/src/index.ts`:**

```typescript
export { HealthModule } from './lib/health.module';
export { HEALTH_INDICATORS } from './lib/health.tokens';
```

---

### Step 6: Update `tsconfig.base.json` Path Mappings (15 min)

Add the 4 library aliases so TypeScript resolves imports. File: `tsconfig.base.json`, inside `compilerOptions.paths`:

```json
{
  "compilerOptions": {
    "paths": {
      "@suggestify/backend/metrics": ["libs/backend/metrics/src/index.ts"],
      "@suggestify/backend/consul": ["libs/backend/consul/src/index.ts"],
      "@suggestify/backend/circuit-breaker": ["libs/backend/circuit-breaker/src/index.ts"],
      "@suggestify/backend/health": ["libs/backend/health/src/index.ts"]
    }
  }
}
```

Verify paths are picked up:

```bash
pnpm nx graph  # libs should appear as dependencies of apps
```

---

### Step 7: Update All 5 Services (1 hour)

For each service: update `app.module.ts` imports and wire the `HEALTH_INDICATORS` token. Delete the local infrastructure folder after wiring.

#### 7a. api-gateway

**`apps/api-gateway/src/app.module.ts`** — replace:
```typescript
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { ConsulModule } from './infrastructure/consul/consul.module';
import { CircuitBreakerModule } from './infrastructure/circuit-breaker/circuit-breaker.module';
import { HealthModule } from './health/health.module';
```
with:
```typescript
import { MetricsModule } from '@suggestify/backend/metrics';
import { ConsulModule } from '@suggestify/backend/consul';
import { CircuitBreakerModule } from '@suggestify/backend/circuit-breaker';
import { HealthModule } from '@suggestify/backend/health';
```

Update `ConsulModule` in imports array:
```typescript
ConsulModule.forRoot({
  serviceName: 'api-gateway',
  servicePort: 3000,
  tags: ['api-gateway', 'microservice', 'nestjs'],
}),
```

**`apps/api-gateway/src/health/`** — keep only a `health.module.ts` that provides the HTTP indicator:

```typescript
// apps/api-gateway/src/health/health.module.ts
import { Module } from '@nestjs/common';
import { HttpHealthIndicator } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HEALTH_INDICATORS } from '@suggestify/backend/health';

@Module({
  imports: [HttpModule],
  providers: [
    HttpHealthIndicator,
    {
      provide: HEALTH_INDICATORS,
      useFactory: (http: HttpHealthIndicator) => [
        () => http.pingCheck('auth-service', 'http://auth-service:3001/health'),
      ],
      inject: [HttpHealthIndicator],
    },
  ],
  exports: [HEALTH_INDICATORS],
})
export class HealthModule {}
```

Import `HealthModule` (local) in `app.module.ts` — it provides `HEALTH_INDICATORS` which the shared controller picks up.

Delete:
- `apps/api-gateway/src/infrastructure/metrics/`
- `apps/api-gateway/src/infrastructure/consul/`
- `apps/api-gateway/src/infrastructure/circuit-breaker/`
- `apps/api-gateway/src/health/health.controller.ts` (replaced by shared controller)

---

#### 7b. auth-service

Update imports in `app.module.ts` same as api-gateway.

```typescript
ConsulModule.forRoot({
  serviceName: 'auth-service',
  servicePort: 3001,
  tags: ['auth', 'microservice', 'nestjs'],
}),
```

**`apps/auth-service/src/health/health.module.ts`:**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HEALTH_INDICATORS } from '@suggestify/backend/health';

@Module({
  providers: [
    TypeOrmHealthIndicator,
    {
      provide: HEALTH_INDICATORS,
      useFactory: (db: TypeOrmHealthIndicator) => [
        () => db.pingCheck('database', { timeout: 3000 }),
      ],
      inject: [TypeOrmHealthIndicator],
    },
  ],
  exports: [HEALTH_INDICATORS],
})
export class HealthModule {}
```

Delete local infrastructure folders + `health.controller.ts`.

---

#### 7c. suggestion-service

```typescript
ConsulModule.forRoot({
  serviceName: 'suggestion-service',
  servicePort: 3002,
  tags: ['suggestion', 'microservice', 'nestjs'],
}),
```

**`apps/suggestion-service/src/health/health.module.ts`** — same as auth-service (also uses TypeORM):

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HEALTH_INDICATORS } from '@suggestify/backend/health';

@Module({
  providers: [
    TypeOrmHealthIndicator,
    {
      provide: HEALTH_INDICATORS,
      useFactory: (db: TypeOrmHealthIndicator) => [
        () => db.pingCheck('database', { timeout: 3000 }),
      ],
      inject: [TypeOrmHealthIndicator],
    },
  ],
  exports: [HEALTH_INDICATORS],
})
export class HealthModule {}
```

Delete local infrastructure folders + `health.controller.ts`.

---

#### 7d. history-service

```typescript
ConsulModule.forRoot({
  serviceName: 'history-service',
  servicePort: 3003,
  tags: ['history', 'microservice', 'nestjs'],
}),
```

**`apps/history-service/src/health/health.module.ts`** — uses Mongoose instead of TypeORM:

```typescript
import { Module } from '@nestjs/common';
import { MongooseHealthIndicator } from '@nestjs/terminus';
import { HEALTH_INDICATORS } from '@suggestify/backend/health';

@Module({
  providers: [
    MongooseHealthIndicator,
    {
      provide: HEALTH_INDICATORS,
      useFactory: (mongoose: MongooseHealthIndicator) => [
        () => mongoose.pingCheck('mongodb'),
      ],
      inject: [MongooseHealthIndicator],
    },
  ],
  exports: [HEALTH_INDICATORS],
})
export class HealthModule {}
```

Delete local infrastructure folders + `health.controller.ts`.

---

#### 7e. favorite-service

```typescript
ConsulModule.forRoot({
  serviceName: 'favorite-service',
  servicePort: 3004,
  tags: ['favorite', 'microservice', 'nestjs'],
}),
```

**`apps/favorite-service/src/health/health.module.ts`** — same as auth-service (TypeORM):

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HEALTH_INDICATORS } from '@suggestify/backend/health';

@Module({
  providers: [
    TypeOrmHealthIndicator,
    {
      provide: HEALTH_INDICATORS,
      useFactory: (db: TypeOrmHealthIndicator) => [
        () => db.pingCheck('database', { timeout: 3000 }),
      ],
      inject: [TypeOrmHealthIndicator],
    },
  ],
  exports: [HEALTH_INDICATORS],
})
export class HealthModule {}
```

Delete local infrastructure folders + `health.controller.ts`.

---

### Step 8: Verification (1 hour)

**8.1 TypeScript — no import errors:**

```bash
pnpm nx run-many -t build --all
```

All 5 services + 4 libs should build. Fix any TS errors before proceeding.

**8.2 Nx graph shows correct dependencies:**

```bash
pnpm nx graph
```

Expected: every backend service shows arrows to all 4 libs. No unexpected cross-app dependencies.

**8.3 Unit tests still pass:**

```bash
pnpm nx run-many -t test --all
```

**8.4 Lint:**

```bash
pnpm nx run-many -t lint --all
```

**8.5 Docker build and health check:**

```bash
npm start
```

Wait for all services to be healthy, then verify:

```bash
curl http://localhost:3000/v1/health   # api-gateway
curl http://localhost:3001/health      # auth-service
curl http://localhost:3002/health      # suggestion-service
curl http://localhost:3003/health      # history-service
curl http://localhost:3004/health      # favorite-service
```

All should return `{"status":"ok"}`.

**8.6 Metrics endpoint:**

```bash
curl http://localhost:3001/metrics   # should return Prometheus text format
```

**8.7 Consul UI:**

Open `http://localhost:8500` — all 5 services should appear as registered and healthy.

---

### Step 9: Cleanup (30 min)

**Only proceed after ALL verification in Step 8 passes.**

Delete duplicated per-service infrastructure folders:

```bash
# api-gateway
rm -rf apps/api-gateway/src/infrastructure/metrics
rm -rf apps/api-gateway/src/infrastructure/consul
rm -rf apps/api-gateway/src/infrastructure/circuit-breaker
rm apps/api-gateway/src/health/health.controller.ts

# auth-service
rm -rf apps/auth-service/src/infrastructure/metrics
rm -rf apps/auth-service/src/infrastructure/consul
rm -rf apps/auth-service/src/infrastructure/circuit-breaker
rm apps/auth-service/src/health/health.controller.ts

# suggestion-service
rm -rf apps/suggestion-service/src/infrastructure/metrics
rm -rf apps/suggestion-service/src/infrastructure/consul
rm -rf apps/suggestion-service/src/infrastructure/circuit-breaker
rm apps/suggestion-service/src/health/health.controller.ts

# history-service
rm -rf apps/history-service/src/infrastructure/metrics
rm -rf apps/history-service/src/infrastructure/consul
rm -rf apps/history-service/src/infrastructure/circuit-breaker
rm apps/history-service/src/health/health.controller.ts

# favorite-service
rm -rf apps/favorite-service/src/infrastructure/metrics
rm -rf apps/favorite-service/src/infrastructure/consul
rm -rf apps/favorite-service/src/infrastructure/circuit-breaker
rm apps/favorite-service/src/health/health.controller.ts
```

Run builds and tests one more time after cleanup to confirm nothing broke:

```bash
pnpm nx run-many -t build --all
pnpm nx run-many -t test --all
```

---

## Verification Checklist

### Libraries
- [ ] `libs/backend/metrics/` — 3 files implemented, `index.ts` exports MetricsModule and MetricsService
- [ ] `libs/backend/consul/` — ConsulModule.forRoot() functional, options injected correctly
- [ ] `libs/backend/circuit-breaker/` — optional errorFilter works, no unused Map property
- [ ] `libs/backend/health/` — HEALTH_INDICATORS token injected, memory checks in base controller

### TypeScript
- [ ] `tsconfig.base.json` — all 4 `@suggestify/backend/*` paths defined
- [ ] `pnpm nx run-many -t build --all` — zero TypeScript errors

### Services
- [ ] All 5 `app.module.ts` — import from `@suggestify/backend/*` (not local paths)
- [ ] All 5 services — `ConsulModule.forRoot({ serviceName, servicePort, tags })` configured
- [ ] All 5 services — local `health.module.ts` provides `HEALTH_INDICATORS`
- [ ] No `./infrastructure/metrics`, `./infrastructure/consul`, `./infrastructure/circuit-breaker` local imports remain

### Runtime
- [ ] `npm start` — all 15 containers healthy
- [ ] All 5 `/health` endpoints return `{"status":"ok"}`
- [ ] All 5 `/metrics` endpoints return Prometheus format
- [ ] Consul UI — all 5 services registered

### Nx Graph
- [ ] `pnpm nx graph` — 5 apps → 4 libs (correct dependency arrows)
- [ ] No unexpected cross-app dependencies

---

## Rollback Strategy

Each step is independently reversible via git:

```bash
git status          # see what changed
git restore apps/   # restore all service changes
git restore tsconfig.base.json
git clean -fd libs/ # remove generated library files
```

If only one library causes issues, restore that library's consumers:

```bash
git restore apps/favorite-service/
```

Recommend committing after each step with clear messages:
- After Step 1: `chore: generate shared library skeletons`
- After Step 2: `feat: extract metrics to shared library`
- After Step 3: `feat: extract consul to shared library`
- After Step 4: `feat: extract circuit-breaker to shared library`
- After Step 5: `feat: extract health to shared library`
- After Step 6: `chore: add tsconfig path mappings for shared libs`
- After Step 7: `feat: update all services to use shared libraries`
- After Step 9 (cleanup): `chore: remove duplicated infrastructure folders`

---

## Common Issues & Solutions

### Issue: `Cannot find module '@suggestify/backend/metrics'`
**Solution**: Verify `tsconfig.base.json` paths are correct and that the library's `src/index.ts` exists. Run `pnpm nx reset` to clear any stale cache.

### Issue: `NestJS DI — No provider for HEALTH_INDICATORS`
**Solution**: The `@Optional()` decorator on the shared controller makes the token optional. If you see this error, `@Optional()` is missing from the constructor. Double-check `libs/backend/health/src/lib/health.controller.ts`.

### Issue: Consul registers with wrong port
**Solution**: The `ConsulModule.forRoot()` `servicePort` is the fallback. Actual port is read from `process.env.PORT`. Verify the env var is set correctly in `docker-compose.yml` for each service.

### Issue: `Circuit breaker errorFilter` — 4xx responses not ignored in api-gateway
**Solution**: The api-gateway's services that create circuit breakers must pass the `errorFilter` option explicitly when calling `circuitBreakerService.create()`. The shared library has no default errorFilter — each call site opts in.

### Issue: Build fails with `Cannot find module 'opossum'`
**Solution**: `opossum` is in root `dependencies`. The lib's `tsconfig.lib.json` should extend `tsconfig.base.json`. If Nx build can't resolve it, add `"skipLibCheck": true` to the lib's tsconfig.

### Issue: `TypeOrmHealthIndicator` not available in health module
**Solution**: `TypeOrmHealthIndicator` is provided by `@nestjs/terminus` but only when TypeORM is active in the module context. Verify the service's `app.module.ts` imports `TypeOrmModule.forRootAsync(...)` before the local `HealthModule`.

---

## Benefits After Phase 0.5

| Metric                   | Before                                   | After                                        |
|--------------------------|------------------------------------------|----------------------------------------------|
| Infrastructure files     | 45 files (9 × 5 services)                | 4 library files + 5 × local health.module.ts |
| Lines of duplicated code | ~1,600 lines                             | ~0 (only service-specific wiring remains)    |
| Bug fix scope            | Fix in 5 places                          | Fix once in the library                      |
| Nx graph                 | 5 isolated apps                          | 5 apps with explicit shared lib dependencies |
| `pnpm nx affected`       | Can't detect cross-service infra changes | Library change marks all 5 services affected |

---

## Timeline Summary

| Step                    | Task                                                                                                         | Estimate                  |
|-------------------------|--------------------------------------------------------------------------------------------------------------|---------------------------|
| 1                       | Generate library skeletons                                                                                   | 45 min                    |
| 2                       | Implement Metrics library                                                                                    | 30 min                    |
| 3                       | Implement Consul library                                                                                     | 2 hours                   |
| 4                       | Implement Circuit Breaker library                                                                            | 1.5 hours                 |
| 5                       | Implement Health library                                                                                     | 2 hours                   |
| 6                       | Update tsconfig.base.json                                                                                    | 15 min                    |
| 7                       | Update all 5 services                                                                                        | 2 hours                   |
| 8                       | Verification                                                                                                 | 2 hours                   |
| 9                       | Cleanup                                                                                                      | 30 min                    |
| **Troubleshooting**     | NestJS DI errors at runtime; Nx buildable lib tsconfig edge cases; Docker rebuild cycles (~15 min per cycle) | **2–3 hours**             |
| **Total**               |                                                                                                              | **~14–15 hours (2–3 days)** |

**What drives overruns in this phase specifically:**
- Health library `HEALTH_INDICATORS` injection token issues only surface at runtime (after a full Docker build)
- Consul `forRoot()` DI wiring needs to be verified against all 5 different service registrations
- Each Docker rebuild cycle to confirm a fix takes 10–15 minutes
- Phase 0.1 reference: planned 5.75h → actual 12.7h (2.2× overrun) — same category of NestJS + Docker work

---

**Phase 0.5 Status**: Ready to implement
**Next Phase**: Phase 0.6 — Pre-commit Hooks (Husky + lint-staged)

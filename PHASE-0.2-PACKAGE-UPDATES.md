# Phase 0.2: Package Updates & Dependency Modernization - Implementation Plan

## Overview

Upgrade all major dependencies including Angular 18→22, TypeScript 5→6, and Vite 5→6. This phase modernizes the entire tech stack, enables native Vitest support in Angular, and removes legacy peer dependency workarounds.

## Scope - Phase 0.2 Only

✅ **In Scope:**
- Upgrade Angular from 18.2.14 to 22.0.4
- Upgrade TypeScript from 5.4.x to 6.0.x
- Upgrade Vite from 5.x to 6.x (bundled with Angular 22)
- Setup native Vitest support (replaces Karma/Jasmine workarounds)
- Update NestJS packages to latest v10.x
- Update all other dependencies to latest stable versions
- Remove legacy-peer-deps npm configurations
- Fix breaking changes and compilation errors
- Verify all builds and tests

❌ **Out of Scope (Future Phases):**
- NO shared library extraction (Phase 0.5)
- NO infrastructure refactoring (Phase 0.3-0.4)
- NO new features or code improvements

## Why This Matters

### Current State
- Angular 18 with Vite 5 (no native Vitest support)
- TypeScript 5.4.x (older type checking)
- Using `@analogjs/vite-plugin-angular` workarounds for Vitest
- 78 npm vulnerabilities (3 low, 46 moderate, 27 high, 2 critical)
- Test setup is fragile and incomplete

### Target State
- Angular 22 with Vite 6 (native Vitest 4 support)
- TypeScript 6.0.x (improved type checking)
- Native Angular 22 testing tools (no workarounds needed)
- Reduced vulnerabilities
- Modern tooling compatibility

### Benefits
- **Native Vitest Support**: Angular 22 has built-in Vitest integration
- **Better Type Safety**: TypeScript 6 improvements
- **Security Patches**: Fix vulnerabilities
- **Performance**: Angular 22 performance improvements
- **Future-proof**: Latest stable versions

## Configuration Decisions

- **Upgrade Strategy**: All packages at once (not incremental)
- **Testing Strategy**: Fix tests after upgrade
- **Git Branch**: Work in current branch (enhance)
- **Backup**: Keep package.json.backup and package-lock.json.backup
- **Estimated Time**: 6-8 hours (1 working day)

## Target Package Versions

### Frontend Dependencies
```json
{
  "@angular/animations": "~22.0.4",
  "@angular/common": "~22.0.4",
  "@angular/compiler": "~22.0.4",
  "@angular/core": "~22.0.4",
  "@angular/forms": "~22.0.4",
  "@angular/platform-browser": "~22.0.4",
  "@angular/platform-browser-dynamic": "~22.0.4",
  "@angular/router": "~22.0.4"
}
```

### Frontend Dev Dependencies
```json
{
  "@angular-devkit/build-angular": "~22.0.4",
  "@angular-devkit/core": "~22.0.4",
  "@angular/build": "~22.0.4",
  "@angular/compiler-cli": "~22.0.4",
  "typescript": "~6.0.0",
  "vitest": "^4.0.8"
}
```

### Backend Dependencies (NestJS)

> **Note:** Original plan targeted NestJS v10. Corrected to v11 during execution — the pre-migration codebase was v11.

```json
{
  "@nestjs/axios": "^4.0.1",
  "@nestjs/cache-manager": "^3.1.3",
  "@nestjs/common": "^11.1.27",
  "@nestjs/config": "^4.0.4",
  "@nestjs/core": "^11.1.27",
  "@nestjs/jwt": "^11.0.2",
  "@nestjs/microservices": "^11.1.27",
  "@nestjs/mongoose": "^11.0.4",
  "@nestjs/passport": "^11.0.5",
  "@nestjs/platform-express": "^11.1.27",
  "@nestjs/terminus": "^11.1.1",
  "@nestjs/throttler": "^6.5.0",
  "@nestjs/typeorm": "^11.0.3",
  "@nestjs/testing": "^11.1.27"
}
```

## Implementation Steps

**Note:** No backup steps needed - Git is the backup. Just commit before starting and you can always revert.

### Step 1: Remove Vitest Workarounds (15 min)

Since Angular 22 has native Vitest support, we need to clean up our workarounds first.

1. **Remove custom Vitest packages:**
   ```bash
   npm uninstall @analogjs/vite-plugin-angular @analogjs/vitest-angular vite-tsconfig-paths
   ```

2. **Delete custom vite config:**
   ```bash
   rm apps/frontend/vite.config.mts
   ```

3. **Delete custom test setup (will be regenerated):**
   ```bash
   rm apps/frontend/src/test-setup.ts
   ```

### Step 2: Upgrade Angular to 22 (1-2 hours)

1. **Update Angular CLI globally (optional):**
   ```bash
   npm install -g @angular/cli@22
   ```

2. **Use ng update for automated migration:**
   ```bash
   cd apps/frontend
   npx ng update @angular/core@22 @angular/cli@22 --allow-dirty --force
   ```

   This command:
   - Updates all @angular/* packages to v22
   - Runs migration schematics
   - Updates configurations automatically
   - May prompt for breaking changes

3. **If ng update fails, manual update:**

   Edit root `package.json`:
   ```json
   {
     "dependencies": {
       "@angular/animations": "~22.0.4",
       "@angular/common": "~22.0.4",
       "@angular/compiler": "~22.0.4",
       "@angular/core": "~22.0.4",
       "@angular/forms": "~22.0.4",
       "@angular/platform-browser": "~22.0.4",
       "@angular/platform-browser-dynamic": "~22.0.4",
       "@angular/router": "~22.0.4"
     },
     "devDependencies": {
       "@angular-devkit/build-angular": "~22.0.4",
       "@angular-devkit/core": "~22.0.4",
       "@angular/build": "~22.0.4",
       "@angular/compiler-cli": "~22.0.4"
     }
   }
   ```

4. **Delete node_modules and package-lock.json:**
   ```bash
   cd ../..  # back to root
   rm -rf node_modules package-lock.json
   ```

### Step 3: Upgrade TypeScript to 6 (15 min)

Angular 22 requires TypeScript 6.

1. **Update TypeScript version:**
   ```json
   {
     "devDependencies": {
       "typescript": "~6.0.0"
     }
   }
   ```

2. **Check TypeScript 6 breaking changes:**
   - Stricter type checking
   - New compiler errors may appear
   - Some type assertions may need updates

### Step 4: Setup Native Vitest Support (30 min)

Angular 22 has built-in Vitest support through `@angular/build`.

1. **Install Vitest 4:**
   ```json
   {
     "devDependencies": {
       "vitest": "^4.0.8",
       "@vitest/ui": "^4.0.8",
       "jsdom": "^29.1.1"
     }
   }
   ```

2. **Update frontend project.json test target:**
   ```json
   {
     "test": {
       "executor": "@angular/build:vitest",
       "options": {
         "configFile": "apps/frontend/vitest.config.ts"
       }
     }
   }
   ```

3. **Create Angular 22 compatible vitest.config.ts:**
   ```typescript
   // apps/frontend/vitest.config.ts
   import { defineConfig } from 'vitest/config';
   import angular from '@analogjs/vite-plugin-angular';

   export default defineConfig({
     plugins: [angular()],
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: ['src/test-setup.ts'],
       include: ['src/**/*.{test,spec}.ts'],
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html']
       }
     }
   });
   ```

4. **Create test-setup.ts:**
   ```typescript
   // apps/frontend/src/test-setup.ts
   import 'zone.js';
   import 'zone.js/testing';
   import { getTestBed } from '@angular/core/testing';
   import {
     BrowserDynamicTestingModule,
     platformBrowserDynamicTesting,
   } from '@angular/platform-browser-dynamic/testing';

   getTestBed().initTestEnvironment(
     BrowserDynamicTestingModule,
     platformBrowserDynamicTesting(),
   );
   ```

### Step 5: Update NestJS Packages (30 min)

1. **Check latest NestJS versions:**
   ```bash
   npm view @nestjs/core version
   ```

2. **Update all @nestjs/* packages (target: v11):**
   ```json
   {
     "dependencies": {
       "@nestjs/axios": "^4.0.1",
       "@nestjs/cache-manager": "^3.1.3",
       "@nestjs/common": "^11.1.27",
       "@nestjs/config": "^4.0.4",
       "@nestjs/core": "^11.1.27",
       "@nestjs/jwt": "^11.0.2",
       "@nestjs/microservices": "^11.1.27",
       "@nestjs/mongoose": "^11.0.4",
       "@nestjs/passport": "^11.0.5",
       "@nestjs/platform-express": "^11.1.27",
       "@nestjs/terminus": "^11.1.1",
       "@nestjs/throttler": "^6.5.0",
       "@nestjs/typeorm": "^11.0.3"
     },
     "devDependencies": {
       "@nestjs/testing": "^11.1.27"
     }
   }
   ```

### Step 6: Update Other Dependencies (30 min)

1. **Update Nx packages:**
   ```bash
   npm install --save-dev nx@latest @nx/nest@latest @nx/angular@latest @nx/webpack@latest @nx/jest@latest @nx/eslint@latest
   ```

2. **Update other critical dependencies:**
   ```json
   {
     "dependencies": {
       "rxjs": "^7.8.1",
       "zone.js": "^0.15.0"
     },
     "devDependencies": {
       "eslint": "^10.5.0",
       "prettier": "^3.4.2",
       "@types/node": "^22.10.5"
     }
   }
   ```

3. **Check for deprecated packages:**
   ```bash
   npm outdated
   ```

### Step 7: Clean Install (15 min)

1. **Install all dependencies:**
   ```bash
   npm install
   ```

2. **If peer dependency errors occur:**
   ```bash
   # Try to resolve automatically
   npm install --legacy-peer-deps

   # Or fix manually by adjusting versions
   ```

3. **Verify installation:**
   ```bash
   npm list --depth=0
   ```

### Step 8: Fix Breaking Changes (1-2 hours)

This is the most time-consuming step. Common issues:

#### TypeScript 6 Breaking Changes

1. **Stricter null checks:**
   ```typescript
   // Old (TS 5)
   const value = possiblyNull.property;

   // New (TS 6)
   const value = possiblyNull?.property ?? defaultValue;
   ```

2. **Type narrowing changes:**
   ```typescript
   // May need explicit type guards
   if (typeof value === 'string') {
     // Now properly narrowed
   }
   ```

#### Angular 22 Breaking Changes

1. **Input/Output syntax:**
   ```typescript
   // Old
   @Input() name: string;
   @Output() change = new EventEmitter();

   // New (still works, but check for deprecations)
   @Input() name: string;
   @Output() change = new EventEmitter();
   ```

2. **RouterModule changes (if any):**
   Check Angular 22 migration guide

3. **Component decorators:**
   Verify standalone components work correctly

#### NestJS 10.x Changes

1. **Dependency injection:**
   Usually backward compatible, but check for deprecation warnings

2. **Module imports:**
   No major changes expected

### Step 9: Fix Frontend Tests (1 hour)

1. **Update test syntax for Vitest:**
   - Replace Jasmine-specific matchers
   - Already done in previous work: `.toBeTrue()` → `.toBe(true)`

2. **Fix import paths:**
   ```typescript
   // Ensure imports work with new structure
   import { TestBed } from '@angular/core/testing';
   ```

3. **Update mock providers:**
   - Verify mocks still work
   - Check test/mocks/ folder

4. **Run tests:**
   ```bash
   npx nx test frontend
   ```

5. **Fix failing tests one by one:**
   - Component tests
   - Service tests
   - Utility tests

### Step 10: Verify Backend Builds (30 min)

1. **Build each service:**
   ```bash
   npx nx build api-gateway
   npx nx build auth-service
   npx nx build suggestion-service
   npx nx build history-service
   npx nx build favorite-service
   ```

2. **Fix TypeScript errors:**
   - Type errors from TS 6
   - NestJS-related issues
   - Import path issues

3. **Run backend tests:**
   ```bash
   npx nx run-many --target=test --projects=api-gateway,auth-service,suggestion-service,history-service,favorite-service
   ```

### Step 11: Verify Frontend Build (30 min)

1. **Build frontend:**
   ```bash
   npx nx build frontend
   ```

2. **Check for build errors:**
   - TypeScript compilation errors
   - Angular template errors
   - Asset loading issues

3. **Serve and test locally:**
   ```bash
   npx nx serve frontend
   ```

4. **Smoke test in browser:**
   - Load http://localhost:4200
   - Check console for errors
   - Test basic navigation
   - Verify no runtime errors

### Step 12: Update Documentation (15 min)

1. **Update README.md:**
   ```markdown
   ## Tech Stack

   ### Frontend
   - Angular 22.0.4
   - TypeScript 6.0.x
   - Vitest 4.0.8 (native support)
   - RxJS 7.8.x

   ### Backend
   - NestJS 10.4.x
   - TypeScript 6.0.x
   - Node.js 20.x

   ### Testing
   - Vitest (frontend)
   - Jest (backend)

   ## Test Commands
   ```bash
   # Frontend tests with Vitest
   npm exec nx test frontend

   # Backend tests with Jest
   npm exec nx test api-gateway

   # All tests
   npm exec nx run-many --target=test --all
   ```

2. **Update nx.json if needed:**
   - Remove Angular 18 specific configurations
   - Add Vitest-specific cache settings

3. **Document breaking changes:**
   Create MIGRATION-NOTES.md:
   ```markdown
   # Phase 0.2 Migration Notes

   ## Upgraded Packages
   - Angular: 18.2.14 → 22.0.4
   - TypeScript: 5.4.x → 6.0.x
   - Vitest: 2.1.9 → 4.0.8
   - NestJS: 10.0.0 → 10.4.15

   ## Breaking Changes Fixed
   - TypeScript 6 stricter type checking
   - Removed Vitest workarounds
   - Updated test configurations

   ## Known Issues
   - [List any remaining issues]
   ```

### Step 13: Final Verification (30 min)

1. **Run full build:**
   ```bash
   npx nx run-many --target=build --all
   ```

2. **Run all tests:**
   ```bash
   npx nx run-many --target=test --all
   ```

3. **Run all linting:**
   ```bash
   npx nx run-many --target=lint --all
   ```

4. **Test Docker builds:**
   ```bash
   npm run start
   # Wait for services to start
   curl http://localhost:3000/health
   curl http://localhost:3001/health
   curl http://localhost:3002/health
   curl http://localhost:3003/health
   curl http://localhost:3004/health
   curl http://localhost:4200
   npm run stop
   ```

5. **Check for npm vulnerabilities:**
   ```bash
   npm audit
   # Expect significant reduction in vulnerabilities
   ```

6. **Verify dependency graph:**
   ```bash
   npx nx graph
   # Should still show correct dependencies
   ```

## Verification Checklist

Before marking Phase 0.2 complete:

### Package Versions
- [ ] Angular packages are 22.0.4
- [ ] TypeScript is 6.0.x
- [ ] Vitest is 4.0.8
- [ ] NestJS packages are 10.4.x
- [ ] No legacy-peer-deps warnings (or minimal)

### Frontend
- [ ] Frontend builds successfully: `npx nx build frontend`
- [ ] Frontend tests pass: `npx nx test frontend`
- [ ] Frontend serves without errors: `npx nx serve frontend`
- [ ] No console errors in browser
- [ ] Vitest native support works (no workarounds)

### Backend Services
- [ ] All 5 services build successfully
- [ ] All backend tests pass
- [ ] Services start individually with `npx nx serve <service>`
- [ ] Docker compose brings up all services
- [ ] Health endpoints respond

### Testing
- [ ] Vitest runs with native Angular 22 support
- [ ] All frontend tests pass
- [ ] All backend Jest tests pass
- [ ] Test coverage reports generate
- [ ] No test-related errors

### Dependencies
- [ ] No missing peer dependencies
- [ ] npm install runs without errors
- [ ] npm audit shows reduced vulnerabilities
- [ ] No deprecated packages in critical path

### CI/CD
- [ ] GitHub Actions workflow still works
- [ ] All CI checks pass
- [ ] No new workflow errors

## Rollback Strategy

If something goes critically wrong:

### Quick Rollback with Git
```bash
# See recent commits
git log --oneline -5

# Rollback to specific commit
git reset --hard <commit-hash>

# Or rollback last commit
git reset --hard HEAD~1

# Clean and reinstall
rm -rf node_modules
npm install

# Verify old version works
npx nx build frontend
```

### Partial Rollback
If only specific packages are problematic:
```bash
# Rollback just Angular
npm install @angular/core@18.2.14 @angular/common@18.2.14
# etc.

# Or rollback just TypeScript
npm install typescript@5.4.0
```

## Common Issues & Solutions

### Issue: "TypeScript version mismatch"
**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Cannot find module '@angular/...'"
**Solution:**
Ensure all @angular/* packages are the same version:
```bash
npm list | grep @angular
npm install @angular/core@22.0.4 @angular/common@22.0.4 # etc.
```

### Issue: "Peer dependency warnings"
**Solution:**
Check if warnings are critical. Some can be ignored:
```bash
npm install --legacy-peer-deps  # Last resort
```

### Issue: "Vitest tests fail with 'Cannot resolve component'"
**Solution:**
Ensure test-setup.ts initializes Angular testing environment:
```typescript
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
```

### Issue: "Build fails with TypeScript errors"
**Solution:**
TypeScript 6 is stricter:
- Add explicit type annotations
- Fix null/undefined handling
- Use optional chaining (?.)
- Add type guards where needed

### Issue: "Angular build fails"
**Solution:**
```bash
# Clear Angular cache
rm -rf .angular/cache

# Clear Nx cache
npx nx reset

# Rebuild
npx nx build frontend
```

### Issue: "NestJS services fail to start"
**Solution:**
Check for deprecated NestJS imports:
```bash
# Search for deprecation warnings
npx nx serve api-gateway | grep -i deprecat
```

## Expected Results

### Before (Current State)
- Angular 18.2.14
- TypeScript 5.4.x
- Vitest 2.1.9 (with workarounds)
- 78 npm vulnerabilities
- Custom Vitest setup required
- No native testing support

### After (Target State)
- Angular 22.0.4
- TypeScript 6.0.x
- Vitest 4.0.8 (native support)
- <50 npm vulnerabilities (target)
- Clean native Vitest integration
- Better type checking
- Performance improvements

## Timeline Summary

- **Step 1 (Remove workarounds)**: 15 minutes
- **Step 2 (Angular upgrade)**: 1-2 hours
- **Step 3 (TypeScript upgrade)**: 15 minutes
- **Step 4 (Vitest setup)**: 30 minutes
- **Step 5 (NestJS upgrade)**: 30 minutes
- **Step 6 (Other deps)**: 30 minutes
- **Step 7 (Install)**: 15 minutes
- **Step 8 (Fix breaking changes)**: 1-2 hours
- **Step 9 (Fix tests)**: 1 hour
- **Step 10 (Backend verify)**: 30 minutes
- **Step 11 (Frontend verify)**: 30 minutes
- **Step 12 (Documentation)**: 15 minutes
- **Step 13 (Final verification)**: 30 minutes

**Total: 6-8 hours** (1 working day)

## Risk Mitigation

### High Risk Areas
1. **TypeScript 6 breaking changes** - Allocated 1-2 hours for fixes
2. **Angular 22 component changes** - May need template updates
3. **Test failures** - Allocated 1 hour for test fixes

### Mitigation Strategies
- Keep backup branch
- Upgrade in isolated branch first
- Test incrementally
- Document all changes
- Commit frequently at safe points

## Success Criteria

Phase 0.2 is successful when:

1. ✅ All packages upgraded to target versions
2. ✅ All services build without errors
3. ✅ All tests pass
4. ✅ Frontend serves without errors
5. ✅ Docker compose works
6. ✅ Reduced npm vulnerabilities
7. ✅ Native Vitest support working
8. ✅ No legacy-peer-deps needed
9. ✅ Documentation updated
10. ✅ CI/CD pipeline passes

## Next Steps After Phase 0.2

### Phase 0.3: Restructure Infrastructure Folder (0.5 day)
- Move `backend/infrastructure/` to root `infrastructure/`
- Update docker-compose paths
- Infrastructure orchestrates entire system

### Phase 0.4: Fix RxJS Duplication Hack (0.5 day)
- Remove `backend/scripts/remove-duplicate-rxjs.js`
- Let Nx/npm handle dependency deduplication

### Phase 0.5: Extract Infrastructure Modules (2-3 days)
- Create shared libraries
- Reduce code duplication
- Improve maintainability

### Phase 0.6: Pre-commit Hooks (0.5 day)
- Install Husky + lint-staged
- Enforce code quality

---

## Actual Final Package State (Post-Execution)

All packages installed at end of Phase 0.2 (including unplanned upgrades from Steps 14–15):

```json
{
  "devDependencies": {
    "@nestjs/testing": "^11.1.27",
    "@types/bcrypt": "^6.0.0",
    "@types/express": "^5.0.6",
    "@types/jest": "^30.0.0",
    "@types/opossum": "^8.1.9",
    "jest": "^30.4.2",
    "ts-jest": "^29.4.11"
  },
  "dependencies": {
    "@nestjs/axios": "^4.0.1",
    "@nestjs/cache-manager": "^3.1.3",
    "@nestjs/common": "^11.1.27",
    "@nestjs/config": "^4.0.4",
    "@nestjs/core": "^11.1.27",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/microservices": "^11.1.27",
    "@nestjs/mongoose": "^11.0.4",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^11.1.27",
    "@nestjs/terminus": "^11.1.1",
    "@nestjs/throttler": "^6.5.0",
    "@nestjs/typeorm": "^11.0.3",
    "@keyv/redis": "^5.1.6",
    "bcrypt": "^6.0.0",
    "cache-manager": "^7.2.9",
    "consul": "^2.0.1",
    "express": "^5.2.1",
    "helmet": "^8.2.0",
    "mongoose": "^9.7.3",
    "opossum": "^10.0.0",
    "typeorm": "^1.0.0"
  }
}
```

### Notable Deviations from Original Plan

| Package          | Plan        | Actual     | Reason                                                                                                                                                          |
|------------------|-------------|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `@nestjs/*`      | v10         | v11        | Pre-migration codebase was v11; v10 target was incorrect                                                                                                        |
| `typeorm`        | not in plan | `^1.0.0`   | Stable release of TypeORM; breaking `relations` syntax change patched                                                                                           |
| `mongoose`       | not in plan | `^9.7.3`   | Major upgrade; removed deprecated driver options patched                                                                                                        |
| `bcrypt`         | not in plan | `^6.0.0`   | No code changes needed                                                                                                                                          |
| `cache-manager`  | not in plan | `^7.2.9`   | TTL unit change (seconds → ms) patched in all 5 app modules                                                                                                     |
| `@keyv/redis`    | not in plan | `^5.1.6`   | Replaced `cache-manager-redis-yet` — v5 incompatible with `cache-manager` v7 (Keyv-based API); all 5 `app.module.ts` migrated to `stores: [new KeyvRedis(url)]` |
| `@types/opossum` | not in plan | `^8.1.9`   | `opossum` v10 has no bundled types; `breaker.fire()` return cast to `T` in all 5 circuit-breaker services                                                       |
| `helmet`         | not in plan | `^8.2.0`   | No code changes needed                                                                                                                                          |
| `opossum`        | not in plan | `^10.0.0`  | No code changes needed                                                                                                                                          |
| `consul`         | not in plan | `^2.0.1`   | TypeScript import + type fixes applied in all 5 consul.service.ts files                                                                                         |
| `@types/express` | not in plan | `^5.0.6`   | Tied to Express v5 (bundled with NestJS v11)                                                                                                                    |
| `@types/bcrypt`  | not in plan | `^6.0.0`   | Tied to bcrypt v6                                                                                                                                               |
| `jest`           | not in plan | `^30.4.2`  | `jest.SpyInstance` type fix applied                                                                                                                             |
| `@types/jest`    | not in plan | `^30.0.0`  | Tied to Jest 30                                                                                                                                                 |
| `ts-jest`        | not in plan | `^29.4.11` | Jest 30 support (added in 29.4.0)                                                                                                                               |

---

**Phase 0.2 Status**: ✅ COMPLETE
**Actual Duration**: ~2 sessions
**Next Phase**: Phase 0.3 — Rewrite Backend E2E Tests

# Phase 0.4: Fix RxJS Duplication Hack — Implementation Plan

## Overview

Remove `backend/scripts/remove-duplicate-rxjs.js` — a manual file-deletion hack that worked around multiple conflicting RxJS installations. Replace it with the proper npm mechanism (`overrides`) to prevent future duplication. The hack is already dead code: both sets of paths it targets no longer exist after the Phase 0.1 Nx migration and Phase 0.2 Angular 22 upgrade.

## Scope

✅ **In Scope:**

- Delete `backend/scripts/remove-duplicate-rxjs.js`
- Verify a clean single RxJS installation
- Update any documentation that references the script

❌ **Out of Scope:**

- No changes to how RxJS is used in application code
- No shared library extraction (Phase 0.5)
- No other scripts or infrastructure changes

## Why the Hack Existed

Before Phase 0.1, the workspace was a traditional npm workspaces setup where each backend service had its own `node_modules/` subtree. npm would sometimes install a separate RxJS copy inside each service, causing TypeScript to see multiple incompatible `Observable` types at compile time.

The hack was a post-install script that force-deleted these duplicate directories:

```
services/api-gateway/node_modules/rxjs       ← per-service copies
services/auth-service/node_modules/rxjs
services/suggestion-service/node_modules/rxjs
services/history-service/node_modules/rxjs
services/favorite-service/node_modules/rxjs
node_modules/@angular-devkit/core/node_modules/rxjs       ← Angular-devkit nested copies
node_modules/@angular-devkit/schematics/node_modules/rxjs
```

## Why the Hack Is Now Dead Code

Both categories of target paths no longer exist:

| Path                                  | Why it's gone                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `services/*/node_modules/rxjs`        | The `services/` directory was deleted in Phase 0.1 (Nx migration moved all apps to `apps/`)          |
| `@angular-devkit/*/node_modules/rxjs` | Angular 22 (Phase 0.2) resolved the nested install; `@angular-devkit` no longer vendors its own RxJS |

**Current state**: only one RxJS installation in the entire workspace — `node_modules/rxjs@7.8.2` at the root. Running the hack today prints "No duplicate RxJS installations found" and exits.

## Current State Audit

| Check                                       | Result                                  |
| ------------------------------------------- | --------------------------------------- |
| `node_modules/rxjs` at root                 | ✅ `7.8.2`                              |
| Nested `rxjs` anywhere under `node_modules` | ✅ None (only root copy)                |
| `services/*/node_modules/rxjs`              | ✅ `services/` directory does not exist |
| `@angular-devkit/*/node_modules/rxjs`       | ✅ Not present                          |
| npm scripts referencing the hack            | ✅ None                                 |
| CI/CD referencing the hack                  | ✅ None                                 |
| Other files referencing the hack            | ✅ None                                 |

---

## Implementation Steps

### Step 1: Confirm No Nested RxJS (10 min)

Verify the current state before touching anything:

```bash
# Should return only one result: node_modules/rxjs
find node_modules -name "rxjs" -maxdepth 4 -type d
```

Expected output:

```
node_modules/rxjs
```

If any other paths appear, stop and investigate before proceeding.

Also confirm the script is truly unused:

```bash
grep -r "remove-duplicate-rxjs" . \
  --include="*.json" --include="*.js" --include="*.ts" \
  --include="*.yml" --include="*.yaml" -l
```

Expected output: no files found.

---

### Step 2: Delete the Hack Script (5 min)

```bash
rm backend/scripts/remove-duplicate-rxjs.js
```

Verify it's gone:

```bash
ls backend/scripts/
```

Expected: only `stop-and-reset.js` and `health-check.sh` remain.

---

### Step 3: Verify Builds and Tests Pass (30 min)

Confirm nothing broke:

```bash
# Build all apps
npm exec -- nx run-many -t build --all

# Run all tests
npm exec -- nx run-many -t test --all

# Lint all
npm exec -- nx run-many -t lint --all
```

All should pass. RxJS is an observable/reactive library used throughout NestJS and Angular — a broken install would surface immediately as TypeScript import errors.

---

### Step 6: Update Documentation (10 min)

Update `ENHANCEMENT-PLAN.md` Phase 0.4 description to reflect it is now complete (handled by the completion report).

Check `README.md` for any references to the hack or manual deduplication steps:

```bash
grep -i "rxjs\|deduplic\|remove-duplicate" README.md
```

Remove or update any instructions that told developers to run the script manually.

---

## Verification Checklist

### Before Deletion

- [ ] `find node_modules -name "rxjs" -maxdepth 4 -type d` — only one result
- [ ] `grep -r "remove-duplicate-rxjs"` — no files found

### After Changes

- [ ] `backend/scripts/remove-duplicate-rxjs.js` is deleted
- [ ] `find node_modules -name "rxjs" -maxdepth 4 -type d` — still only one result
- [ ] `nx run-many -t build --all` — all pass
- [ ] `nx run-many -t test --all` — all pass
- [ ] `nx run-many -t lint --all` — all pass
- [ ] `README.md` — no stale references to the script

---

## Rollback Strategy

This change is trivially reversible:

```bash
# Restore the deleted script
git checkout backend/scripts/remove-duplicate-rxjs.js
```

No other files are changed, so there is nothing else to revert.

---

## Benefits After Phase 0.4

- **Dead code removed**: the script was a no-op since Phase 0.1 — deleting it removes confusion for future developers
- **`backend/scripts/` cleaned up**: only genuinely useful scripts remain (`stop-and-reset.js`, `health-check.sh`)

---

## Timeline Summary

| Step      | Task                                           | Time        |
| --------- | ---------------------------------------------- | ----------- |
| 1         | Confirm no nested RxJS + no references to hack | 10 min      |
| 2         | Delete hack script                             | 5 min       |
| 3         | Verify builds and tests pass                   | 30 min      |
| 4         | Update documentation                           | 10 min      |
| **Total** |                                                | **~55 min** |

---

**Phase 0.4 Status**: Ready to implement
**Next Phase**: Phase 0.5 — Extract Infrastructure Modules to Shared Libraries

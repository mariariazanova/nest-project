# Phase 0.6: Pre-commit Hooks & CI Workflows

**Project**: Suggestify
**Phase**: 0.6 — Pre-commit Hooks (Husky + lint-staged) + CI split
**Estimate**: 0.5 day
**Depends on**: Phase 0.5 complete ✅

---

## Goal

- Auto-fix lint and formatting issues locally on every commit (fast, staged files only)
- Split GitHub Actions into two separate workflows: one for linting, one for tests

---

## Current State

- ESLint configured per project (each app/lib has its own `eslint.config.*`)
- Prettier configured at workspace root (`.prettierrc`: `singleQuote: true`, `.prettierignore` present)
- No Husky, no lint-staged, no pre-commit hooks
- Single GitHub Actions workflow (`angular-test.yml`) runs lint + test + build together
- BE e2e tests (`test/e2e/{service}/src/**/*.spec.ts`) are commented out — placeholder Nx stubs that do not match the real API; will be rewritten in Phase 4

---

## What to Install

| Package       | Purpose                                                              |
| ------------- | -------------------------------------------------------------------- |
| `husky`       | Git hook manager — installs and runs hook scripts from `.husky/`     |
| `lint-staged` | Runs linters/formatters only on git-staged files (fast, incremental) |

Both are `devDependencies`.

---

## Step 1: Install packages (5 min)

```bash
npm install --save-dev husky lint-staged
```

---

## Step 2: Initialise Husky (5 min)

Husky v9+ uses the `husky init` command which creates `.husky/` and adds a `prepare` script to `package.json`:

```bash
npx husky init
```

This creates:

- `.husky/pre-commit` (default stub)
- `"prepare": "husky"` in `package.json` scripts

The `prepare` script runs automatically on `npm install`, so all developers get hooks installed without any extra step.

---

## Step 3: Configure lint-staged (15 min)

Add to `package.json` root (alongside `scripts`):

```json
"lint-staged": {
  "*.{ts,js,html}": [
    "eslint --fix --no-error-on-unmatched-pattern",
    "prettier --write"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ]
}
```

**Notes:**

- `--fix` auto-corrects fixable lint issues and re-stages the result
- `--no-error-on-unmatched-pattern` prevents errors when a file type has no matching lint config
- Prettier runs after ESLint so formatting is always normalised last
- Only staged files are processed — a 200-file change only lints what you touched
- Runs in ~1–3 seconds for typical commits

---

## Step 4: Pre-commit hook — lint + format staged files (5 min)

Replace the default `.husky/pre-commit` with:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

No pre-push hook — tests are handled entirely by GitHub Actions.

---

## Step 5: Split GitHub Actions into two workflows (30 min)

Replace the single `angular-test.yml` with two focused workflows:

### `.github/workflows/lint.yml` — runs on every push/PR

```yaml
name: Lint

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - run: npm ci

      - uses: nrwl/nx-set-shas@v4

      - name: Cache Nx
        uses: actions/cache@v3
        with:
          path: .nx/cache
          key: nx-${{ runner.os }}-${{ github.sha }}
          restore-keys: nx-${{ runner.os }}-

      - name: Lint affected
        run: npx nx affected --target=lint --parallel=3
```

### `.github/workflows/test.yml` — runs on every push/PR

```yaml
name: Frontend + Backend Tests

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - run: npm ci

      - uses: nrwl/nx-set-shas@v4

      - name: Cache Nx
        uses: actions/cache@v3
        with:
          path: .nx/cache
          key: nx-${{ runner.os }}-${{ github.sha }}
          restore-keys: nx-${{ runner.os }}-

      - name: Test affected
        run: npx nx affected --target=test --parallel=3

      - name: Upload frontend coverage
        if: success()
        uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage
          path: coverage/apps/frontend
```

`angular-test.yml` is deleted.

---

## Step 6: Verify (30 min)

```bash
# Trigger pre-commit manually
npx lint-staged

# Make a commit and confirm hook fires
git add .
git commit -m "test: verify hooks"
```

Push to GitHub and confirm both `Lint` and `Frontend + Backend Tests` checks appear on the PR.

---

## File Changes Summary

| File                                       | Change                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `package.json`                             | Add `"prepare": "husky"` to scripts; add `"lint-staged": {...}` config |
| `.husky/pre-commit`                        | `npx lint-staged`                                                      |
| `.github/workflows/lint.yml`               | New — lint-only workflow                                               |
| `.github/workflows/test.yml`               | New — test-only workflow                                               |
| `.github/workflows/angular-test.yml`       | Deleted                                                                |
| `test/e2e/*/src/**/*.spec.ts` (5 BE files) | Already commented out ✅                                               |

---

## Out of Scope

- Commit message linting (commitlint) — can be added in a later phase
- E2e tests in CI — excluded until Phase 4 rewrites them
- Coverage threshold enforcement — Phase 4 (SonarQube / Jest thresholds)
- Build step in CI — removed; TypeScript errors are caught by unit tests and local builds

---

## E2E Test Status

All 5 BE e2e spec files have been commented out (Nx scaffolding stubs, wrong API contract). Will be rewritten in Phase 4 using Playwright + real test scenarios. The frontend Playwright e2e (`test/e2e/frontend/`) is unaffected — not triggered by `nx affected --target=test`.

---

**Estimate**: 90 min core (step 1–6) + buffer for CI/environment issues → 0.5 day (1 developer)
**Next Phase**: Phase 1.1 — Database Migrations

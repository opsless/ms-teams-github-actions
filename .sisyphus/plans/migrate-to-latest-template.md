# Migration Plan: Align with Latest `actions/typescript-action` Template

**Target**: `actions/typescript-action` @ commit `57b9acc` (latest main)
**Strategy**: Staged PRs — each PR is independently verifiable **Scope**: Full
template parity (core toolchain + ancillary tooling)

---

## Decisions Locked

- **Action contract**: Preserve inputs (`github-token`, `webhook-uri`), card
  payload, failure behavior exactly. Only fix listed bugs.
- **Sleep(5000)**: Replace with polling + configurable timeout.
- **Webhook retry**: No retry for Teams POST. Only retry GitHub API reads.
- **Template scope**: Full parity — CodeQL, licensed, super-linter, dependabot,
  devcontainer, `.node-version`, etc.

---

## PR 1: Toolchain Migration (ESM + Rollup + ESLint Flat Config + Jest 30)

**Goal**: Modernize build/test/lint toolchain to match template. Zero behavior
changes.

### Changes

1. **`package.json`**
   - Add `"type": "module"`
   - Add `"exports": { ".": "./dist/index.js" }`
   - Add `"engines": { "node": ">=24.0.0" }`
   - Replace `@vercel/ncc` with `rollup` + plugins (`@rollup/plugin-commonjs`,
     `@rollup/plugin-node-resolve`, `@rollup/plugin-typescript`)
   - Upgrade dev deps: `typescript@^5.9.3`, `eslint@^10.0.0`, `jest@^30.2.0`,
     `ts-jest@^29.4.6`, `prettier@^3.8.1`, `@types/node@^25.2.3`,
     `@types/jest@^30.0.0`
   - Add: `@eslint/compat`, `@eslint/eslintrc`, `@eslint/js`,
     `@typescript-eslint/eslint-plugin@^8.56.0`,
     `eslint-config-prettier@^10.1.8`, `ts-jest-resolver@^2.0.1`,
     `@jest/globals@^30.2.0`, `make-coverage-badge@^1.2.0`, `rimraf`
   - Remove: `@vercel/ncc`, `eslint-plugin-github` (replaced by flat config),
     `@typescript-eslint/parser` (now via plugin)
   - Update scripts to match template (`bundle`, `ci-test`, `package`, `test`
     with `--experimental-vm-modules`)

2. **`tsconfig.json`**
   - `target`: `"ES2022"`, `module`: `"NodeNext"`, `moduleResolution`:
     `"NodeNext"`
   - Add: `allowSyntheticDefaultImports`, `declaration: false`,
     `declarationMap: false`, `forceConsistentCasingInFileNames`,
     `isolatedModules`, `lib: ["ES2022"]`, `newLine: "lf"`,
     `noUnusedLocals: true`, `pretty: true`, `resolveJsonModule: true`,
     `strictNullChecks: true`
   - Update `exclude`:
     `["__fixtures__", "__tests__", "coverage", "dist", "node_modules"]`
   - Update `include`: `["src"]`

3. **`eslint.config.mjs`** (new — replaces `.eslintrc.json`)
   - Flat config following template pattern
   - Delete `.eslintrc.json`

4. **`.prettierrc.yml`** (new — replaces `.prettierrc.json`)
   - Match template values: `bracketSpacing: true`, `bracketSameLine: true`,
     `arrowParens: always`, `proseWrap: always`, `endOfLine: lf`
   - Delete `.prettierrc.json`

5. **`jest.config.js`**
   - Rewrite as ESM export (`export default { ... }`)
   - Add: `extensionsToTreatAsEsm`, `resolver: 'ts-jest-resolver'`,
     `collectCoverage: true`, `collectCoverageFrom`, `coverageDirectory`,
     `coverageReporters`
   - Transform: `ts-jest` with `useESM: true`

6. **`rollup.config.ts`** (new)
   - Input: `src/index.ts`, output: `dist/index.js` (ESM, sourcemaps)
   - Plugins: typescript, nodeResolve, commonjs

7. **Source files — ESM migration**
   - Create `src/index.ts`:
     ```ts
     import { run } from './main.js'
     /* istanbul ignore next */
     run()
     ```
   - Refactor `src/main.ts`:
     - Export `run()` instead of top-level call
     - Add `.js` extensions to all relative imports (required by NodeNext)
     - Keep all logic identical — no behavior changes

8. **`action.yml`**
   - Update `main:` from `dist/main/index.js` → `dist/index.js`

9. **`.gitignore`**
   - Update `lib/**/*` → remove (no longer using tsc output dir)
   - Ensure `dist/` is NOT ignored (must be committed)

10. **`.gitattributes`**
    - Add: `* text=auto eol=lf`
    - Add: `dist/** linguist-generated=true`

11. **Delete obsolete files**: `.eslintrc.json`, `.prettierrc.json`,
    `.eslintignore`, `.prettierignore` (replaced by new config)

### Acceptance Criteria

- [ ] `npm ci` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run format:check` exits 0
- [ ] `npm test` exits 0 (even if 0 tests exist yet)
- [ ] `npm run package` produces `dist/index.js`
- [ ] Action behavior is identical to pre-migration

---

## PR 2: Module Extraction + Bug Fixes

**Goal**: Split `main.ts` into testable modules. Fix all identified bugs.

### Module Structure

```
src/
  index.ts          # entrypoint (from PR 1)
  main.ts           # orchestration only
  config.ts         # input validation, secret masking
  types.ts          # string unions for Conclusion, StepStatus, TextBlockColor
  github-client.ts  # Octokit: workflow run, jobs (with pagination), polling
  teams-client.ts   # webhook POST (no retry), timeout, response handling
  card.ts           # Adaptive Card data assembly
  template.ts       # raw Adaptive Card template (typo fixed: temlpateData → templateData)
```

### Bug Fixes

1. **Numeric enums → string unions** (`types.ts`)

   ```ts
   export type Conclusion =
     | 'success'
     | 'failure'
     | 'neutral'
     | 'cancelled'
     | 'skipped'
     | 'timed_out'
     | 'action_required'

   export type StepStatus = 'queued' | 'in_progress' | 'completed'

   export type TextBlockColor = 'good' | 'attention' | 'warning'
   ```

2. **Remove duplicate `TIMED_OUT` check** in failed-step detection

3. **Add Octokit pagination** for `listJobsForWorkflowRun`

4. **Replace `sleep(5000)` with polling** (`github-client.ts`)
   - Poll GitHub API until jobs are available (or timeout)
   - Configurable max wait (default 30s) and interval (default 2s)

5. **Handle `null` conclusions** — treat as `'unknown'` / map to FAILED

6. **Mask secrets immediately** (`config.ts`)

   ```ts
   const webhookUri = core.getInput('webhook-uri', { required: true })
   core.setSecret(webhookUri)
   const token = core.getInput('github-token', { required: true })
   core.setSecret(token)
   ```

7. **Validate webhook URL scheme** — must be `https:`

8. **Fix `error: any`** → `error: unknown` with type guard

9. **Fix typo**: `temlpateData` → `templateData`

10. **Improve error handling** in webhook response parsing

### Acceptance Criteria

**Tooling gates (must pass):**

- [ ] `npm ci` exits 0 (after dep changes)
- [ ] `npm run lint` exits 0
- [ ] `npm run format:check` exits 0
- [ ] `npm run package` exits 0 and produces `dist/index.js`
- [ ] `npm test` exits 0 (even with 0 tests)

**Per-bug-fix QA (executable verification):**

| #   | Bug Fix                       | QA Command / Verification                                                                                                                                   | Expected Result                                                              |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Numeric enums → string unions | `grep -rn "enum Conclusions\|enum StepStatus" src/` returns nothing; `grep -rn "type Conclusion\|type StepStatus" src/types.ts` returns the new union types | No numeric enums exist; types are string unions                              |
| 2   | Remove duplicate TIMED_OUT    | `grep -c "timed_out" src/github-client.ts`                                                                                                                  | Returns exactly 1 (not 2)                                                    |
| 3   | Octokit pagination            | `grep -rn "paginate" src/github-client.ts`                                                                                                                  | Uses `octokit.paginate()` instead of single `.listJobsForWorkflowRun()` call |
| 4   | Polling replaces sleep(5000)  | `grep -rn "sleep\|setTimeout" src/` returns nothing in github-client.ts; `grep -rn "poll\|waitFor" src/github-client.ts` returns polling logic              | No sleep/setTimeout in github-client; polling function exists                |
| 5   | Null conclusion handled       | `grep -rn "null" src/card.ts` or read `card.ts` — null conclusion maps to explicit `'unknown'` display + attention color                                    | No crash on null; maps to FAILED/attention                                   |
| 6   | Secrets masked                | `grep -n "setSecret" src/config.ts`                                                                                                                         | Both webhook-uri and github-token call `core.setSecret()`                    |
| 7   | Webhook URL validation        | `grep -n "https" src/config.ts`                                                                                                                             | URL scheme validation rejects non-https                                      |
| 8   | error: any removed            | `grep -rn "error: any" src/` returns nothing                                                                                                                | All catch blocks use `error: unknown` with type guard                        |
| 9   | Typo fixed                    | `grep -rn "temlpateData" src/` returns nothing; `grep -rn "templateData" src/template.ts` returns the correct variable                                      | No typo; variable is `templateData`                                          |
| 10  | Webhook error handling        | Read `src/teams-client.ts` — response parsing uses try/catch with `core.warning()` for non-JSON                                                             | Graceful handling of empty/non-JSON responses                                |

**Behavioral contract:**

- [ ] `action.yml` inputs unchanged: `github-token` (required), `webhook-uri`
      (required)
- [ ] Adaptive Card payload structure identical (same TextBlocks, FactSet,
      ColumnSet layout)
- [ ] `action.yml` main path updated to `dist/index.js`

---

## PR 3: Unit Tests + Fixtures

**Goal**: Comprehensive test coverage following template patterns.

### Structure

```
__fixtures__/
  core.ts           # mock for @actions/core
  github.ts         # mock for @actions/github
  octokit.ts        # mock Octokit responses
  fetch.ts          # mock global fetch
__tests__/
  main.test.ts      # integration: full run() with mocks
  config.test.ts    # input validation, secret masking
  types.test.ts     # conclusion mapping, color mapping
  github-client.test.ts  # pagination, polling, job detection
  teams-client.test.ts   # webhook POST, timeout, error handling
  card.test.ts      # card assembly, template rendering
```

### Test Cases

**`config.test.ts`**

- Missing webhook-uri throws
- Missing github-token throws
- Non-https webhook URI throws
- Secrets are masked via setSecret
- Valid inputs pass through

**`types.test.ts`**

- All conclusion strings map to correct display text
  (SUCCEEDED/FAILED/CANCELLED)
- All conclusions map to correct colors (good/attention/warning)
- Null conclusion handled
- Unknown conclusion defaults to FAILED/attention

**`github-client.test.ts`**

- Pagination: 150 jobs → all returned (2 pages)
- Failed step detection: finds first failed step
- Failed step detection: no failures → returns last completed step
- Duplicate TIMED_OUT not present
- Polling: jobs not ready immediately → retries until available
- Polling: timeout after max wait → throws clear error

**`teams-client.test.ts`**

- Successful POST returns response data
- Non-2xx response throws with status and body
- Timeout via AbortController works
- Empty response handled gracefully
- Non-JSON response handled gracefully
- No retry on failure (single attempt)

**`card.test.ts`**

- Card contains all required fields
- PR event maps to "Pull request" type
- Push event maps to "Branch" type
- Commit message truncated to first line
- All template variables resolved

**`main.test.ts`**

- Happy path: run completes without error
- Missing webhook: run sets failed
- GitHub API error: run sets failed
- Teams webhook error: run sets failed

### Acceptance Criteria

- [ ] `npm test` exits 0
- [ ] Coverage collected for `src/**`
- [ ] All test cases above pass
- [ ] No real network calls in tests (all mocked)

---

## PR 4: CI/CD Workflows + Dependency Cleanup

**Goal**: Full template CI parity + remove unused deps.

### New/Updated Workflows

1. **`.github/workflows/ci.yml`** (replace `test.yml`)
   - Job `test-typescript`: checkout → setup-node (from `.node-version`) → npm
     ci → format:check → lint → ci-test
   - Job `test-action`: checkout → use action with mock webhook (local HTTP
     server or skip if no secret)
   - Uses `actions/checkout@v6`, `actions/setup-node@v6`

2. **`.github/workflows/check-dist.yml`** (new)
   - Remove `dist/`, run `npm run bundle`, `git diff --exit-code`
   - Upload expected dist/ as artifact on failure

3. **`.github/workflows/codeql-analysis.yml`** (new)
   - Weekly + on PRs/pushes to main
   - `github/codeql-action@v4`, source-root: `src`

4. **`.github/workflows/linter.yml`** (new)
   - `super-linter/super-linter/slim@v8`
   - Disable: BIOME, JSCPD, JS/TS ESLint (uses own), JSON, zizmor

5. **`.github/workflows/licensed.yml`** (new)
   - `workflow_dispatch` only
   - Licensed 4.x via Ruby

6. **`.github/dependabot.yml`** (replace `renovate.json` +
   `.github/renovate.json`)
   - Weekly: github-actions (grouped minor/patch), npm (grouped dev/prod)

7. Delete: `renovate.json`, `.github/renovate.json`

### Config Files

8. **`.node-version`** — `24.4.0`
9. **`.checkov.yml`** — skip coverage/, node_modules/
10. **`.markdown-lint.yml`** — MD004, MD013 (tables exempt), MD029, MD030, MD046
11. **`.yaml-lint.yml`** — max 80 chars warning, ignores .licenses/
12. **`.licensed.yml`** — allow Apache-2.0, BSD, ISC, MIT, CC0-1.0
13. **`actionlint.yml`** — ignore `"invalid runner name 'node24'"`
14. **`.prettierignore`** — `.DS_Store`, `.licenses/`, `dist/`, `node_modules/`,
    `coverage/`
15. **`.env.example`** — `ACTIONS_STEP_DEBUG`, input env vars

### Dependency Cleanup

16. **Remove unused**:
    - `cockatiel` — was for retries; we're NOT retrying webhook, and GitHub
      reads can use simple retry without it
    - `adaptive-expressions` — not imported, likely transitive
    - `adaptivecards` — not directly imported, likely transitive

    **⚠️ Verify first**: Run `npm ls adaptive-expressions adaptivecards` to
    confirm they're transitive deps of `adaptivecards-templating`. If so, remove
    from direct deps.

17. **Keep**:
    - `adaptivecards-templating` — directly used for template expansion
    - `@actions/core` — upgrade to `^3.0.0` (ESM-compatible)
    - `@actions/github` — keep at `^6.0.0` (check if v7 exists)

### Acceptance Criteria

**Per-workflow QA (executable on PR):**

| #   | Workflow              | QA Verification                                                              | Expected Result                                                                                              |
| --- | --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `ci.yml`              | Push PR → check GitHub Actions tab                                           | Job `test-typescript` passes (format:check, lint, ci-test all green). Job `test-action` runs (mock or skip). |
| 2   | `check-dist.yml`      | `npm run package && git diff --exit-code dist/` locally; also triggers on PR | Exits 0 if dist/ is fresh. Fails + uploads artifact if stale.                                                |
| 3   | `codeql-analysis.yml` | Check workflow trigger config                                                | Triggers on PR to main + weekly schedule. Uses `github/codeql-action@v4`.                                    |
| 4   | `linter.yml`          | Check workflow config                                                        | Uses `super-linter/super-linter/slim@v8`. Disables conflicting linters.                                      |
| 5   | `licensed.yml`        | Check workflow config                                                        | `workflow_dispatch` only. Uses Licensed 4.x.                                                                 |
| 6   | `dependabot.yml`      | `cat .github/dependabot.yml`                                                 | Weekly schedule for github-actions + npm. Grouped updates. `renovate.json` files deleted.                    |
| 7   | Deleted files         | `ls renovate.json .github/renovate.json`                                     | Both return "not found" / error.                                                                             |

**Per-config-file QA:**

| #   | Config               | QA Verification          | Expected Result                                                         |
| --- | -------------------- | ------------------------ | ----------------------------------------------------------------------- |
| 8   | `.node-version`      | `cat .node-version`      | Contains `24.4.0`. Matches `action.yml` `using: node24`.                |
| 9   | `.checkov.yml`       | `cat .checkov.yml`       | Skips `coverage/`, `node_modules/`.                                     |
| 10  | `.markdown-lint.yml` | `cat .markdown-lint.yml` | MD004, MD013 (tables exempt), MD029, MD030, MD046 configured.           |
| 11  | `.yaml-lint.yml`     | `cat .yaml-lint.yml`     | max 80 chars warning, ignores `.licenses/`.                             |
| 12  | `.licensed.yml`      | `cat .licensed.yml`      | Allows Apache-2.0, BSD, ISC, MIT, CC0-1.0.                              |
| 13  | `actionlint.yml`     | `cat actionlint.yml`     | Ignores `"invalid runner name 'node24'"`.                               |
| 14  | `.prettierignore`    | `cat .prettierignore`    | Lists `.DS_Store`, `.licenses/`, `dist/`, `node_modules/`, `coverage/`. |
| 15  | `.env.example`       | `cat .env.example`       | Contains `ACTIONS_STEP_DEBUG` and input env var examples.               |

**Dependency cleanup QA:**

- [ ] `npm ls cockatiel adaptive-expressions adaptivecards 2>&1` — all return
      "not found" or "extraneous" (removed from direct deps)
- [ ] `npm ls adaptivecards-templating` — still present as direct dep
- [ ] `npm ci` exits 0 after removal
- [ ] `npm run package` exits 0 after removal (transitive deps still resolved)
- [ ] `package.json` no longer lists `cockatiel`, `adaptive-expressions`,
      `adaptivecards` in `dependencies`

---

## PR 5: Docs + Final Polish

**Goal**: Update docs, add devcontainer, final cleanup.

### Changes

1. **`README.md`** — Update usage examples, note v2 breaking changes if any
2. **`CHANGELOG.md`** — Add entry for v2.1.0 (or appropriate version)
3. **`.devcontainer/devcontainer.json`** (new) — from template
4. **`.vscode/`** configs (new) — `extensions.json`, `launch.json`,
   `settings.json`
5. **`.github/copilot-instructions.md`** (new) — from template
6. **`.github/prompts/`** (new) — `create-release-notes.prompt.md`,
   `unit-test.prompt.md`
7. **`script/release`** (new) — release helper from template

### Acceptance Criteria

**Per-change QA:**

| #   | Change                            | QA Verification                                                        | Expected Result                                                                                                          |
| --- | --------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `README.md`                       | `grep -c "webhook-uri" README.md` + `grep -c "github-token" README.md` | Both inputs documented. Usage example uses `actions/checkout@v4` and current action path. No references to removed deps. |
| 2   | `CHANGELOG.md`                    | `head -20 CHANGELOG.md`                                                | New entry for current version lists: ESM migration, rollup bundler, bug fixes, new CI workflows.                         |
| 3   | `.devcontainer/devcontainer.json` | `cat .devcontainer/devcontainer.json`                                  | Valid JSON. References Node 24 image or feature. `postCreateCommand` runs `npm ci`.                                      |
| 4   | `.vscode/extensions.json`         | `cat .vscode/extensions.json`                                          | Recommends: ESLint, Prettier, Jest. Valid JSON.                                                                          |
| 5   | `.vscode/launch.json`             | `cat .vscode/launch.json`                                              | Has config for running Jest tests and/or local action.                                                                   |
| 6   | `.vscode/settings.json`           | `cat .vscode/settings.json`                                            | Sets formatter to Prettier, lint on save.                                                                                |
| 7   | `.github/copilot-instructions.md` | `cat .github/copilot-instructions.md`                                  | Non-empty, contains project-specific guidance.                                                                           |
| 8   | `.github/prompts/*.md`            | `ls .github/prompts/`                                                  | Contains `create-release-notes.prompt.md` and `unit-test.prompt.md`.                                                     |
| 9   | `script/release`                  | `ls script/release` + `bash -n script/release`                         | File exists. Syntax check passes (exit 0).                                                                               |

**Final sanity:**

- [ ] `npm run all` exits 0 (format + lint + test + coverage + package)
- [ ] `npm run package && git diff --exit-code dist/` — dist/ is fresh
- [ ] No dead files:
      `ls .eslintrc.json .prettierrc.json renovate.json .github/renovate.json` —
      all return "not found"

---

## Out of Scope

- Redesigning Teams card visual/content
- Adding new action inputs or features
- Supporting non-Teams destinations
- Real Teams E2E tests in CI
- Changing package manager (staying with npm)
- Maintaining Node 18/20/22 compatibility

---

## Risk Mitigations

| Risk                               | Mitigation                                     |
| ---------------------------------- | ---------------------------------------------- |
| ESM migration breaks imports       | PR 1 verifies tsc + rollup before any refactor |
| `.js` extension missing in imports | `NodeNext` catches this at compile time        |
| Stale dist/ committed              | `check-dist.yml` catches drift                 |
| Teams duplicate notifications      | No webhook retry — single attempt only         |
| Over-broad modularization          | Strict module list, no architecture redesign   |
| CI requires real secrets           | test-action uses mock or skips gracefully      |
| `@actions/core@v3` ESM-only        | Upgraded in PR 1 alongside ESM migration       |

---

## Estimated Effort

| PR                   | Scope                                        | Est. Time  |
| -------------------- | -------------------------------------------- | ---------- |
| PR 1: Toolchain      | Package configs, ESM migration, bundler swap | 2-3h       |
| PR 2: Modules + Bugs | 7 files, 10 bug fixes                        | 2-3h       |
| PR 3: Tests          | 6 test files, ~25 test cases                 | 2-3h       |
| PR 4: CI + Deps      | 7 workflows, dep cleanup                     | 1-2h       |
| PR 5: Docs + Polish  | README, devcontainer, misc                   | 30min-1h   |
| **Total**            |                                              | **~8-12h** |

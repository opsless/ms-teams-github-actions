# CHANGELOG

## 2.1.0

- feat: migrate to ES modules (type: module)
- feat: replace @vercel/ncc with rollup build system
- feat: update to latest dev dependencies matching official TypeScript action template
- feat: update ESLint to v9 with flat config (eslint.config.mjs)
- feat: update Jest to v30 with ES modules support
- feat: update TypeScript to latest version
- feat: replace old test workflow with new CI workflow based on official template
- feat: update action.yml to use new build output (dist/index.js)
- feat: add .node-version file for CI
- feat: ignore dist directory in git and build tools
- fix: update CI workflow to include build step for test-action job
- fix: update Jest configuration to pass with no tests and use correct tsconfig
- fix: resolve linting issues and improve error handling
- fix: update dependencies to latest compatible versions
- fix: update rollup.config.ts to match official TypeScript action template
- fix: add external dependencies to prevent bundling issues
- fix: ensure proper ES module build with correct input file path

## 2.0.0

- feat: upgrade to Node.js 24

## 1.1.3

- fix: update `actions/checkout` step to `v4`
- fix: actualize `CHANGELOG.md`

## 1.1.1

- fix: increase timeout to 30 seconds

## 1.1.0

- feat: update dependencies

## 1.0.0

- feat: update action to use NodeJS 20

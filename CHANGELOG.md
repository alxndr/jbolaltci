# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- The web app now renders lensisku's `$x_1$`-style place-structure placeholders (inconsistently written as `$x_1$` or `$x_{1}$` depending on the entry) as a formatted "*x*₁" instead of showing the raw markup.
- `ci.yml`'s `e2e` job now caches `node_modules` (keyed on the Playwright image tag + `package-lock.json`), skipping both the `apt-get install` of build tools and `npm ci`'s native compile step on unchanged dependencies. `better-sqlite3` ships prebuilt binaries, but `npm ci` was still forcing a `node-gyp rebuild` regardless of that (confirmed by running the exact CI image locally without the build tools installed -- it doesn't check for a matching prebuild before trying to compile), which is what made that install step take ~3 minutes on every run.

## [0.2.0-rc.1] - 2026-08-15

### Changed

- `publish.yml` now waits for `ci.yml` to complete successfully on the exact commit being tagged before publishing, instead of assuming it already did. A tag push and the push-to-`main` that usually precedes it are separate, unordered GitHub events, so nothing previously stopped a release from going out for a commit whose CI run (including the Playwright e2e suite and the Pages deploy it gates) hadn't finished, failed, or never ran at all.

## [0.2.0-rc.0] - 2026-08-15

### Fixed

- `package.json` was missing a `repository` field. npm's provenance verification cross-checks the Sigstore attestation's repo URL against this field, so the first automated Trusted Publishing run (via `publish.yml`) failed with a 422 until it was added.

## [0.2.0-alpha] - 2026-08-15

First published release.

### Added

- Initial library: parses Lojban text with the [camxes](https://github.com/lojban/ilmentufa) grammar and looks up each word's meaning via [lensisku](https://lensisku.lojban.org)'s dictionary API, with a cache-first/live-fallback design (`SqliteDictionaryCache` on Node).
- `decomposeLujvo()`: breaks a lujvo down into its rafsi and source gismu, ported from [latkerlo/latkerlo-jvotci](https://github.com/latkerlo/latkerlo-jvotci).
- `analyze()` now decomposes lujvo terms that have no dictionary entry of their own, surfacing each component gismu's real definitions instead of a generic "no dictionary entry" result.
- A basic web interface, later rebuilt to run entirely client-side (see Changed).
- GitHub Actions CI: typecheck, unit tests (vitest), and end-to-end tests (Playwright, against a real browser and the real lensisku API) on every push/PR, split across jobs so the Playwright job runs in a prebuilt container image instead of downloading browsers each run.
- GitHub Pages deployment: the web app now publishes automatically on push to `main`, live at [alxndr.github.io/jbolaltci](https://alxndr.github.io/jbolaltci/).
- `docs/architecture-decisions/`: adopted the ADR practice from [alxndr/sparse-boolean-codec](https://github.com/alxndr/sparse-boolean-codec), starting with the decision to use an in-memory cache for the client-side build rather than IndexedDB or sql.js (ADR 001).
- `CHANGELOG.md`, `PUBLISHING.md`, and a tag-triggered `publish.yml` using npm Trusted Publishing (OIDC) for future releases (ADR 002).

### Changed

- Project renamed from `jboski-update` to `jbolaltci` (jbo + lanli + tutci — "Lojban-analysis tool").
- Web app rebuilt to run entirely client-side, no server at all, so it could be hosted on GitHub Pages. `analyze()`/`decomposeLujvo()` now call lensisku's API directly from the browser. The library split into a Node entry point (`src/index.ts`, public API unchanged) and a browser entry point (`src/browser.ts`), sharing a portable `analyzeCore.ts`.

### Fixed

- `LensiskuClient` now binds `fetch` to `globalThis`. A browser's native `fetch` throws `"Illegal invocation"` when called with an unbound reference; Node's `fetch` silently tolerated the same code.
- `web/build.mjs` was printing `http://undefined:3100` for local dev — esbuild's `serve()` resolves with `{ hosts: string[] }`, not a singular `host`.

[Unreleased]: https://github.com/alxndr/jbolaltci/compare/v0.2.0-rc.1...HEAD
[0.2.0-rc.1]: https://github.com/alxndr/jbolaltci/compare/v0.2.0-rc.0...v0.2.0-rc.1
[0.2.0-rc.0]: https://github.com/alxndr/jbolaltci/compare/v0.2.0-alpha...v0.2.0-rc.0
[0.2.0-alpha]: https://github.com/alxndr/jbolaltci/releases/tag/v0.2.0-alpha

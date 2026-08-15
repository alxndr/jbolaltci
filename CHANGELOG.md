# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

[0.2.0-alpha]: https://github.com/alxndr/jbolaltci/releases/tag/v0.2.0-alpha

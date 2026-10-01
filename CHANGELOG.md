# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]


## [0.2.0-rc.2] - 2026-10-01

### Added

- Linting via [Biome](https://biomejs.dev), with the `recommended` rule preset, wired into CI ahead of the typechecks (`npm run lint`, `npm run lint:fix`). The formatter is deliberately left off, so this adds no reformatting churn; the rationale for the tool choice, and for the reasons the formatter and import-organizing are off for now, are in [ADR 004](./docs/architecture-decisions/004-lint-with-biome-defer-formatting.md).
- `analyze()` now falls back to [`camxes-exp`](https://github.com/lojban/ilmentufa) (vendored alongside the canonical grammar) when standard parsing rejects input, so words lensisku tags `"experimental cmavo"` (e.g. `ue'i`) are recognized instead of failing outright. Since `camxes-exp` carries real grammar changes beyond vocabulary, not just additional words, a fallback result is flagged via `AnalyzeResult.usedExperimentalGrammar` rather than presented as an ordinary parse -- the web UI shows a notice when it's used. See [ADR 003](./docs/architecture-decisions/003-experimental-cmavo-via-camxes-exp-fallback.md).
- The web app now checks lensisku's reachability once on page load (a real lookup of `coi`, the same endpoint every other lookup already depends on) and shows a notice if it doesn't respond -- advisory only, it doesn't block the form. lensisku does have a dedicated `/health` endpoint, but it lacks the CORS headers the `/api/*` routes have, so it isn't reachable from the browser build at all.
- Each word (and each lujvo's decomposed component gismu) with a real dictionary entry now links to that entry on lensisku (`https://lensisku.lojban.org/en/valsi/<word>`), opening in a new tab. Words with no entry of their own -- undocumented names, an undocumented lujvo's own word (its components link individually instead) -- stay plain text, since linking them would 404.
- A "Nesting" section under the results table shows how a sentence's words group together grammatically -- nested, colored boxes (in the style of ilmentufa's own "Boxes" glosser view), each level captioned `sumti`/`selbri`/`sentence`/`prenex` where camxes assigned one. New `parseLabeledTree()`/`parseLabeledTreeExperimental()` (mode `"CTJN"` on the same vendored `camxes_postproc.js` `parseTrimmed()` already uses) keep those grammatical-role wrapper nodes that the plain parse trims away. See [ADR 005](./docs/architecture-decisions/005-nesting-visualization-via-postproc-node-labels.md).
- `analyze()` gains an opt-in third parse tier, `allowWordListFallback` (the web app turns it on): when neither camxes grammar can parse the text at all, it's split into words, each tried against the real grammar on its own first (so e.g. `u'isai`, a compound of `u'i` + `sai` written without a space, still splits correctly even if some *other* word broke the full-sentence parse), falling back to a raw lensisku lookup only for words neither grammar recognizes standalone either. Shows whatever real dictionary entries and lujvo decompositions it finds (best-effort -- an unresolved word just shows "no dictionary entry" rather than failing the whole result) instead of hiding everything behind a syntax error. This is what makes a standalone word like `a'oi` ("ahoy", a piratical vocative greeting) show its real definition even though neither vendored grammar's hardcoded cmavo list happens to include it. Flagged via `AnalyzeResult.usedWordListFallback`, with its own web UI notice distinct from the experimental-grammar one. See [ADR 006](./docs/architecture-decisions/006-word-list-fallback-for-text-neither-grammar-parses.md).

### Changed

- The web app now renders lensisku's `$x_1$`-style place-structure placeholders (inconsistently written as `$x_1$` or `$x_{1}$` depending on the entry) as a formatted "*x*₁" instead of showing the raw markup.
- `ci.yml`'s `e2e` job now caches `node_modules` (keyed on the Playwright image tag + `package-lock.json`), skipping both the `apt-get install` of build tools and `npm ci`'s native compile step on unchanged dependencies. `better-sqlite3` ships prebuilt binaries, but `npm ci` was still forcing a `node-gyp rebuild` regardless of that (confirmed by running the exact CI image locally without the build tools installed -- it doesn't check for a matching prebuild before trying to compile), which is what made that install step take ~3 minutes on every run.
- `npm run dev:web` now actually hot-reloads: esbuild's watcher was already rebuilding `main.js` correctly on every save (confirmed directly -- this was never actually broken), but nothing told the open browser tab about it, so it kept showing whatever was loaded at page-load time until manually refreshed. `web/index.html` now gets a small live-reload script injected (in `--watch` mode only, never in the production build) that listens on esbuild's own `/esbuild` SSE endpoint and reloads on each rebuild. That covered `main.ts` and everything under `src/` it bundles, but `web/style.css`, `web/index.html`, `web/about.html`, and the vendored `camxes*.js` grammar files are only ever copied into `web/dist/` once at startup, never part of that bundle -- `web/build.mjs` now also watches those files directly and, on change, recopies them and calls esbuild's `ctx.rebuild()`, which fires that same `/esbuild` event even though nothing esbuild bundles actually changed.

### Fixed

- `analyzeCore()` destructured `parseTrimmed` off its dependencies object without ever using the local binding; parsing actually goes through `parseWithFallback()`, which reads it off the dependencies object itself.

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

[Unreleased]: https://github.com/alxndr/jbolaltci/compare/v0.2.0-rc.2...HEAD
[0.2.0-rc.2]: https://github.com/alxndr/jbolaltci/compare/v0.2.0-rc.1...v0.2.0-rc.2
[0.2.0-rc.1]: https://github.com/alxndr/jbolaltci/compare/v0.2.0-rc.0...v0.2.0-rc.1
[0.2.0-rc.0]: https://github.com/alxndr/jbolaltci/compare/v0.2.0-alpha...v0.2.0-rc.0
[0.2.0-alpha]: https://github.com/alxndr/jbolaltci/releases/tag/v0.2.0-alpha

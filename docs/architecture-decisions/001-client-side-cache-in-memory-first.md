# 001 — in-memory cache first for the client-side build, not IndexedDB or sql.js

**Date:** 2026-08-15

**Status:** Implemented


### Context

The web app is being ported to run entirely client-side (browser), for hosting on GitHub Pages, replacing the current Express-backed server as the only way to run the app rather than keeping both. `analyze()`'s dictionary lookups go through a `DictionaryCache` interface (`src/cache/cache.ts`) rather than a hardcoded store specifically so the backing implementation can be swapped without touching `analyze()` itself; the Node version uses `better-sqlite3` (`SqliteDictionaryCache`), which is a native addon and cannot run in a browser at all. A replacement was needed for the client-side build.

Three options were considered:

* **sql.js** (SQLite compiled to WebAssembly) -- rejected after actually checking the package rather than assuming: the production WASM binary alone is ~644KB plus ~45KB of JS glue, and, more importantly, sql.js is an *in-memory* SQLite engine with no built-in persistence. Using it would still require manually calling `db.export()` and storing the resulting blob in IndexedDB (or triggering a download) to survive a page reload -- it doesn't replace IndexedDB, it adds a SQL query layer on top of a blob IndexedDB would still have to store underneath. `DictionaryCache` is two operations (`get`/`set` by word, no joins, no queries), so there's no relational-query benefit to justify that weight.
* **IndexedDB** -- would give true persistence across page reloads/days. But `DictionaryCache`'s methods are currently synchronous (`getValsi(word): Valsi | null | undefined`, matching `better-sqlite3`'s sync API), and IndexedDB's API is fundamentally asynchronous. Adopting it now would mean changing the interface itself to return `Promise`s, touching `analyze.ts`'s lookup logic, every existing cache implementation, and every test fake that implements `DictionaryCache` -- a second interface-shaped change layered on top of an already-substantial port (export-surface split so browser bundles don't pull in Node built-ins, loading camxes via classic `<script>` globals instead of `createRequire`, a bundler, relative-path Pages asset handling, a deploy workflow).
* **In-memory `Map`** -- synchronous (no interface change needed at all), zero new dependency, persists only for the lifetime of the page.

The realistic usage pattern for this tool is someone landing on the page, trying a sentence or two and maybe the lujvo decomposer, then leaving -- not repeat visits over days where a warm cross-session cache would pay for itself. The repeat-access pattern that *does* happen -- overlapping words across a few sentences tried in one sitting, or the sentence analyzer and decomposer looking up the same gismu -- is fully covered by an in-memory cache. lensisku's API has also been fast in everything tested against it (sub-second), so the cost of a same-session-only cache missing on a fresh page load is low.


### Decision

Ship a `Map`-backed `DictionaryCache` implementation for the client-side build. No IndexedDB, no sql.js.

Because `DictionaryCache` is already an interface `analyze()` depends on by injection, swapping in an IndexedDB-backed (or other) implementation later -- if actual usage shows the cross-session persistence is worth the async interface change -- is a contained, additive follow-up, not a redo of this decision.

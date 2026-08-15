# jbolaltci

[![CI](https://github.com/alxndr/jbolaltci/actions/workflows/ci.yml/badge.svg)](https://github.com/alxndr/jbolaltci/actions/workflows/ci.yml)

*jbolaltci* = jbo (lojbo, "Lojban") + lal (lanli, "analyze") + tci (tutci, "tool") — a Lojban-analysis tool.

Parses Lojban text with the [camxes](https://github.com/lojban/ilmentufa) grammar, looks up the meaning of every word against [lensisku](https://lensisku.lojban.org) (the current living-document Lojban dictionary), and decomposes lujvo into their component gismu — in the spirit of tools like [la jboski](https://jboski.lojban.org/static/about.html) and [la camxes](https://camxes.lojban.org/static/about.html), but wired to lensisku instead of the older jbofihe/jbovlaste stack.

## Install

```sh
npm install
npm run build
```

## Usage

```ts
import { analyze, decomposeLujvo } from "jbolaltci";

const result = await analyze("mi tavla do fi la .lojban.");

for (const term of result.terms) {
  console.log(term.word, term.selmaho, term.valsi?.type_name, term.definitions[0]?.definition);
}

decomposeLujvo("jbolaltci");
// [{ rafsi: "jbo", gismu: "lojbo" }, { rafsi: "lal", gismu: "lanli" }, { rafsi: "tci", gismu: "tutci" }]
```

`analyze()`:
1. Parses the text with the canonical `camxes.peg` grammar (vendored, MIT-licensed, from `lojban/ilmentufa`).
2. Walks the resulting parse tree into an ordered list of words, each tagged with its selma'o (word class).
3. Looks up each distinct word against a local cache first (a SQLite file at `~/.cache/jbolaltci/dictionary.sqlite` by default), falling back to a live call to lensisku's public JSON API on a cache miss, and writes the result back to the cache.
4. For a lujvo term with no dictionary entry of its own (selma'o `L`, `valsi` null), decomposes it and looks up each component gismu's definitions too, exposed as `term.lujvoComponents` (null otherwise — including for a lujvo that *does* have its own entry, where decomposing it would be redundant).

Throws `LojbanSyntaxError` (with `.expected`/`.found`/`.line`/`.column`) if the input isn't grammatical Lojban.

`decomposeLujvo()` breaks a lujvo down into its rafsi, each resolved back to the gismu it came from where unambiguous (ported from [latkerlo/latkerlo-jvotci](https://github.com/latkerlo/latkerlo-jvotci)). Throws `NotLujvoError` if the word isn't a decomposable lujvo (a plain gismu, a cmavo, or not a lojban word at all).

### Options

```ts
await analyze(text, {
  cache,               // a DictionaryCache; defaults to SqliteDictionaryCache()
  client,              // a DictionaryLookup; defaults to LensiskuClient()
  includeDefinitions,  // fetch full glosses per word; default true
});
```

Supply your own `cache`/`client` to point at a different lensisku deployment, swap in an in-memory cache for tests, or avoid touching disk/network entirely (see `test/analyze.test.ts` for fakes of both).

## Web app

Runs entirely client-side (no backend at all) at **[alxndr.github.io/jbolaltci](https://alxndr.github.io/jbolaltci/)** — `analyze()`/`decomposeLujvo()` run directly in the browser and call lensisku's API straight from there (its CORS headers allow this). See `docs/architecture-decisions/001-client-side-cache-in-memory-first.md` for why it's structured this way rather than backed by a server.

```sh
npm run build:web  # bundles web/main.ts + copies index.html/style.css/camxes.js/camxes_postproc.js into web/dist/
npm run dev:web    # same, in watch mode, serving web/dist/ locally
```

Type Lojban text into the textarea, submit, and see a table of each word's selma'o and English definition — or a syntax-error message with line/column if the text isn't grammatical. `web/main.ts` calls the browser-facing library entry (`src/browser.ts`) directly and catches `LojbanSyntaxError`/`NotLujvoError` itself, rather than going through an HTTP API.

`src/browser.ts` is a separate entry point from the Node-facing `src/index.ts`: it uses `MapDictionaryCache` (in-memory, not `better-sqlite3`, which is a native addon and can't run in a browser) and loads the camxes grammar from `window.camxes`/`window.camxes_postprocessing` globals (set by `<script>` tags in `web/index.html`) instead of Node's `createRequire`. `src/analyzeCore.ts` holds the platform-agnostic logic both entry points share.

## Development

```sh
npm run test:unit    # vitest, offline — network-mocked and in-memory-cache tests only
RUN_LIVE_TESTS=1 npm run test:unit -- test/live-smoke.test.ts   # also hits the real lensisku API
npm run test:e2e     # e2e: drives a real browser against the real client-side build + real lensisku
npm test             # test:unit then test:e2e
npm run typecheck      # src/ + test/ (Node)
npm run typecheck:web  # web/ (browser DOM lib; kept as a separate tsconfig -- see web/tsconfig.json)
npm run build          # library: ESM build + .d.ts via tsup, to dist/
```

CI (`.github/workflows/ci.yml`) runs on every push/PR to `main`, as three jobs — the same commands as above (`RUN_LIVE_TESTS` stays off; the Playwright suite is the real-network coverage there):
1. `typecheck-and-unit`: both typechecks, then vitest, on a plain `ubuntu-latest` runner.
2. `e2e` (only once that passes): Playwright, inside Microsoft's official `mcr.microsoft.com/playwright` container image (pinned to the exact `@playwright/test` version) so the browsers are already there instead of being downloaded every run. That image has no C/C++ toolchain, so the job installs `python3`/`build-essential` first — `better-sqlite3` needs to compile its native binding via `node-gyp`.
3. `deploy` (push to `main` only, only once `e2e` passes): builds `web/` and publishes it to GitHub Pages via `actions/upload-pages-artifact` + `actions/deploy-pages`.

No library build step in CI (nothing on npm is being distributed/published yet).

See `src/index.ts` (Node) / `src/browser.ts` (browser) for the full library export surface: `analyze`, `decomposeLujvo`, `extractTerms`, `LensiskuClient`, and their types, plus `parseRaw`/`parseTrimmed`/`SqliteDictionaryCache`/`MapDictionaryCache` where platform-appropriate.

## Attribution

- `vendor/ilmentufa/camxes.js` and `camxes_postproc.js` are vendored verbatim from [lojban/ilmentufa](https://github.com/lojban/ilmentufa) under MIT license (see `vendor/ilmentufa/LICENSE` and `NOTICE.md`).
- `vendor/latkerlo-jvotci/*.ts` are ported (converted to ES modules; no logic changes) from [latkerlo/latkerlo-jvotci](https://github.com/latkerlo/latkerlo-jvotci), under mixed MIT/Apache-2.0 terms — see `vendor/latkerlo-jvotci/NOTICE.md` for the full breakdown.
- All dictionary data comes from [lensisku.lojban.org](https://lensisku.lojban.org), which states its content is public domain.

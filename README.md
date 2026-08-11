# jbolaltci

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

## Development

```sh
npm test          # vitest, offline — network-mocked and in-memory-cache tests only
RUN_LIVE_TESTS=1 npm test -- test/live-smoke.test.ts   # also hits the real lensisku API
npm run typecheck
npm run build      # ESM build + .d.ts via tsup, to dist/
```

Built as a library only for now (no CLI/web UI yet) — see `src/index.ts` for the full exported surface: `analyze`, `parseRaw`, `parseTrimmed`, `extractTerms`, `decomposeLujvo`, `LensiskuClient`, `SqliteDictionaryCache`, and their types.

## Attribution

- `vendor/ilmentufa/camxes.js` and `camxes_postproc.js` are vendored verbatim from [lojban/ilmentufa](https://github.com/lojban/ilmentufa) under MIT license (see `vendor/ilmentufa/LICENSE` and `NOTICE.md`).
- `vendor/latkerlo-jvotci/*.ts` are ported (converted to ES modules; no logic changes) from [latkerlo/latkerlo-jvotci](https://github.com/latkerlo/latkerlo-jvotci), under mixed MIT/Apache-2.0 terms — see `vendor/latkerlo-jvotci/NOTICE.md` for the full breakdown.
- All dictionary data comes from [lensisku.lojban.org](https://lensisku.lojban.org), which states its content is public domain.

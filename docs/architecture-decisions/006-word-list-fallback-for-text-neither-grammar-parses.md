# 006 — fall back to a per-word dictionary lookup when neither grammar can parse the text at all

**Date:** 2026-09-30

**Status:** Implemented


### Context

`analyze("a'oi")` threw `LojbanSyntaxError` even though lensisku has a real entry for `a'oi` (selma'o `COI`, `type_name: "experimental cmavo"`, "vocative: slightly piratical greetings", added 2014). Investigating why showed this wasn't a bug in this codebase's parsing logic: neither vendored grammar's hardcoded cmavo list includes `a'oi`, not even `camxes-exp.js` (the ADR 003 fallback specifically meant to cover lensisku's "experimental cmavo" category). Fetching the actual upstream grammar source (`camxes-exp.pegjs` from `lojban/ilmentufa@master` -- the same commit our vendored `.js` was compiled from) confirmed this directly: its `COI` and `UI` rules list `a'oi`'s sibling vocatives (`co'oi`, `o'ai`, `xai` -- all cross-referenced in lensisku's own definition of `a'oi`) but not `a'oi` itself. This is a genuine gap in the upstream grammar, not a stale vendoring issue -- fixing it properly means a PR against `lojban/ilmentufa`, which is out of scope for this repo and not something to work around by hand-patching a vendored-verbatim file.

More generally: the two grammars are frozen, hardcoded cmavo lists, while lensisku is a living, community-maintained dictionary that can add words (especially experimental cmavo) faster than upstream's grammar catches up. Any such word will make the *entire* input fail to parse, silently hiding a definition lensisku actually has -- not just for cmavo gaps like this one, but for anything the grammar rejects for a reason unrelated to the specific word someone's actually asking about.

### Decision

Added a third parse tier to `analyzeCore()`, after the existing standard-camxes-then-camxes-exp fallback (ADR 003) has already thrown `LojbanSyntaxError`: split the text into whitespace/punctuation-delimited tokens (`tokenizeWords()`, a naive, non-grammatical split -- Lojban orthography's own rule that words are pause-separated, not a morphology parser) and look each token up against lensisku directly, reusing the same cache-first `lookupWord()` the main pipeline already uses.

This tier is **best-effort, not all-or-nothing**: a token search lensisku doesn't recognize still gets a `Term` (with `valsi: null`), so the rest of the text's real matches aren't held hostage by one unresolved word -- consistent with the `(no dictionary entry)` / guessed `name: X` states the UI already shows for a normally-parsed sentence's undocumented words. The whole tier only activates, though, if *at least one* token resolves to something real (a dictionary entry, or a successful lujvo decomposition) -- otherwise the original `LojbanSyntaxError` is rethrown unchanged, so genuinely ungrammatical input (`"abc"`, `"...###invalid###..."`) keeps failing exactly as it always has.

**Off by default**, unlike the camxes-exp tier. `AnalyzeOptions.allowWordListFallback` (and the matching `AnalyzeCoreDeps` field) must be set explicitly. Reason: tier 2 (camxes-exp) still proves the text is grammatical under *some* real Lojban grammar; this tier proves nothing of the kind -- `"a'oi a'oi a'oi"` would "succeed" here even though it's not a sentence. That's a meaningfully different guarantee than `analyze()` has ever made before, so a caller has to opt into weakening it rather than getting it silently. The web app opts in (`web/main.ts`'s `analyze(text, { allowWordListFallback: true })`), with a dedicated notice (`#word-list-fallback-notice`) distinct from the experimental-grammar one, so a user can tell the difference between "this parsed, but used a grammar variant with known quirks" (ADR 003) and "this didn't parse as a sentence at all, here's what each word means" (this tier).

**Selma'o for each resolved term**, so results display consistently with a normal grammatical parse:
- cmavo / experimental cmavo → the word's own `selmaho` field from its definitions (lensisku already names these the same way camxes does -- `"COI"`, `"UI"`, etc. -- so no translation table is needed), falling back to the literal `type_name` if no definition carries one
- gismu → `"G"`, lujvo → `"L"`, cmevla → `"C"` (matching `camxes_postproc.js`'s own single-letter convention)
- an unresolved token that still decomposes as a lujvo → `"L"` too, so the existing undocumented-lujvo decomposition logic (already keyed off `selmaho === "L"` with a null `valsi`) picks it up for free, with no changes needed to that code at all
- an unresolved token starting with a capital letter → `"C"`, guessed (not confirmed -- matches camxes' own cmevla rule, an initial capital letter, but there's no dictionary entry backing it up) -- this also reuses an existing UI rule unchanged (`term.selmaho === "C"` with no `valsi` already renders `"name: X"`)
- anything else unresolved → `"?"`

`AnalyzeResult.parseTree` becomes the flat array of synthesized `"SELMAHO:word"` leaves in this case -- a real `TrimmedNode[]`, so nothing downstream needs a new type. There's no grammatical nesting to show for it: `web/main.ts`'s `renderNesting()` needed **no changes at all** -- it already does its own separate `parseLabeledTree`/`parseLabeledTreeExperimental` call, which throws for the same reason the main parse did, and it already hides the Nesting section on any failure.

A new `AnalyzeResult.usedWordListFallback: boolean` flags this, mirroring `usedExperimentalGrammar`'s existing pattern.

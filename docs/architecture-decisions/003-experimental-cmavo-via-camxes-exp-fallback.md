# 003 — support experimental cmavo via a camxes-exp fallback parser

**Date:** 2026-09-22

**Status:** Accepted


### Context

lensisku documents words tagged `"experimental cmavo"` (e.g. `ue'i`, `ko'oi`, `si'au`) that the vendored `camxes.js` grammar rejects outright as a syntax error -- it implements only the canonical, official Lojban morphology, which doesn't include these community-proposed words. A user asked whether the tool could accept them too.

Two approaches were considered:

* **Pre-processing substitution** -- detect known experimental cmavo in the input, swap each for a real standard cmavo of the same shape/selmaho before parsing, then map back afterward. Rejected as fragile: it means maintaining our own shape/selmaho classification for an open-ended, externally-maintained word list, with no guarantee a same-shape substitute always exists or behaves identically downstream in the parse tree.
* **`camxes-exp.js`** -- `lojban/ilmentufa` (the same upstream repo `camxes.js` is vendored from) already maintains and ships a compiled "experimental camxes" grammar variant, kept in sync with the same community word-proposal pool lensisku draws its `"experimental cmavo"` tag from. Confirmed `ue'i`, `ko'oi`, and `si'au` (all three found tagged `"experimental cmavo"` in lensisku) parse successfully under it.

`camxes-exp` was **not** confirmed to be purely additive vocabulary on top of the standard grammar. Tested directly against the vendored `camxes_postproc.js`: for `"mi tavla do fi la .lojban."`, standard `camxes.js` tags `la` as selmaho `LA` (name-introducer); `camxes-exp.js` tags the same word `LE` (description article) instead. This matches its own changelog, which documents real syntax changes beyond vocabulary (a brivla/cmevla merge, an NAI/UI merge, and others) -- not just a longer word list.

That divergence means naively parsing an entire sentence with `camxes-exp` whenever standard parsing fails could silently reclassify *other*, unrelated words in that same sentence too -- not just recognize the one experimental word that caused the fallback. Two fallback scopes were weighed: whole-sentence fallback (simple, but carries that risk) vs. standalone-word-only support (no risk of misclassifying unrelated words, but far more limited -- wouldn't help a real sentence like `"mi tavla do ue'i"`, only bare input that's nothing but the experimental word itself). Chose whole-sentence fallback, on the condition that it's clearly flagged rather than silently applied.


### Decision

Vendor `camxes-exp.js` verbatim (same license, same upstream repo) alongside `camxes.js`, and use it only as a **fallback**: `analyzeCore()` tries the standard grammar first, and only retries with `camxes-exp` if that throws a `LojbanSyntaxError`. If the fallback succeeds, its result is used and `AnalyzeResult.usedExperimentalGrammar` is set `true`, so callers and the web UI can surface that this parse may not match standard Lojban grammar throughout, not just at the word that triggered it. If both fail, the *standard* grammar's error is what gets thrown -- it's the more useful message for genuinely invalid input, since `camxes-exp`'s error wording/position may differ for reasons unrelated to what the user actually got wrong.

The standard grammar stays the default and only path for anything it already accepts; nothing about existing behavior changes unless a parse would otherwise have failed outright.

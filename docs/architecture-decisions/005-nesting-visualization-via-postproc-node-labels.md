# 005 — show grammatical nesting via camxes_postproc's "N" mode, as a separate parse

**Date:** 2026-09-29

**Status:** Implemented


### Context

A TODO item asked for something like the "Boxes" view in ilmentufa's own glosser (and la jboski's structure view): nested, colored rectangles showing how a sentence's words group together grammatically (sumti inside a selbri inside a sentence, and so on), not just the flat word-by-word table `analyze()` already renders.

`vendor/ilmentufa/camxes_postproc.js` is what the library already uses to turn camxes' raw parse tree into the flat `TrimmedNode[]` shape `parseTrimmed()` returns (mode `"CTJ"`), which deliberately trims away the grammatical-role wrapper nodes (`sentence`/`selbri`/`sumti`/`prenex`) that a nesting visualization needs. Two ways to get them back were considered:

* **Write a new trimming pass against camxes' raw, untrimmed tree** (`parseRaw()`already exposes it). Rejected: the raw tree is extremely deep and verbose -- deciding which of its dozens of numbered wrapper rules (`sumti_1` through `sumti_6`, etc.) are meaningful vs. grammar-implementation noise is exactly what `camxes_postproc.js` already does correctly. Reimplementing that from scratch risks subtly diverging from it for no benefit.
* **Use `camxes_postproc.js`'s own `"N"` mode** ("Show main node labels", per its own doc comment) **combined with `"J"` (JSON)**. Its docs suggest this only really works in the pretty-printed bracket-notation string format (mode without `J`) -- that string format uses a bespoke, fairly intricate bracket/superscript-numeral notation (`(BRIDI: [{SUMTI: KOhA:mi} CU] ...)`) that would need its own hand-written parser to consume programmatically, and getting that parser wrong for edge cases seemed like a real risk. But reading `newer_postprocessor`'s/`process_parse_tree`'s actual source (not just its doc comment) showed the *same* labeled structure is available as plain, nested JSON when `"J"` is combined with `"N"` (mode `"CTJN"`) -- confirmed directly, node by node, against several real sentences. `prettify_brackets` (the thing that turns `[`/`]` into the bracket-notation's various glyphs) runs as a separate, purely cosmetic text-substitution step *after* the JSON is built, and is skipped entirely when `J` is set.

### Decision

Added `parseLabeledTree()`/`parseLabeledTreeExperimental()` (mode `"CTJN"`) alongside the existing `parseTrimmed()`/`parseTrimmedExperimental()` (mode `"CTJ"`), in both `camxes.node.ts` and `camxes.browser.ts`, sharing the same `LojbanSyntaxError`-wrapping and postproc-calling machinery via a small `parseTreeWith(grammar, mode, text)` helper.

This is a **separate parse call, not a change to `parseTrimmed`/`AnalyzeResult.parseTree`/`extractTerms()`**. Reasons:
* `"N"` mode changes the tree's *shape*, not just adds labels to the existing shape -- some nodes that `"CTJ"` mode trims away survive as extra wrapper levels under `"CTJN"`. Swapping the mode under the existing pipeline would be a breaking change to `AnalyzeResult.parseTree`'s documented, tested shape for no reason the word-lookup pipeline actually needs.
* The nesting visualization is presentation-only; nothing in `analyzeCore()`'s dictionary-annotation logic needs role labels.

The standard-then-camxes-exp-fallback logic (ADR 003) that `analyzeCore()` already had inline was generalized into an exported `parseWithFallback<T>()` (`src/parser/parseWithFallback.ts`) so this second parse path doesn't duplicate that logic. In practice, `web/main.ts` doesn't even call it a second time for the labeled tree -- since both parses see the exact same input text, it just reuses `analyze()`'s own `result.usedExperimentalGrammar` to pick `parseLabeledTree` vs. `parseLabeledTreeExperimental` directly.

The four possible role labels (`BRIDI`/`SELBRI`/`SUMTI`/`PRENEX`, exactly `camxes_postproc.js`'s own `name_substitution_map` values for `sentence`/`selbri`/`sumti`/`prenex`) are captured as `LABELED_NODE_ROLES`/`LabeledNodeRole` in `src/parser/types.ts`, so "is this array element a role label" is a small fixed-set membership check, not a heuristic (e.g. never confusable with a bare terminator selmaho like `"CU"`, or a `"SELMAHO:word"` leaf being used as an ordinary sibling rather than a wrapping label).

`web/main.ts` renders the tree as nested `<div>`s, background color cycling by depth (5-step palette, light/dark aware, matching the app's existing minimalist look rather than the reference tools' more saturated one), with a small caption at the bottom of each *labeled* node (translated to lowercase Lojban-grammar terms -- `BRIDI` displays as "sentence", others keep their Lojban name) and no caption on plain structural groupings. A bare terminator (`"CU"` with no `:word`, i.e. something elided rather than typed) renders no box at all, matching how the results table already only ever lists real typed words. Word leaves reuse the same lensisku-linking logic as the results table, cross-referencing `analyze()`'s already-fetched `result.terms` by word rather than looking anything up again.

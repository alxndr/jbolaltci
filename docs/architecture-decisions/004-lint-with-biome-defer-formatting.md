# 004 — lint with Biome, and leave formatting off for now

**Date:** 2026-09-29

**Status:** Implemented


### Context

The repo had no linter and no formatter. `TODO.md` asked for linting and left the tool undecided, between [Biome](https://biomejs.dev) and [oxlint](https://oxc.rs/docs/guide/usage/linter). The goal is to catch real bugs and enforce a consistent style, cheaply, in CI.

What the repo actually needs shapes the answer, and it is worth writing down because the widely-repeated framing of this choice does not apply here:

* **The codebase is small.** 38 files are linted. Both tools finish in well under a second locally and in CI. Every headline claim about these tools is about speed relative to ESLint on large codebases, and none of that speed is worth anything at this size. Speed is not a deciding factor.
* **There is no formatter today.** The existing code already follows one consistent style by hand -- 2-space indent, double quotes, semicolons, roughly 110 columns (every line longer than that is a string literal or a test title, which no formatter can break). So there is no style drift to correct, but also no automated enforcement of style going forward.
* **Type errors are already caught.** CI runs `tsc --noEmit` for both the library and the web app, so a linter's type-aware mode has much less to add here than it would in a repo without a typecheck gate.

On the tools themselves, as of September 2026:

* **oxlint** (1.86.0) is a linter only -- it cannot format. Formatting lives in a separate tool, `oxfmt`, which is much younger. Its type-aware mode, `tsgolint`, went stable in July 2026 and covers 59 of the 61 type-aware rules in typescript-eslint, but it is built on typescript-go and **requires TypeScript 7.0+**. Adopting it with type-aware linting would therefore pull in a TypeScript version upgrade that is a separate, still-open question in `TODO.md`.
* **Biome** (2.5.14) lints, formats, organizes imports, and also handles CSS and JSON, in one binary with one config file, and needs no dependency on the `typescript` package at all. Its type-aware rules (which it calls Biotype) are fewer and approximate, gated behind an experimental `project` domain -- but per the point above, that costs us almost nothing here.

The two real trade-offs both favor Biome here. Biome's type inference is a bespoke engine that approximates TypeScript's behavior rather than calling the real compiler, where oxlint delegates to typescript-go and inherits its exact semantics. And Biome's plugin API is GritQL-based and effectively report-only, where oxlint has an ESLint v9-compatible plugin API. Neither matters at 38 files with no custom rules and no framework, but they are the reasons a larger project might reasonably pick oxlint instead, so they are recorded rather than dismissed.

One gotcha worth recording because it silently defeats the whole point: `biome lint` exits **0** when it only finds warning-level violations. Without `--error-on-warnings`, a CI step running it would have gone green on the two real findings this change found on the first run. The `lint` script includes that flag for exactly this reason.


### Decision

Adopt `@biomejs/biome` as the linter, with the `recommended` rule preset, and wire `npm run lint` into CI ahead of the typechecks.

Run the **formatter and the assist actions (import organization) turned off**. Both were kept off deliberately: turning them on would reformat the entire codebase in a single commit, burying a small, reviewable change in whitespace noise, and the style is already consistent so there is nothing to correct first. This is a reversible one-line change to `biome.json` when the codebase next needs a broad reformat anyway -- at which point it is better done as its own commit, deliberately, than dragged along with a linting change.

`vendor/` is excluded from linting. It holds third-party Apache-2.0 code that `src/lujvo/decompose.ts` imports from, so it is part of the TypeScript build graph, but it is not ours to fix. Everything else is left to `.gitignore` via Biome's `vcs.useIgnoreFile`, rather than duplicating those globs in `biome.json`.

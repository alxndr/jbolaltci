import { LojbanSyntaxError } from "./lojbanSyntaxError.js";
import type { TrimmedNode } from "./types.js";
import type { Camxes } from "./vendorTypes.js";

// The Node build loads the vendored parser via createRequire (see
// camxes.node.ts); that doesn't exist in a browser. Instead, web/index.html
// loads camxes.js and camxes_postproc.js as plain classic <script> tags,
// which is what they were originally written for (verified hands-on): their
// top-level `var`/`function` declarations become real global bindings when
// there's no `module`/`require` in scope, which is exactly the case for a
// classic (non-module) script. camxes_postproc.js's own `module.exports`
// block simply never runs, so we call its underlying function name directly
// -- `camxes_postprocessing`, not the Node-only `.postprocess()` alias.
//
// Using globalThis + a local cast here (rather than `declare global` on
// `Window`) keeps this file typecheck-clean under both the root tsconfig
// (no DOM lib) and web/tsconfig.json (DOM lib) without the two declarations
// colliding.
//
// camxes-exp.js declares the same top-level `var camxes` as camxes.js, so it
// can't be loaded as a second plain <script> without clobbering the first --
// web/build.mjs wraps it in an IIFE at build time and exposes the result as
// window.camxes_exp instead (see that file for details).
interface CamxesGlobals {
  camxes: Camxes;
  camxes_exp: Camxes;
  camxes_postprocessing: (tree: unknown, mode: string) => string;
}
const camxesGlobals = globalThis as unknown as CamxesGlobals;

/** Mode passed to camxes_postproc: keep word classes (C) and terminators (T),
 * emit as JSON (J) rather than the pretty-printed bracket notation. */
const POSTPROC_MODE = "CTJ";

function parseRawWith(grammar: Camxes, text: string): unknown {
  try {
    return grammar.parse(text);
  } catch (err) {
    if (err instanceof grammar.SyntaxError) throw new LojbanSyntaxError(err);
    throw err;
  }
}

function parseTrimmedWith(grammar: Camxes, text: string): TrimmedNode[] {
  const raw = parseRawWith(grammar, text);
  const json = camxesGlobals.camxes_postprocessing(raw, POSTPROC_MODE);
  return JSON.parse(json) as TrimmedNode[];
}

/** Parses Lojban text into camxes' raw, untrimmed parse tree. Throws
 * LojbanSyntaxError if the text is not grammatical Lojban. */
export function parseRaw(text: string): unknown {
  return parseRawWith(camxesGlobals.camxes, text);
}

/** Parses Lojban text and returns the trimmed tree: nested arrays whose
 * leaves are either "SELMAHO:word" or a bare selmaho for an elided
 * terminator. Throws LojbanSyntaxError if the text is not grammatical. */
export function parseTrimmed(text: string): TrimmedNode[] {
  return parseTrimmedWith(camxesGlobals.camxes, text);
}

/** Same as parseTrimmed, but against camxes-exp -- see
 * docs/architecture-decisions/003 for why this is a separate, fallback-only
 * entry point rather than folded into parseTrimmed itself. */
export function parseTrimmedExperimental(text: string): TrimmedNode[] {
  return parseTrimmedWith(camxesGlobals.camxes_exp, text);
}

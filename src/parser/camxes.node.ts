import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LojbanSyntaxError } from "./lojbanSyntaxError.js";
import type { TrimmedNode } from "./types.js";
import type { Camxes, CamxesPostproc } from "./vendorTypes.js";

// The vendored files are legacy CommonJS (implicit-global assignments, etc.)
// and must go through Node's real CJS loader rather than being pulled into
// Vite/esbuild's strict-mode ESM transform, which breaks them. createRequire
// gives us that real loader from within an ESM module.
const require = createRequire(import.meta.url);

// This module sits two directories below the package root when run from
// source (src/parser/camxes.node.ts) but one directory below it once tsup
// bundles everything into a single dist/index.js -- and a dynamic require()
// string like this one is opaque to the bundler, so it's never rewritten for
// the new depth. Try both so the vendored parser resolves in either layout.
function resolveVendorFile(fileName: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "vendor", "ilmentufa", fileName),
    join(here, "..", "..", "vendor", "ilmentufa", fileName),
  ];
  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error(`Could not locate vendored ${fileName}; looked in: ${candidates.join(", ")}`);
  }
  return found;
}

const camxes = require(resolveVendorFile("camxes.js")) as Camxes;
const camxesExp = require(resolveVendorFile("camxes-exp.js")) as Camxes;
const postproc = require(resolveVendorFile("camxes_postproc.js")) as CamxesPostproc;

/** Modes passed to camxes_postproc. Both keep word classes (C) and
 * terminators (T), and emit as JSON (J) rather than the pretty-printed
 * bracket notation. The labeled mode also adds "N" (node labels), which
 * additionally preserves BRIDI/SELBRI/SUMTI/PRENEX grammatical-role wrapper
 * nodes that the plain mode trims away -- see LABELED_NODE_ROLES and the
 * "nesting" visualization in web/main.ts. */
const POSTPROC_MODE = "CTJ";
const LABELED_POSTPROC_MODE = "CTJN";

function parseRawWith(grammar: Camxes, text: string): unknown {
  try {
    return grammar.parse(text);
  } catch (err) {
    if (err instanceof grammar.SyntaxError) throw new LojbanSyntaxError(err);
    throw err;
  }
}

function parseTreeWith(grammar: Camxes, mode: string, text: string): TrimmedNode {
  const raw = parseRawWith(grammar, text);
  const json = postproc.postprocess(raw, mode);
  return JSON.parse(json) as TrimmedNode;
}

/** Parses Lojban text into camxes' raw, untrimmed parse tree. Throws
 * LojbanSyntaxError if the text is not grammatical Lojban. */
export function parseRaw(text: string): unknown {
  return parseRawWith(camxes, text);
}

/** Parses Lojban text and returns the trimmed tree: nested arrays whose
 * leaves are either "SELMAHO:word" or a bare selmaho for an elided
 * terminator. Throws LojbanSyntaxError if the text is not grammatical. */
export function parseTrimmed(text: string): TrimmedNode[] {
  return parseTreeWith(camxes, POSTPROC_MODE, text) as TrimmedNode[];
}

/** Same as parseTrimmed, but against camxes-exp -- see
 * docs/architecture-decisions/003 for why this is a separate, fallback-only
 * entry point rather than folded into parseTrimmed itself. */
export function parseTrimmedExperimental(text: string): TrimmedNode[] {
  return parseTreeWith(camxesExp, POSTPROC_MODE, text) as TrimmedNode[];
}

/** Same as parseTrimmed, but also keeps BRIDI/SELBRI/SUMTI/PRENEX
 * grammatical-role wrapper nodes (see LABELED_NODE_ROLES) instead of
 * trimming them away -- for showing how a sentence's words nest together,
 * not for the word-by-word lookup pipeline analyzeCore() already covers. */
export function parseLabeledTree(text: string): TrimmedNode {
  return parseTreeWith(camxes, LABELED_POSTPROC_MODE, text);
}

/** Same as parseLabeledTree, but against camxes-exp -- see
 * docs/architecture-decisions/003. */
export function parseLabeledTreeExperimental(text: string): TrimmedNode {
  return parseTreeWith(camxesExp, LABELED_POSTPROC_MODE, text);
}

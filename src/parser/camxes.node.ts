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
const postproc = require(resolveVendorFile("camxes_postproc.js")) as CamxesPostproc;

/** Mode passed to camxes_postproc: keep word classes (C) and terminators (T),
 * emit as JSON (J) rather than the pretty-printed bracket notation. */
const POSTPROC_MODE = "CTJ";

/** Parses Lojban text into camxes' raw, untrimmed parse tree. Throws
 * LojbanSyntaxError if the text is not grammatical Lojban. */
export function parseRaw(text: string): unknown {
  try {
    return camxes.parse(text);
  } catch (err) {
    if (err instanceof camxes.SyntaxError) throw new LojbanSyntaxError(err);
    throw err;
  }
}

/** Parses Lojban text and returns the trimmed tree: nested arrays whose
 * leaves are either "SELMAHO:word" or a bare selmaho for an elided
 * terminator. Throws LojbanSyntaxError if the text is not grammatical. */
export function parseTrimmed(text: string): TrimmedNode[] {
  const raw = parseRaw(text);
  const json = postproc.postprocess(raw, POSTPROC_MODE);
  return JSON.parse(json) as TrimmedNode[];
}

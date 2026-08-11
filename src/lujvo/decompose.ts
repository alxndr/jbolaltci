import { HYPHENS } from "../../vendor/latkerlo-jvotci/data.js";
import {
  DecompositionError,
  InvalidClusterError,
  NoLujvoFoundError,
  NonLojbanCharacterError,
  NotBrivlaError,
  NotZihevlaError,
} from "../../vendor/latkerlo-jvotci/exceptions.js";
import { getVeljvo, jvokaha } from "../../vendor/latkerlo-jvotci/katna.js";

export interface LujvoComponent {
  readonly rafsi: string;
  /** The full gismu this rafsi resolves to, or null if the piece is
   * ambiguous/unresolved (upstream marks these with a leading/trailing "-"). */
  readonly gismu: string | null;
}

export class NotLujvoError extends Error {
  constructor(word: string, cause: unknown) {
    super(`"${word}" is not a decomposable lujvo`);
    this.name = "NotLujvoError";
    this.cause = cause;
  }
}

const DECOMPOSITION_FAILURE_TYPES = [
  DecompositionError,
  InvalidClusterError,
  NoLujvoFoundError,
  NonLojbanCharacterError,
  NotBrivlaError,
  NotZihevlaError,
  TypeError,
];

function isDecompositionFailure(err: unknown): boolean {
  return DECOMPOSITION_FAILURE_TYPES.some((errorType) => err instanceof errorType);
}

/** Decomposes a lujvo into its rafsi, each resolved back to the gismu it
 * came from where unambiguous. Throws NotLujvoError if the word isn't a
 * decomposable lujvo (e.g. it's a plain gismu, or not a lojban word at all). */
export function decomposeLujvo(word: string): LujvoComponent[] {
  let rawPieces: string[];
  let resolved: string[];
  try {
    rawPieces = jvokaha(word).filter((piece) => !HYPHENS.includes(piece));
    resolved = getVeljvo(word);
  } catch (err) {
    if (isDecompositionFailure(err)) throw new NotLujvoError(word, err);
    throw err;
  }

  return rawPieces.map((rafsi, i) => {
    const candidate = resolved[i] ?? null;
    const gismu = candidate !== null && !candidate.startsWith("-") && !candidate.endsWith("-") ? candidate : null;
    return { rafsi, gismu };
  });
}

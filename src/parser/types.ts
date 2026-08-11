/** A node in the trimmed camxes parse tree: either a leaf string (a bare
 * selmaho, or "SELMAHO:word") or a nested array of further nodes. */
export type TrimmedNode = string | TrimmedNode[];

/** A single word extracted from a parse tree, in reading order, tagged with
 * the selma'o (word class) camxes assigned it. */
export interface Term {
  readonly index: number;
  readonly selmaho: string;
  readonly word: string;
}

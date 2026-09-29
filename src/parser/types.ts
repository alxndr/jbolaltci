/** A node in the trimmed camxes parse tree: either a leaf string (a bare
 * selmaho, or "SELMAHO:word") or a nested array of further nodes. */
export type TrimmedNode = string | TrimmedNode[];

/** The grammatical-role labels camxes_postproc.js's "N" (node labels) mode
 * can attach to a node -- see parseLabeledTree()/parseLabeledTreeExperimental()
 * and the "nesting" visualization in web/main.ts. Mirrors postproc's own
 * name_substitution_map (`sentence`->BRIDI, `selbri`->SELBRI, `sumti`->SUMTI,
 * `prenex`->PRENEX) exactly -- it's a small, fixed set, not a heuristic. A
 * labeled node appears as `[label, ...children]`, sometimes with a trailing
 * colon on the label (`"SUMTI:"` rather than `"SUMTI"`) when postproc
 * collapsed it to a single already-flattened child -- strip that before
 * comparing against this list. */
export const LABELED_NODE_ROLES = ["BRIDI", "SELBRI", "SUMTI", "PRENEX"] as const;
export type LabeledNodeRole = (typeof LABELED_NODE_ROLES)[number];

/** A single word extracted from a parse tree, in reading order, tagged with
 * the selma'o (word class) camxes assigned it. */
export interface Term {
  readonly index: number;
  readonly selmaho: string;
  readonly word: string;
}

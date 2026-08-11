import type { Term, TrimmedNode } from "./types.js";

/** Flattens a trimmed camxes parse tree into the words it contains, in
 * reading order, each tagged with its selma'o. Bare selmaho leaves (elided
 * terminators, which have no associated word text) are skipped. */
export function extractTerms(tree: TrimmedNode): Term[] {
  const terms: Term[] = [];
  walk(tree, terms);
  return terms;
}

function walk(node: TrimmedNode, terms: Term[]): void {
  if (typeof node === "string") {
    const separatorIndex = node.indexOf(":");
    if (separatorIndex === -1) return;
    terms.push({
      index: terms.length,
      selmaho: node.slice(0, separatorIndex),
      word: node.slice(separatorIndex + 1),
    });
    return;
  }
  for (const child of node) walk(child, terms);
}

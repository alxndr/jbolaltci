import { describe, expect, it } from "vitest";
import { extractTerms } from "../src/parser/extractTerms.js";
import type { TrimmedNode } from "../src/parser/types.js";

describe("extractTerms", () => {
  it("extracts words in reading order and skips elided terminators", () => {
    const tree: TrimmedNode[] = [
      ["KOhA:ti", "CU"],
      ["G:melbi", "VAU"],
    ];
    expect(extractTerms(tree)).toEqual([
      { index: 0, selmaho: "KOhA", word: "ti" },
      { index: 1, selmaho: "G", word: "melbi" },
    ]);
  });

  it("walks arbitrarily nested trees in left-to-right order", () => {
    const tree: TrimmedNode[] = [
      ["KOhA:mi", "CU"],
      ["G:tavla", [["KOhA:do", ["FA:fi", ["LA:la", "C:lojban"]]], "VAU"]],
    ];
    expect(extractTerms(tree)).toEqual([
      { index: 0, selmaho: "KOhA", word: "mi" },
      { index: 1, selmaho: "G", word: "tavla" },
      { index: 2, selmaho: "KOhA", word: "do" },
      { index: 3, selmaho: "FA", word: "fi" },
      { index: 4, selmaho: "LA", word: "la" },
      { index: 5, selmaho: "C", word: "lojban" },
    ]);
  });

  it("returns an empty list for a tree with no tagged words", () => {
    expect(extractTerms(["CU", "VAU"])).toEqual([]);
  });
});

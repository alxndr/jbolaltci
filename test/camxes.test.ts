import { describe, expect, it } from "vitest";
import { parseTrimmed } from "../src/parser/camxes.node.js";
import { LojbanSyntaxError } from "../src/parser/lojbanSyntaxError.js";

describe("parseTrimmed", () => {
  it("parses a simple bridi into the trimmed selmaho-tagged tree", () => {
    expect(parseTrimmed("ti melbi")).toEqual([
      ["KOhA:ti", "CU"],
      ["G:melbi", "VAU"],
    ]);
  });

  it("parses a sentence with sumti tail and a name", () => {
    expect(parseTrimmed("mi tavla do fi la .lojban.")).toEqual([
      ["KOhA:mi", "CU"],
      [
        "G:tavla",
        [["KOhA:do", ["FA:fi", ["LA:la", "C:lojban"]]], "VAU"],
      ],
    ]);
  });

  it("throws a LojbanSyntaxError with position info on ungrammatical input", () => {
    expect(() => parseTrimmed("...###invalid###...")).toThrow(LojbanSyntaxError);
    try {
      parseTrimmed("...###invalid###...");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(LojbanSyntaxError);
      const e = err as LojbanSyntaxError;
      expect(e.offset).toBe(3);
      expect(e.line).toBe(1);
      expect(e.column).toBe(4);
      expect(e.found).toBe("#");
    }
  });
});

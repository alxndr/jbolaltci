import { describe, expect, it } from "vitest";
import {
  parseLabeledTree,
  parseLabeledTreeExperimental,
  parseTrimmed,
  parseTrimmedExperimental,
} from "../src/parser/camxes.node.js";
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

describe("parseTrimmedExperimental", () => {
  it("parses an experimental cmavo that the standard grammar rejects", () => {
    expect(() => parseTrimmed("ue'i")).toThrow(LojbanSyntaxError);
    expect(parseTrimmedExperimental("ue'i")).toEqual("UI:ue'i");
  });

  it("still throws a LojbanSyntaxError on input that's invalid under camxes-exp too", () => {
    expect(() => parseTrimmedExperimental("...###invalid###...")).toThrow(LojbanSyntaxError);
  });
});

describe("parseLabeledTree", () => {
  it("keeps BRIDI/SELBRI/SUMTI grammatical-role labels that parseTrimmed trims away", () => {
    expect(parseLabeledTree("ti melbi")).toEqual([
      "BRIDI",
      [["SUMTI:", "KOhA:ti"], "CU"],
      [["SELBRI:", "G:melbi"], "VAU"],
    ]);
  });

  it("labels nested sumti/selbri too, for a sentence with sumti tail and a name", () => {
    expect(parseLabeledTree("mi tavla do fi la .lojban.")).toEqual([
      "BRIDI",
      [["SUMTI:", "KOhA:mi"], "CU"],
      [
        ["SELBRI:", "G:tavla"],
        [[["SUMTI:", "KOhA:do"], ["FA:fi", ["SUMTI", ["LA:la", "C:lojban"]]]], "VAU"],
      ],
    ]);
  });

  it("still labels a bare standalone sumti even with no selbri around it", () => {
    expect(parseLabeledTree("ti")).toEqual([["SUMTI:", "KOhA:ti"], "VAU"]);
  });

  it("throws a LojbanSyntaxError on ungrammatical input, same as parseTrimmed", () => {
    expect(() => parseLabeledTree("...###invalid###...")).toThrow(LojbanSyntaxError);
  });
});

describe("parseLabeledTreeExperimental", () => {
  it("parses an experimental cmavo that the standard grammar rejects", () => {
    expect(() => parseLabeledTree("ue'i")).toThrow(LojbanSyntaxError);
    expect(parseLabeledTreeExperimental("ue'i")).toEqual("UI:ue'i");
  });
});

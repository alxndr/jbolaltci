import { describe, expect, it } from "vitest";
import { tokenizeWords } from "../src/parser/tokenizeWords.js";

describe("tokenizeWords", () => {
  it("splits on whitespace", () => {
    expect(tokenizeWords("mi tavla do")).toEqual(["mi", "tavla", "do"]);
  });

  it("collapses runs of whitespace", () => {
    expect(tokenizeWords("mi   tavla\ndo")).toEqual(["mi", "tavla", "do"]);
  });

  it("trims leading and trailing whitespace", () => {
    expect(tokenizeWords("  mi tavla  ")).toEqual(["mi", "tavla"]);
  });

  it("strips a cmevla's surrounding pause-marking periods", () => {
    expect(tokenizeWords("la .lojban.")).toEqual(["la", "lojban"]);
  });

  it("strips sentence-final punctuation", () => {
    expect(tokenizeWords("coi?")).toEqual(["coi"]);
    expect(tokenizeWords("coi!")).toEqual(["coi"]);
    expect(tokenizeWords("coi,")).toEqual(["coi"]);
  });

  it("does not strip an apostrophe from inside a word", () => {
    expect(tokenizeWords("a'oi")).toEqual(["a'oi"]);
  });

  it("returns an empty array for blank input", () => {
    expect(tokenizeWords("   ")).toEqual([]);
  });
});

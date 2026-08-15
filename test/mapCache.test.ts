import { describe, expect, it } from "vitest";
import { MapDictionaryCache } from "../src/cache/mapCache.js";
import type { Valsi, ValsiDefinition } from "../src/dictionary/types.js";

const jimpe: Valsi = { valsiid: 493, word: "jimpe", type_name: "gismu", rafsi: "    jmi", source_langid: 1 };
const jimpeDefinitions: ValsiDefinition[] = [
  {
    definitionid: 493,
    valsiword: "jimpe",
    valsiid: 493,
    langid: 2,
    langrealname: "English",
    definition: "x1 understands...",
    notes: null,
    selmaho: null,
    type_name: "gismu",
    rafsi: "    jmi",
    gloss_keywords: null,
  },
];

describe("MapDictionaryCache", () => {
  it("returns undefined for a word that was never looked up", () => {
    const cache = new MapDictionaryCache();
    expect(cache.getValsi("jimpe")).toBeUndefined();
    expect(cache.getDefinitions("jimpe")).toBeUndefined();
  });

  it("round-trips a cached valsi and its definitions", () => {
    const cache = new MapDictionaryCache();

    cache.setValsi("jimpe", jimpe);
    cache.setDefinitions("jimpe", jimpeDefinitions);

    expect(cache.getValsi("jimpe")).toEqual(jimpe);
    expect(cache.getDefinitions("jimpe")).toEqual(jimpeDefinitions);
  });

  it("distinguishes a cached negative result from an uncached word", () => {
    const cache = new MapDictionaryCache();

    cache.setValsi("xyzzy", null);

    expect(cache.getValsi("xyzzy")).toBeNull();
    expect(cache.getValsi("never-looked-up")).toBeUndefined();
  });

  it("overwrites a previously cached value for the same word", () => {
    const cache = new MapDictionaryCache();

    cache.setValsi("jimpe", null);
    cache.setValsi("jimpe", jimpe);

    expect(cache.getValsi("jimpe")).toEqual(jimpe);
  });

  it("does not share state between separate instances", () => {
    const first = new MapDictionaryCache();
    first.setValsi("jimpe", jimpe);

    const second = new MapDictionaryCache();
    expect(second.getValsi("jimpe")).toBeUndefined();
  });
});

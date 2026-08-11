import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultCachePath, SqliteDictionaryCache } from "../src/cache/sqliteCache.js";
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

describe("defaultCachePath", () => {
  it("points at dictionary.sqlite under a jbolaltci cache directory", () => {
    expect(defaultCachePath()).toMatch(/jbolaltci[/\\]dictionary\.sqlite$/);
  });
});

describe("SqliteDictionaryCache", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "jbolaltci-cache-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns undefined for a word that was never looked up", () => {
    const cache = new SqliteDictionaryCache({ filePath: ":memory:" });
    expect(cache.getValsi("jimpe")).toBeUndefined();
    expect(cache.getDefinitions("jimpe")).toBeUndefined();
  });

  it("round-trips a cached valsi and its definitions", () => {
    const cache = new SqliteDictionaryCache({ filePath: ":memory:" });

    cache.setValsi("jimpe", jimpe);
    cache.setDefinitions("jimpe", jimpeDefinitions);

    expect(cache.getValsi("jimpe")).toEqual(jimpe);
    expect(cache.getDefinitions("jimpe")).toEqual(jimpeDefinitions);
  });

  it("distinguishes a cached negative result from an uncached word", () => {
    const cache = new SqliteDictionaryCache({ filePath: ":memory:" });

    cache.setValsi("xyzzy", null);

    expect(cache.getValsi("xyzzy")).toBeNull();
    expect(cache.getValsi("never-looked-up")).toBeUndefined();
  });

  it("overwrites a previously cached value for the same word", () => {
    const cache = new SqliteDictionaryCache({ filePath: ":memory:" });

    cache.setValsi("jimpe", null);
    cache.setValsi("jimpe", jimpe);

    expect(cache.getValsi("jimpe")).toEqual(jimpe);
  });

  it("persists to disk across separate instances at the same file path", () => {
    const filePath = join(dir, "dictionary.sqlite");
    const first = new SqliteDictionaryCache({ filePath });
    first.setValsi("jimpe", jimpe);
    first.close();

    const second = new SqliteDictionaryCache({ filePath });
    expect(second.getValsi("jimpe")).toEqual(jimpe);
    second.close();
  });
});

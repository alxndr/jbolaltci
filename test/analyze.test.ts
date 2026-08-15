import { describe, expect, it, vi } from "vitest";
import { analyze } from "../src/analyze.js";
import { LojbanSyntaxError } from "../src/parser/lojbanSyntaxError.js";
import type { DictionaryCache } from "../src/cache/cache.js";
import type { Valsi, ValsiDefinition } from "../src/dictionary/types.js";

function fakeValsi(word: string, valsiid: number): Valsi {
  return { valsiid, word, type_name: "gismu", rafsi: null, source_langid: 1 };
}

function fakeDefinitions(word: string): ValsiDefinition[] {
  return [
    {
      definitionid: 1,
      valsiword: word,
      valsiid: 1,
      langid: 2,
      langrealname: "English",
      definition: `definition of ${word}`,
      notes: null,
      selmaho: null,
      type_name: "gismu",
      rafsi: null,
      gloss_keywords: null,
    },
  ];
}

class FakeCache implements DictionaryCache {
  valsi = new Map<string, Valsi | null>();
  definitions = new Map<string, ValsiDefinition[]>();

  getValsi(word: string) {
    return this.valsi.has(word) ? this.valsi.get(word) : undefined;
  }
  setValsi(word: string, value: Valsi | null) {
    this.valsi.set(word, value);
  }
  getDefinitions(word: string) {
    return this.definitions.has(word) ? this.definitions.get(word) : undefined;
  }
  setDefinitions(word: string, value: ValsiDefinition[]) {
    this.definitions.set(word, value);
  }
}

function fakeClient(overrides: {
  getValsi?: (word: string) => Promise<Valsi | null>;
  getDefinitions?: (word: string) => Promise<ValsiDefinition[]>;
} = {}) {
  return {
    getValsi: vi.fn(overrides.getValsi ?? (async (word: string) => fakeValsi(word, 1))),
    getDefinitions: vi.fn(overrides.getDefinitions ?? (async (word: string) => fakeDefinitions(word))),
  };
}

describe("analyze", () => {
  it("parses text, extracts terms, and annotates each with a dictionary lookup", async () => {
    const cache = new FakeCache();
    const client = fakeClient();

    const result = await analyze("ti melbi", { cache, client });

    expect(result.input).toBe("ti melbi");
    expect(result.terms).toEqual([
      {
        index: 0,
        selmaho: "KOhA",
        word: "ti",
        valsi: fakeValsi("ti", 1),
        definitions: fakeDefinitions("ti"),
        lujvoComponents: null,
      },
      {
        index: 1,
        selmaho: "G",
        word: "melbi",
        valsi: fakeValsi("melbi", 1),
        definitions: fakeDefinitions("melbi"),
        lujvoComponents: null,
      },
    ]);
  });

  it("checks the cache before calling the live client, and populates it on a miss", async () => {
    const cache = new FakeCache();
    cache.setValsi("ti", fakeValsi("ti", 999));
    cache.setDefinitions("ti", fakeDefinitions("ti"));
    const client = fakeClient();

    const result = await analyze("ti melbi", { cache, client });

    expect(result.terms[0]?.valsi).toEqual(fakeValsi("ti", 999));
    expect(client.getValsi).not.toHaveBeenCalledWith("ti");
    expect(client.getValsi).toHaveBeenCalledWith("melbi");
    expect(cache.getValsi("melbi")).toEqual(fakeValsi("melbi", 1));
  });

  it("looks up each distinct word only once even if it appears multiple times", async () => {
    const cache = new FakeCache();
    const client = fakeClient();

    await analyze("mi tavla fi mi", { cache, client });

    expect(client.getValsi).toHaveBeenCalledTimes(3); // mi, tavla, fi
    expect(client.getValsi).toHaveBeenCalledWith("mi");
  });

  it("caches a negative lookup as null and skips fetching definitions for it", async () => {
    const cache = new FakeCache();
    const client = fakeClient({ getValsi: async () => null });

    const result = await analyze("ti melbi", { cache, client });

    expect(result.terms[0]?.valsi).toBeNull();
    expect(result.terms[0]?.definitions).toEqual([]);
    expect(client.getDefinitions).not.toHaveBeenCalled();
    expect(cache.getValsi("ti")).toBeNull();
  });

  it("skips definitions entirely when includeDefinitions is false", async () => {
    const cache = new FakeCache();
    const client = fakeClient();

    const result = await analyze("ti melbi", { cache, client, includeDefinitions: false });

    expect(result.terms[0]?.definitions).toEqual([]);
    expect(client.getDefinitions).not.toHaveBeenCalled();
  });

  it("propagates LojbanSyntaxError for ungrammatical input without calling the client", async () => {
    const cache = new FakeCache();
    const client = fakeClient();

    await expect(analyze("...###invalid###...", { cache, client })).rejects.toThrow(LojbanSyntaxError);
    expect(client.getValsi).not.toHaveBeenCalled();
  });

  it("decomposes an undocumented lujvo term and looks up each component gismu's definitions", async () => {
    const cache = new FakeCache();
    const client = fakeClient({
      getValsi: async (word) => (word === "jbolaltci" ? null : fakeValsi(word, 1)),
    });

    const result = await analyze("le jbolaltci", { cache, client });

    const lujvoTerm = result.terms.find((term) => term.word === "jbolaltci");
    expect(lujvoTerm?.valsi).toBeNull();
    expect(lujvoTerm?.lujvoComponents).toEqual([
      { rafsi: "jbo", gismu: "lojbo", definitions: fakeDefinitions("lojbo") },
      { rafsi: "lal", gismu: "lanli", definitions: fakeDefinitions("lanli") },
      { rafsi: "tci", gismu: "tutci", definitions: fakeDefinitions("tutci") },
    ]);
  });

  it("does not decompose a lujvo term that already has its own dictionary entry", async () => {
    const cache = new FakeCache();
    const client = fakeClient();

    const result = await analyze("le jbolaltci", { cache, client });

    const lujvoTerm = result.terms.find((term) => term.word === "jbolaltci");
    expect(lujvoTerm?.valsi).not.toBeNull();
    expect(lujvoTerm?.lujvoComponents).toBeNull();
  });

  it("skips component gismu definitions, but still names them, when includeDefinitions is false", async () => {
    const cache = new FakeCache();
    const client = fakeClient({
      getValsi: async (word) => (word === "jbolaltci" ? null : fakeValsi(word, 1)),
    });

    const result = await analyze("le jbolaltci", { cache, client, includeDefinitions: false });

    const lujvoTerm = result.terms.find((term) => term.word === "jbolaltci");
    expect(lujvoTerm?.lujvoComponents).toEqual([
      { rafsi: "jbo", gismu: "lojbo", definitions: [] },
      { rafsi: "lal", gismu: "lanli", definitions: [] },
      { rafsi: "tci", gismu: "tutci", definitions: [] },
    ]);
    expect(client.getDefinitions).not.toHaveBeenCalled();
  });
});

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

  it("sets usedExperimentalGrammar: false for input the standard grammar already accepts", async () => {
    const cache = new FakeCache();
    const client = fakeClient();

    const result = await analyze("ti melbi", { cache, client });

    expect(result.usedExperimentalGrammar).toBe(false);
  });

  it("falls back to camxes-exp for an experimental cmavo the standard grammar rejects, flagging the result", async () => {
    const cache = new FakeCache();
    const client = fakeClient();

    const result = await analyze("ue'i", { cache, client });

    expect(result.usedExperimentalGrammar).toBe(true);
    expect(result.terms).toEqual([
      {
        index: 0,
        selmaho: "UI",
        word: "ue'i",
        valsi: fakeValsi("ue'i", 1),
        definitions: fakeDefinitions("ue'i"),
        lujvoComponents: null,
      },
    ]);
  });

  it("still throws LojbanSyntaxError, without calling the client, for input invalid under camxes-exp too", async () => {
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

  describe("word-list fallback (ADR 006)", () => {
    it("still throws LojbanSyntaxError for ungrammatical input when allowWordListFallback is off (the default)", async () => {
      const cache = new FakeCache();
      const client = fakeClient();

      await expect(analyze("a'oi", { cache, client })).rejects.toThrow(LojbanSyntaxError);
      expect(client.getValsi).not.toHaveBeenCalled();
    });

    it("falls back to a per-word dictionary lookup when neither grammar can parse the text, flagging the result", async () => {
      const cache = new FakeCache();
      const client = fakeClient({
        getValsi: async (word) =>
          word === "a'oi"
            ? { valsiid: 1, word: "a'oi", type_name: "experimental cmavo", rafsi: null, source_langid: 1 }
            : null,
      });

      const result = await analyze("a'oi", { cache, client, allowWordListFallback: true });

      expect(result.usedWordListFallback).toBe(true);
      expect(result.usedExperimentalGrammar).toBe(false);
      expect(result.terms).toEqual([
        {
          index: 0,
          selmaho: "experimental cmavo", // fakeDefinitions() never sets a selmaho -- see the next test
          word: "a'oi",
          valsi: { valsiid: 1, word: "a'oi", type_name: "experimental cmavo", rafsi: null, source_langid: 1 },
          definitions: fakeDefinitions("a'oi"),
          lujvoComponents: null,
        },
      ]);
    });

    it("uses the word's own selmaho from its definitions when one is available", async () => {
      const cache = new FakeCache();
      const client = fakeClient({
        getValsi: async () => ({
          valsiid: 1,
          word: "a'oi",
          type_name: "experimental cmavo",
          rafsi: null,
          source_langid: 1,
        }),
        getDefinitions: async () => {
          const [definition] = fakeDefinitions("a'oi");
          if (!definition) throw new Error("fakeDefinitions returned none");
          return [{ ...definition, selmaho: "COI" }];
        },
      });

      const result = await analyze("a'oi", { cache, client, allowWordListFallback: true });

      expect(result.terms[0]?.selmaho).toBe("COI");
    });

    it("still splits a compound cmavo token (e.g. u'isai = u'i + sai) that's grammatical on its own, rather than treating it as one unresolved word", async () => {
      const cache = new FakeCache();
      const client = fakeClient({
        getValsi: async (word) =>
          word === "a'oi"
            ? { valsiid: 1, word: "a'oi", type_name: "experimental cmavo", rafsi: null, source_langid: 1 }
            : fakeValsi(word, 1),
      });

      // "a'oi u'isai" fails to parse as a whole (a'oi isn't in either
      // grammar's cmavo list), but "u'isai" on its own is grammatical --
      // it shouldn't be swallowed into a single "(no dictionary entry)" term.
      const result = await analyze("a'oi u'isai", { cache, client, allowWordListFallback: true });

      expect(result.usedWordListFallback).toBe(true);
      expect(result.terms.map((t) => [t.selmaho, t.word])).toEqual([
        ["experimental cmavo", "a'oi"], // fakeDefinitions() never sets a selmaho -- see the dedicated test for that mapping
        ["UI", "u'i"],
        ["CAI", "sai"],
      ]);
      expect(result.terms.every((t) => t.valsi !== null)).toBe(true);
    });

    it("still decomposes an undocumented lujvo found this way", async () => {
      const cache = new FakeCache();
      const client = fakeClient({
        getValsi: async (word) => (word === "jbolaltci" ? null : fakeValsi(word, 1)),
      });

      const result = await analyze("### jbolaltci ###", { cache, client, allowWordListFallback: true });

      expect(result.usedWordListFallback).toBe(true);
      const lujvoTerm = result.terms.find((term) => term.word === "jbolaltci");
      expect(lujvoTerm?.selmaho).toBe("L");
      expect(lujvoTerm?.lujvoComponents).toEqual([
        { rafsi: "jbo", gismu: "lojbo", definitions: fakeDefinitions("lojbo") },
        { rafsi: "lal", gismu: "lanli", definitions: fakeDefinitions("lanli") },
        { rafsi: "tci", gismu: "tutci", definitions: fakeDefinitions("tutci") },
      ]);
    });

    it("shows whatever resolved even when some words in the text are not found (best-effort, not all-or-nothing)", async () => {
      const cache = new FakeCache();
      const client = fakeClient({
        getValsi: async (word) =>
          word === "a'oi"
            ? { valsiid: 1, word: "a'oi", type_name: "experimental cmavo", rafsi: null, source_langid: 1 }
            : null,
      });

      const result = await analyze("a'oi zzzznotaword", { cache, client, allowWordListFallback: true });

      expect(result.terms).toHaveLength(2);
      expect(result.terms[0]?.valsi).not.toBeNull();
      expect(result.terms[1]).toMatchObject({ word: "zzzznotaword", selmaho: "?", valsi: null });
    });

    it("guesses selmaho C (matching camxes' own cmevla rule) for an unresolved capitalized word, without counting it as a real resolution", async () => {
      const cache = new FakeCache();
      const client = fakeClient({
        getValsi: async (word) =>
          word === "coi" ? { valsiid: 1, word: "coi", type_name: "cmavo", rafsi: null, source_langid: 1 } : null,
      });

      const result = await analyze("coi Zzqx", { cache, client, allowWordListFallback: true });

      const nameTerm = result.terms.find((term) => term.word === "Zzqx");
      expect(nameTerm).toMatchObject({ selmaho: "C", valsi: null });
    });

    it("still throws the original LojbanSyntaxError when nothing in the text resolves to anything real", async () => {
      const cache = new FakeCache();
      const client = fakeClient({ getValsi: async () => null });

      await expect(analyze("###invalid###", { cache, client, allowWordListFallback: true })).rejects.toThrow(
        LojbanSyntaxError,
      );
    });
  });
});

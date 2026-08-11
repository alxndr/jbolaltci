import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyze.js";
import { LensiskuClient } from "../src/dictionary/lensiskuClient.js";
import type { DictionaryCache } from "../src/cache/cache.js";
import type { Valsi, ValsiDefinition } from "../src/dictionary/types.js";

// Hits the real, public lensisku API. Documents the contract this library
// actually depends on. Opt-in via RUN_LIVE_TESTS=1 so the rest of the suite
// stays fast/deterministic and works offline/in CI without network access.
const runLiveTests = process.env.RUN_LIVE_TESTS === "1";

class InMemoryCache implements DictionaryCache {
  private valsi = new Map<string, Valsi | null>();
  private definitions = new Map<string, ValsiDefinition[]>();
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

describe.skipIf(!runLiveTests)("live lensisku API", () => {
  it("LensiskuClient.getValsi resolves jimpe to the known gismu record", async () => {
    const client = new LensiskuClient();
    const valsi = await client.getValsi("jimpe");
    expect(valsi).toMatchObject({ valsiid: 493, word: "jimpe", type_name: "gismu" });
  });

  it("analyze() resolves every word of a real sentence against the live dictionary", async () => {
    const result = await analyze("mi tavla do fi la .lojban.", { cache: new InMemoryCache() });

    const tavla = result.terms.find((term) => term.word === "tavla");
    expect(tavla?.valsi?.type_name).toBe("gismu");
    expect(tavla?.definitions.length).toBeGreaterThan(0);

    // "lojban" here is a name (cmevla), which legitimately has no dictionary
    // entry of its own -- a null valsi is the expected, correct outcome.
    const lojban = result.terms.find((term) => term.word === "lojban");
    expect(lojban).toBeDefined();
  });
});

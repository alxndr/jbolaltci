import { afterEach, describe, expect, it, vi } from "vitest";
import { LensiskuApiError, LensiskuClient } from "../src/dictionary/lensiskuClient.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("LensiskuClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getValsi fetches the word endpoint and returns the valsi record", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("https://lensisku.lojban.org/api/jbovlaste/valsi/jimpe");
      return jsonResponse({
        valsi: { valsiid: 493, word: "jimpe", type_name: "gismu", rafsi: "    jmi", source_langid: 1 },
      });
    });
    const client = new LensiskuClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.getValsi("jimpe");

    expect(result).toEqual({ valsiid: 493, word: "jimpe", type_name: "gismu", rafsi: "    jmi", source_langid: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("getValsi URL-encodes the word, preserving apostrophes", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("https://lensisku.lojban.org/api/jbovlaste/valsi/a'a");
      return jsonResponse({ valsi: { valsiid: 1340, word: "a'a", type_name: "cmavo", rafsi: null, source_langid: 1 } });
    });
    const client = new LensiskuClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.getValsi("a'a");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("getValsi returns null on a 404 (unknown word)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ detail: "not found" }, 404));
    const client = new LensiskuClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.getValsi("xyzzy");

    expect(result).toBeNull();
  });

  it("getValsi throws LensiskuApiError on an unexpected error status", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));
    const client = new LensiskuClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.getValsi("jimpe")).rejects.toThrow(LensiskuApiError);
  });

  it("getDefinitions fetches the definitions endpoint and returns the array", async () => {
    const definitions = [
      { definitionid: 493, valsiword: "jimpe", valsiid: 493, langid: 2, langrealname: "English", definition: "x1 understands...", notes: null, selmaho: null, type_name: "gismu", rafsi: "    jmi", gloss_keywords: null },
    ];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("https://lensisku.lojban.org/api/jbovlaste/valsi/jimpe/definitions");
      return jsonResponse(definitions);
    });
    const client = new LensiskuClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.getDefinitions("jimpe");

    expect(result).toEqual(definitions);
  });

  it("getDefinitions returns an empty array on a 404", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ detail: "not found" }, 404));
    const client = new LensiskuClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.getDefinitions("xyzzy");

    expect(result).toEqual([]);
  });

  it("defaults to the real lensisku base URL when none is given", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL) => jsonResponse({ valsi: null }));
    const client = new LensiskuClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.getValsi("lo");

    const calledUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(calledUrl.startsWith("https://lensisku.lojban.org/api/")).toBe(true);
  });
});

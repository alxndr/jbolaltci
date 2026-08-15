import { MapDictionaryCache } from "./cache/mapCache.js";
import { LensiskuClient } from "./dictionary/lensiskuClient.js";
import { analyzeCore } from "./analyzeCore.js";
import type { AnalyzeOptions, AnalyzeResult } from "./analyzeCore.js";
import { parseTrimmed } from "./parser/camxes.browser.js";

export type {
  AnalyzeOptions,
  AnalyzeResult,
  AnnotatedLujvoComponent,
  AnnotatedTerm,
  DictionaryLookup,
} from "./analyzeCore.js";

export { parseRaw, parseTrimmed } from "./parser/camxes.browser.js";
export { LojbanSyntaxError } from "./parser/lojbanSyntaxError.js";
export { extractTerms } from "./parser/extractTerms.js";
export type { Term, TrimmedNode } from "./parser/types.js";

export { LensiskuApiError, LensiskuClient } from "./dictionary/lensiskuClient.js";
export type { LensiskuClientOptions } from "./dictionary/lensiskuClient.js";
export type { Valsi, ValsiDefinition } from "./dictionary/types.js";

export type { DictionaryCache } from "./cache/cache.js";
export { MapDictionaryCache } from "./cache/mapCache.js";

export { decomposeLujvo, NotLujvoError } from "./lujvo/decompose.js";
export type { LujvoComponent } from "./lujvo/decompose.js";

/** Browser-facing analyze(): defaults to an in-memory MapDictionaryCache
 * (see docs/architecture-decisions/001) and a real LensiskuClient, with
 * camxes loaded from globals (window.camxes / window.camxes_postprocessing)
 * instead of Node's createRequire. See analyze.ts for the Node equivalent. */
export async function analyze(text: string, opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const cache = opts.cache ?? new MapDictionaryCache();
  const client = opts.client ?? new LensiskuClient();
  return analyzeCore(text, { parseTrimmed, cache, client, includeDefinitions: opts.includeDefinitions });
}

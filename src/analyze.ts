import { SqliteDictionaryCache } from "./cache/sqliteCache.js";
import { LensiskuClient } from "./dictionary/lensiskuClient.js";
import { analyzeCore } from "./analyzeCore.js";
import type { AnalyzeOptions, AnalyzeResult } from "./analyzeCore.js";
import { parseTrimmed } from "./parser/camxes.node.js";

export type {
  AnalyzeOptions,
  AnalyzeResult,
  AnnotatedLujvoComponent,
  AnnotatedTerm,
  DictionaryLookup,
} from "./analyzeCore.js";

/** Node-facing analyze(): defaults to a file-backed SqliteDictionaryCache and
 * a real LensiskuClient. See browser.ts for the browser-facing equivalent
 * (in-memory cache, camxes loaded from globals instead of createRequire). */
export async function analyze(text: string, opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const cache = opts.cache ?? new SqliteDictionaryCache();
  const client = opts.client ?? new LensiskuClient();
  return analyzeCore(text, { parseTrimmed, cache, client, includeDefinitions: opts.includeDefinitions });
}

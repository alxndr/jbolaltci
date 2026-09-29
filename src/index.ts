export { analyze } from "./analyze.js";
export type {
  AnalyzeOptions,
  AnalyzeResult,
  AnnotatedLujvoComponent,
  AnnotatedTerm,
  DictionaryLookup,
} from "./analyze.js";

export {
  parseRaw,
  parseTrimmed,
  parseTrimmedExperimental,
  parseLabeledTree,
  parseLabeledTreeExperimental,
} from "./parser/camxes.node.js";
export { LojbanSyntaxError } from "./parser/lojbanSyntaxError.js";
export { extractTerms } from "./parser/extractTerms.js";
export { parseWithFallback } from "./parser/parseWithFallback.js";
export { LABELED_NODE_ROLES } from "./parser/types.js";
export type { LabeledNodeRole, Term, TrimmedNode } from "./parser/types.js";

export { LensiskuApiError, LensiskuClient } from "./dictionary/lensiskuClient.js";
export type { LensiskuClientOptions } from "./dictionary/lensiskuClient.js";
export type { Valsi, ValsiDefinition } from "./dictionary/types.js";

export type { DictionaryCache } from "./cache/cache.js";
export { defaultCachePath, SqliteDictionaryCache } from "./cache/sqliteCache.js";
export type { SqliteDictionaryCacheOptions } from "./cache/sqliteCache.js";

export { decomposeLujvo, NotLujvoError } from "./lujvo/decompose.js";
export type { LujvoComponent } from "./lujvo/decompose.js";

/** A word/valsi record from lensisku's jbovlaste-backed dictionary. */
export interface Valsi {
  readonly valsiid: number;
  readonly word: string;
  readonly type_name: string;
  readonly rafsi: string | null;
  readonly source_langid: number;
}

/** A single gloss/definition of a valsi in one language. Lensisku returns
 * many more fields than this (voting metadata, sound URLs, embeddings...);
 * only the ones a consumer is likely to actually use are given precise
 * types, the rest are passed through as unknown. */
export interface ValsiDefinition {
  readonly definitionid: number;
  readonly valsiword: string;
  readonly valsiid: number;
  readonly langid: number;
  readonly langrealname: string;
  readonly definition: string;
  readonly notes: string | null;
  readonly selmaho: string | null;
  readonly type_name: string;
  readonly rafsi: string | null;
  readonly gloss_keywords: ReadonlyArray<{ word: string; meaning: string | null }> | null;
  readonly [extra: string]: unknown;
}

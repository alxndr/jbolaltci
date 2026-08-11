import type { DictionaryCache } from "./cache/cache.js";
import { SqliteDictionaryCache } from "./cache/sqliteCache.js";
import type { Valsi, ValsiDefinition } from "./dictionary/types.js";
import { LensiskuClient } from "./dictionary/lensiskuClient.js";
import { parseTrimmed } from "./parser/camxes.js";
import { extractTerms } from "./parser/extractTerms.js";
import type { Term, TrimmedNode } from "./parser/types.js";

/** The subset of LensiskuClient that analyze() depends on, so callers can
 * substitute a fake in tests without a real client instance. */
export interface DictionaryLookup {
  getValsi(word: string): Promise<Valsi | null>;
  getDefinitions(word: string): Promise<ValsiDefinition[]>;
}

export interface AnnotatedTerm extends Term {
  readonly valsi: Valsi | null;
  readonly definitions: ValsiDefinition[];
}

export interface AnalyzeResult {
  readonly input: string;
  readonly parseTree: TrimmedNode[];
  readonly terms: AnnotatedTerm[];
}

export interface AnalyzeOptions {
  readonly cache?: DictionaryCache;
  readonly client?: DictionaryLookup;
  /** Whether to fetch each word's glosses in addition to its valsi record. Default true. */
  readonly includeDefinitions?: boolean;
}

interface WordLookup {
  readonly valsi: Valsi | null;
  readonly definitions: ValsiDefinition[];
}

/** Parses Lojban text with camxes, extracts its words in reading order, and
 * annotates each with a cache-first lookup against the lensisku dictionary
 * (falling back to a live API call, and populating the cache, on a miss).
 * Throws LojbanSyntaxError if the text is not grammatical Lojban. */
export async function analyze(text: string, opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const cache = opts.cache ?? new SqliteDictionaryCache();
  const client = opts.client ?? new LensiskuClient();
  const includeDefinitions = opts.includeDefinitions ?? true;

  const parseTree = parseTrimmed(text);
  const terms = extractTerms(parseTree);

  const uniqueWords = [...new Set(terms.map((term) => term.word))];
  const lookedUp = await Promise.all(
    uniqueWords.map(
      async (word) => [word, await lookupWord(word, cache, client, includeDefinitions)] as const,
    ),
  );
  const lookups = new Map(lookedUp);

  const annotatedTerms: AnnotatedTerm[] = terms.map((term) => {
    const lookup = lookups.get(term.word) as WordLookup;
    return { ...term, valsi: lookup.valsi, definitions: lookup.definitions };
  });

  return { input: text, parseTree, terms: annotatedTerms };
}

async function lookupWord(
  word: string,
  cache: DictionaryCache,
  client: DictionaryLookup,
  includeDefinitions: boolean,
): Promise<WordLookup> {
  let valsi = cache.getValsi(word);
  if (valsi === undefined) {
    valsi = await client.getValsi(word);
    cache.setValsi(word, valsi);
  }

  let definitions: ValsiDefinition[] = [];
  if (includeDefinitions && valsi !== null) {
    let cached = cache.getDefinitions(word);
    if (cached === undefined) {
      cached = await client.getDefinitions(word);
      cache.setDefinitions(word, cached);
    }
    definitions = cached;
  }

  return { valsi, definitions };
}

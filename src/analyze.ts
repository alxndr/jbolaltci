import type { DictionaryCache } from "./cache/cache.js";
import { SqliteDictionaryCache } from "./cache/sqliteCache.js";
import type { Valsi, ValsiDefinition } from "./dictionary/types.js";
import { LensiskuClient } from "./dictionary/lensiskuClient.js";
import { decomposeLujvo, NotLujvoError } from "./lujvo/decompose.js";
import type { LujvoComponent } from "./lujvo/decompose.js";
import { parseTrimmed } from "./parser/camxes.js";
import { extractTerms } from "./parser/extractTerms.js";
import type { Term, TrimmedNode } from "./parser/types.js";

/** The subset of LensiskuClient that analyze() depends on, so callers can
 * substitute a fake in tests without a real client instance. */
export interface DictionaryLookup {
  getValsi(word: string): Promise<Valsi | null>;
  getDefinitions(word: string): Promise<ValsiDefinition[]>;
}

export interface AnnotatedLujvoComponent extends LujvoComponent {
  /** Definitions of `gismu`, empty if `gismu` is null or nothing was found. */
  readonly definitions: ValsiDefinition[];
}

export interface AnnotatedTerm extends Term {
  readonly valsi: Valsi | null;
  readonly definitions: ValsiDefinition[];
  /** Set only for a lujvo term with no dictionary entry of its own (selma'o
   * "L" and valsi null): its rafsi, each resolved to its source gismu's
   * definitions. Null otherwise -- including for a lujvo that does have its
   * own dictionary entry, where decomposition would be redundant. */
  readonly lujvoComponents: AnnotatedLujvoComponent[] | null;
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

  // A lujvo with no dictionary entry of its own gets decomposed into its
  // rafsi, each resolved to its source gismu -- which then needs its own
  // definitions lookup, exactly like any other term above.
  const rawComponentsByWord = new Map<string, LujvoComponent[] | null>();
  for (const term of terms) {
    if (term.selmaho !== "L" || rawComponentsByWord.has(term.word)) continue;
    if (lookups.get(term.word)?.valsi !== null) continue;
    try {
      rawComponentsByWord.set(term.word, decomposeLujvo(term.word));
    } catch (err) {
      if (err instanceof NotLujvoError) rawComponentsByWord.set(term.word, null);
      else throw err;
    }
  }

  const componentGismu = [
    ...new Set(
      [...rawComponentsByWord.values()].flatMap((components) =>
        (components ?? []).flatMap((c) => (c.gismu !== null ? [c.gismu] : [])),
      ),
    ),
  ];
  const gismuLookups = new Map(
    await Promise.all(
      componentGismu.map(
        async (gismu) => [gismu, await lookupWord(gismu, cache, client, includeDefinitions)] as const,
      ),
    ),
  );

  const lujvoComponentsByWord = new Map<string, AnnotatedLujvoComponent[] | null>();
  for (const [word, components] of rawComponentsByWord) {
    lujvoComponentsByWord.set(
      word,
      components === null
        ? null
        : components.map((c) => ({ ...c, definitions: c.gismu !== null ? (gismuLookups.get(c.gismu)?.definitions ?? []) : [] })),
    );
  }

  const annotatedTerms: AnnotatedTerm[] = terms.map((term) => {
    const lookup = lookups.get(term.word) as WordLookup;
    return {
      ...term,
      valsi: lookup.valsi,
      definitions: lookup.definitions,
      lujvoComponents: lujvoComponentsByWord.get(term.word) ?? null,
    };
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

import type { DictionaryCache } from "./cache/cache.js";
import type { Valsi, ValsiDefinition } from "./dictionary/types.js";
import { decomposeLujvo, NotLujvoError } from "./lujvo/decompose.js";
import type { LujvoComponent } from "./lujvo/decompose.js";
import { extractTerms } from "./parser/extractTerms.js";
import { LojbanSyntaxError } from "./parser/lojbanSyntaxError.js";
import { parseWithFallback } from "./parser/parseWithFallback.js";
import { tokenizeWords } from "./parser/tokenizeWords.js";
import type { Term, TrimmedNode } from "./parser/types.js";

/** The subset of a dictionary client that analyzeCore() depends on, so
 * callers can substitute a fake in tests without a real client instance. */
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
  /** True if standard camxes rejected this input and camxes-exp (see ADR
   * 003) parsed it instead. camxes-exp isn't purely additive vocabulary --
   * it carries real grammar changes of its own -- so a true here means the
   * whole parse, not just whatever experimental cmavo triggered the
   * fallback, may not match standard Lojban grammar. */
  readonly usedExperimentalGrammar: boolean;
  /** True if neither grammar could parse this text at all, and `terms` was
   * instead built from a naive whitespace split with each word looked up
   * against lensisku directly (see ADR 006). `parseTree` in this case is a
   * flat list of synthesized leaves, not a real grammatical structure --
   * there's no sentence/selbri/sumti nesting to show for it. Only ever true
   * when `AnalyzeOptions.allowWordListFallback` was set. */
  readonly usedWordListFallback: boolean;
}

export interface AnalyzeOptions {
  readonly cache?: DictionaryCache;
  readonly client?: DictionaryLookup;
  /** Whether to fetch each word's glosses in addition to its valsi record. Default true. */
  readonly includeDefinitions?: boolean;
  /** Whether to fall back to a naive word-list lookup (see ADR 006) when
   * neither grammar can parse the text at all. Off by default: unlike the
   * camxes-exp fallback (ADR 003), this tier can "succeed" on text with no
   * proven grammatical structure whatsoever, so a caller has to opt in. */
  readonly allowWordListFallback?: boolean;
}

/** Platform-specific dependencies analyzeCore() needs but doesn't default
 * itself -- each platform wrapper (analyze.ts for Node, browser.ts for the
 * browser) supplies its own parseTrimmed/parseTrimmedExperimental/cache/client. */
export interface AnalyzeCoreDeps {
  readonly parseTrimmed: (text: string) => TrimmedNode[];
  /** Omit to disable the experimental-cmavo fallback entirely (see ADR 003) --
   * ungrammatical-per-camxes-exp-too input then throws parseTrimmed's error
   * as before, with no fallback attempt. */
  readonly parseTrimmedExperimental?: (text: string) => TrimmedNode[];
  readonly cache: DictionaryCache;
  readonly client: DictionaryLookup;
  readonly includeDefinitions?: boolean;
  readonly allowWordListFallback?: boolean;
}

interface WordLookup {
  readonly valsi: Valsi | null;
  readonly definitions: ValsiDefinition[];
}

/** Parses Lojban text with camxes, extracts its words in reading order, and
 * annotates each with a cache-first lookup against the lensisku dictionary
 * (falling back to a live API call, and populating the cache, on a miss).
 * Throws LojbanSyntaxError if the text is not grammatical Lojban.
 *
 * Platform-agnostic core with no defaults of its own -- see analyze.ts (Node)
 * and browser.ts (browser) for the wrappers that supply parseTrimmed/cache/client. */
export async function analyzeCore(text: string, deps: AnalyzeCoreDeps): Promise<AnalyzeResult> {
  // parseTrimmed is deliberately not destructured here: parsing goes through
  // parseWithFallback below, which reads it off deps itself.
  const { cache, client } = deps;
  const includeDefinitions = deps.includeDefinitions ?? true;

  let parseTree: TrimmedNode[];
  let terms: Term[];
  let usedExperimentalGrammar = false;
  let usedWordListFallback = false;

  try {
    const parsed = parseWithFallback(text, deps.parseTrimmed, deps.parseTrimmedExperimental);
    parseTree = parsed.result;
    usedExperimentalGrammar = parsed.usedExperimentalGrammar;
    terms = extractTerms(parseTree);
  } catch (err) {
    if (!(err instanceof LojbanSyntaxError) || !deps.allowWordListFallback) throw err;
    const fallback = await buildWordListFallback(
      text,
      deps.parseTrimmed,
      deps.parseTrimmedExperimental,
      cache,
      client,
      includeDefinitions,
    );
    if (fallback === null) throw err;
    parseTree = fallback.parseTree;
    terms = fallback.terms;
    usedWordListFallback = true;
  }

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

  return { input: text, parseTree, terms: annotatedTerms, usedExperimentalGrammar, usedWordListFallback };
}

/** The word-list fallback tier (see ADR 006): every other option exhausted,
 * takes the text apart with a naive whitespace split (not real Lojban
 * morphology) and resolves each resulting token one of two ways:
 *
 * 1. The token might still be grammatical entirely on its own, even though
 *    the full text wasn't -- e.g. "u'isai" (a compound of the cmavo "u'i"
 *    and "sai" written with no space) fails to parse as part of a sentence
 *    containing some *other*, genuinely ungrammatical word, but parses fine
 *    by itself. Reusing the real grammar's own tokenization here (instead of
 *    treating the whole token as one opaque dictionary word) is what lets a
 *    token like that still come out as two properly selma'o-tagged terms
 *    rather than a single unrecognized blob.
 * 2. Only if that fails too does it fall back to looking the raw token up
 *    against lensisku directly, for real single words the grammar doesn't
 *    recognize at all (e.g. `a'oi` -- see ADR 006's own motivating case).
 *
 * Returns null -- signalling the caller should give up and surface the
 * original LojbanSyntaxError instead -- if nothing in the text resolved to
 * anything real (grammatically confirmed on its own, a dictionary entry, or
 * a successful lujvo decomposition); otherwise returns every token as a
 * Term, including ones that stayed unresolved, so the caller can show a real
 * result for the parts that did work rather than an all-or-nothing failure. */
async function buildWordListFallback(
  text: string,
  parseTrimmed: (text: string) => TrimmedNode[],
  parseTrimmedExperimental: ((text: string) => TrimmedNode[]) | undefined,
  cache: DictionaryCache,
  client: DictionaryLookup,
  includeDefinitions: boolean,
): Promise<{ parseTree: TrimmedNode[]; terms: Term[] } | null> {
  const tokens = tokenizeWords(text);
  if (tokens.length === 0) return null;

  let anyRealResolution = false;
  const terms: Term[] = [];
  const leaves: TrimmedNode[] = [];

  for (const token of tokens) {
    const subTerms = tryParseStandalone(token, parseTrimmed, parseTrimmedExperimental);
    if (subTerms !== null && subTerms.length > 0) {
      anyRealResolution = true;
      for (const subTerm of subTerms) {
        terms.push({ index: terms.length, selmaho: subTerm.selmaho, word: subTerm.word });
        leaves.push(`${subTerm.selmaho}:${subTerm.word}`);
      }
      continue;
    }

    const { valsi, definitions } = await lookupWord(token, cache, client, includeDefinitions);
    let selmaho: string;
    if (valsi !== null) {
      anyRealResolution = true;
      selmaho = fallbackSelmaho(valsi, definitions);
    } else {
      let isLujvo = false;
      try {
        decomposeLujvo(token);
        isLujvo = true;
      } catch (err) {
        if (!(err instanceof NotLujvoError)) throw err;
      }
      if (isLujvo) {
        anyRealResolution = true;
        selmaho = "L";
      } else if (/^\p{Lu}/u.test(token)) {
        // A guess, not a confirmed classification -- matches camxes' own
        // cmevla rule (an initial capital letter), but lensisku has no entry
        // to back it up, so it doesn't count toward anyRealResolution.
        selmaho = "C";
      } else {
        selmaho = "?";
      }
    }
    terms.push({ index: terms.length, selmaho, word: token });
    leaves.push(`${selmaho}:${token}`);
  }

  return anyRealResolution ? { parseTree: leaves, terms } : null;
}

/** Tries parsing a single whitespace-delimited token as a standalone
 * utterance of its own, under whichever grammar accepts it. Null means
 * neither grammar recognizes it on its own either -- not a bug, just signals
 * the caller to fall back to a raw dictionary lookup for this token instead. */
function tryParseStandalone(
  token: string,
  parseTrimmed: (text: string) => TrimmedNode[],
  parseTrimmedExperimental: ((text: string) => TrimmedNode[]) | undefined,
): Term[] | null {
  try {
    const { result } = parseWithFallback(token, parseTrimmed, parseTrimmedExperimental);
    return extractTerms(result);
  } catch (err) {
    if (err instanceof LojbanSyntaxError) return null;
    throw err;
  }
}

/** Maps a lensisku valsi to the same single-letter/selma'o codes
 * camxes_postproc.js's own trimmed tree uses, so a word-list-fallback term
 * displays consistently with one that came from a real grammatical parse.
 * Cmavo-family words (whose type_name varies -- "cmavo", "experimental
 * cmavo", conceivably others) use their own definitions' selmaho field
 * directly, since lensisku already names those the same way camxes does
 * ("COI", "UI", ...) -- falling back to the literal type_name if no
 * definition carries one (e.g. includeDefinitions was off). */
function fallbackSelmaho(valsi: Valsi, definitions: ValsiDefinition[]): string {
  if (valsi.type_name === "gismu") return "G";
  if (valsi.type_name === "lujvo") return "L";
  if (valsi.type_name === "cmevla") return "C";
  return definitions[0]?.selmaho ?? valsi.type_name;
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

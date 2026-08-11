import type { Valsi, ValsiDefinition } from "../dictionary/types.js";

/**
 * A cache for lensisku dictionary lookups, keyed by word text.
 *
 * `undefined` means "never looked up" (a true cache miss); `null` for a
 * valsi means "looked up, and lensisku has no entry for this word" (a
 * cached negative result — e.g. a proper name). Both are distinct from a
 * cache miss so callers can avoid re-querying the live API for words that
 * are legitimately absent from the dictionary.
 */
export interface DictionaryCache {
  getValsi(word: string): Valsi | null | undefined;
  setValsi(word: string, value: Valsi | null): void;
  getDefinitions(word: string): ValsiDefinition[] | undefined;
  setDefinitions(word: string, value: ValsiDefinition[]): void;
}

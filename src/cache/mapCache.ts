import type { DictionaryCache } from "./cache.js";
import type { Valsi, ValsiDefinition } from "../dictionary/types.js";

/** In-memory DictionaryCache, scoped to this instance's lifetime -- no
 * persistence across instances/reloads. See docs/architecture-decisions/001. */
export class MapDictionaryCache implements DictionaryCache {
  private readonly valsi = new Map<string, Valsi | null>();
  private readonly definitions = new Map<string, ValsiDefinition[]>();

  getValsi(word: string): Valsi | null | undefined {
    return this.valsi.has(word) ? this.valsi.get(word) : undefined;
  }

  setValsi(word: string, value: Valsi | null): void {
    this.valsi.set(word, value);
  }

  getDefinitions(word: string): ValsiDefinition[] | undefined {
    return this.definitions.has(word) ? this.definitions.get(word) : undefined;
  }

  setDefinitions(word: string, value: ValsiDefinition[]): void {
    this.definitions.set(word, value);
  }
}

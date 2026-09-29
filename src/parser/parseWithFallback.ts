import { LojbanSyntaxError } from "./lojbanSyntaxError.js";

/** Tries `standard` first; only on a LojbanSyntaxError, and only if
 * `experimental` was supplied, retries with it (camxes-exp, see ADR 003). If
 * that also fails, re-throws the *standard* grammar's error -- it's the more
 * useful message for genuinely invalid input, since camxes-exp's error
 * wording/position can differ for reasons unrelated to what the caller
 * actually got wrong. Generic over the parse function's return type so both
 * analyzeCore() and any other camxes-exp-fallback-shaped parse (e.g. the
 * labeled/nesting tree) share this exact fallback semantics. */
export function parseWithFallback<T>(
  text: string,
  standard: (text: string) => T,
  experimental: ((text: string) => T) | undefined,
): { result: T; usedExperimentalGrammar: boolean } {
  try {
    return { result: standard(text), usedExperimentalGrammar: false };
  } catch (err) {
    if (!(err instanceof LojbanSyntaxError) || !experimental) throw err;
    try {
      return { result: experimental(text), usedExperimentalGrammar: true };
    } catch {
      throw err;
    }
  }
}

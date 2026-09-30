/** Splits Lojban text into its whitespace-delimited words, stripping each
 * one's leading/trailing sentence punctuation (`. , ? !`) -- matching how
 * camxes_postproc.js itself reports a cmevla's word text without its
 * surrounding pause-marking periods (e.g. ".lojban." -> "lojban").
 *
 * This is a naive, non-grammatical split -- it doesn't know Lojban
 * morphology, just orthography's rule that words are separated by pauses
 * (whitespace, or these punctuation marks). Used only by the word-list
 * fallback tier (see ADR 006): a best-effort dictionary lookup for text
 * neither camxes grammar could parse at all. */
export function tokenizeWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[.,?!]+|[.,?!]+$/g, ""))
    .filter((token) => token.length > 0);
}

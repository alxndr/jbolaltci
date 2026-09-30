import {
  analyze,
  decomposeLujvo,
  LABELED_NODE_ROLES,
  LensiskuClient,
  LojbanSyntaxError,
  NotLujvoError,
  parseLabeledTree,
  parseLabeledTreeExperimental,
} from "../src/browser.js";
import type { AnalyzeResult, AnnotatedLujvoComponent, AnnotatedTerm, LabeledNodeRole, TrimmedNode } from "../src/browser.js";
import type { ValsiDefinition } from "../src/browser.js";

const form = document.getElementById("analyze-form") as HTMLFormElement;
const textarea = document.getElementById("lojban-input") as HTMLTextAreaElement;
const errorBox = document.getElementById("error-message") as HTMLElement;
const experimentalGrammarNotice = document.getElementById("experimental-grammar-notice") as HTMLElement;
const wordListFallbackNotice = document.getElementById("word-list-fallback-notice") as HTMLElement;
const dictionaryStatus = document.getElementById("dictionary-status") as HTMLElement;
const resultsTable = document.getElementById("results-table") as HTMLTableElement;
const resultsBody = document.getElementById("results-body") as HTMLTableSectionElement;
const nestingSection = document.getElementById("nesting-section") as HTMLElement;
const nestingContainer = document.getElementById("nesting-boxes") as HTMLElement;

function showError(message: string): void {
  errorBox.textContent = message;
  errorBox.hidden = false;
  resultsTable.hidden = true;
}

function hideError(): void {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

// camxes-exp isn't purely additive vocabulary -- it carries real grammar
// changes of its own (see docs/architecture-decisions/003) -- so a result
// that used it may not match standard Lojban grammar beyond just the word
// that triggered the fallback. Surface that rather than presenting it as an
// ordinary result.
function setExperimentalGrammarNotice(used: boolean): void {
  experimentalGrammarNotice.textContent = used
    ? "This includes an experimental cmavo not in standard Lojban -- the rest of this parse may not match standard grammar either."
    : "";
  experimentalGrammarNotice.hidden = !used;
}

// Neither grammar could parse this text as a whole (see ADR 006) -- what's
// shown instead is a plain per-word dictionary lookup, with no proof the
// text is a grammatical sentence at all. Any word not in the dictionary
// either shows "(no dictionary entry)" or, if it looked capitalized, a
// guessed "name: ..." -- both same as an ordinary result already would.
function setWordListFallbackNotice(used: boolean): void {
  wordListFallbackNotice.textContent = used
    ? "Couldn't parse this as a full grammatical sentence -- showing what each word means on its own instead."
    : "";
  wordListFallbackNotice.hidden = !used;
}

function englishDefinitionText(definitions: readonly ValsiDefinition[]): string | null {
  return definitions.find((d) => d.langrealname === "English")?.definition ?? null;
}

function lensiskuEntryUrl(word: string): string {
  return `https://lensisku.lojban.org/en/valsi/${encodeURIComponent(word)}`;
}

// Only ever called for a word known to have a real lensisku entry (a
// non-null term.valsi, or a lujvo component that resolved to a real gismu) --
// linking any other word 404s there (verified against the live site), so
// callers must check that themselves rather than this function guessing.
function appendLensiskuLink(container: HTMLElement, word: string): void {
  const link = document.createElement("a");
  link.href = lensiskuEntryUrl(word);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = word;
  container.appendChild(link);
}

// lensisku's English definitions write place structure as raw LaTeX-ish
// placeholders; render those as italic x with a subscript instead of
// showing the markup verbatim. The brace form isn't consistently used
// across entries -- e.g. "tavla" writes "$x_{1}$", "culno" writes "$x_1$"
// -- so both need matching.
const PLACE_PLACEHOLDER = /\$x_\{?(\d+)\}?\$/g;

function appendFormattedDefinition(container: HTMLElement, text: string): void {
  let lastIndex = 0;
  for (const match of text.matchAll(PLACE_PLACEHOLDER)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, index)));
    }
    const place = document.createElement("i");
    place.appendChild(document.createTextNode("x"));
    const sub = document.createElement("sub");
    sub.textContent = match[1] ?? "";
    place.appendChild(sub);
    container.appendChild(place);
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function buildLujvoBreakdown(components: readonly AnnotatedLujvoComponent[]): HTMLUListElement {
  const list = document.createElement("ul");
  list.className = "lujvo-breakdown";
  for (const component of components) {
    const item = document.createElement("li");
    const gloss = component.gismu ? englishDefinitionText(component.definitions) : null;
    if (component.gismu) {
      item.appendChild(document.createTextNode(`${component.rafsi} → `));
      appendLensiskuLink(item, component.gismu);
      if (gloss) {
        item.appendChild(document.createTextNode(": "));
        appendFormattedDefinition(item, gloss);
      }
    } else {
      item.appendChild(document.createTextNode(component.rafsi));
    }
    list.appendChild(item);
  }
  return list;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function buildDefinitionCell(term: AnnotatedTerm): HTMLTableCellElement {
  const cell = document.createElement("td");
  const englishDefinition = englishDefinitionText(term.definitions);

  if (englishDefinition) {
    appendFormattedDefinition(cell, englishDefinition);
  } else if (term.valsi) {
    cell.textContent = "";
  } else if (term.lujvoComponents) {
    cell.appendChild(buildLujvoBreakdown(term.lujvoComponents));
  } else if (term.selmaho === "C") {
    cell.textContent = `name: ${capitalize(term.word)}`;
  } else {
    cell.textContent = "(no dictionary entry)";
  }

  return cell;
}

function renderResults(terms: readonly AnnotatedTerm[]): void {
  resultsBody.innerHTML = "";
  for (const term of terms) {
    const row = document.createElement("tr");

    const wordCell = document.createElement("td");
    if (term.valsi) {
      appendLensiskuLink(wordCell, term.word);
    } else {
      wordCell.textContent = term.word;
    }
    row.appendChild(wordCell);

    for (const text of [term.selmaho, term.valsi ? term.valsi.type_name : "—"]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.appendChild(cell);
    }
    row.appendChild(buildDefinitionCell(term));
    resultsBody.appendChild(row);
  }
  resultsTable.hidden = false;
}

const ROLE_DISPLAY_NAMES: Record<LabeledNodeRole, string> = {
  BRIDI: "sentence",
  SELBRI: "selbri",
  SUMTI: "sumti",
  PRENEX: "prenex",
};

const NESTING_DEPTH_COLORS = 5;

function nestingDepthClass(depth: number): string {
  return `nest-d${depth % NESTING_DEPTH_COLORS}`;
}

// A labeled node from parseLabeledTree()/parseLabeledTreeExperimental() is
// `[label, ...children]`, where `label` is one of LABELED_NODE_ROLES,
// sometimes with a trailing colon (postproc collapsed it to a single
// already-flattened child -- see LABELED_NODE_ROLES' own doc comment).
// Anything else starting a multi-element array -- a nested array, or a
// "SELMAHO:word"/bare-selmaho leaf acting as a sibling rather than a
// wrapping label -- is just a structural grouping with no role to show.
function roleFromLabel(label: string): LabeledNodeRole | null {
  const stripped = label.endsWith(":") ? label.slice(0, -1) : label;
  return (LABELED_NODE_ROLES as readonly string[]).includes(stripped) ? (stripped as LabeledNodeRole) : null;
}

// Bare selmaho with no ":word" are elided terminators (e.g. an implicit
// "cu"/"vau") -- nothing the user actually typed, so nothing to show a box
// for, matching how the results table already only ever lists real words.
function buildNestingLeaf(leaf: string, depth: number, wordLookup: ReadonlyMap<string, AnnotatedTerm>): HTMLElement | null {
  const colonIndex = leaf.indexOf(":");
  if (colonIndex === -1) return null;
  const selmaho = leaf.slice(0, colonIndex);
  const word = leaf.slice(colonIndex + 1);

  const box = document.createElement("div");
  box.className = `nest-leaf ${nestingDepthClass(depth)}`;

  const wordEl = document.createElement("div");
  if (wordLookup.get(word)?.valsi) {
    appendLensiskuLink(wordEl, word);
  } else {
    wordEl.textContent = word;
  }
  box.appendChild(wordEl);

  const selmahoEl = document.createElement("div");
  selmahoEl.className = "nest-selmaho";
  selmahoEl.textContent = selmaho;
  box.appendChild(selmahoEl);

  return box;
}

function buildNestingNode(
  node: TrimmedNode,
  depth: number,
  wordLookup: ReadonlyMap<string, AnnotatedTerm>,
): HTMLElement | null {
  if (typeof node === "string") return buildNestingLeaf(node, depth, wordLookup);

  const [first, ...rest] = node;
  const role = typeof first === "string" ? roleFromLabel(first) : null;
  const children = role !== null ? rest : node;

  const childBoxes = children
    .map((child) => buildNestingNode(child, depth + 1, wordLookup))
    .filter((el): el is HTMLElement => el !== null);
  if (childBoxes.length === 0) return null;

  const box = document.createElement("div");
  box.className = `nest-node ${nestingDepthClass(depth)}`;

  const childrenRow = document.createElement("div");
  childrenRow.className = "nest-children";
  for (const child of childBoxes) childrenRow.appendChild(child);
  box.appendChild(childrenRow);

  if (role !== null) {
    const caption = document.createElement("div");
    caption.className = "nest-caption";
    caption.textContent = ROLE_DISPLAY_NAMES[role];
    box.appendChild(caption);
  }

  return box;
}

// A separate parse from analyze()'s (parseLabeledTree keeps grammatical-role
// wrapper nodes that parseTrimmed trims away -- see ADR 003 and
// LABELED_NODE_ROLES), but of the exact same input text -- repeating
// analyze()'s own usedExperimentalGrammar choice here, rather than redoing
// the standard-then-experimental fallback dance a second time. If analyze()
// instead used the word-list fallback (ADR 006), neither grammar parses this
// text at all -- this throws, and the catch below just hides the section,
// since there's no grammatical structure to show.
function renderNesting(text: string, result: AnalyzeResult): void {
  try {
    const tree = result.usedExperimentalGrammar ? parseLabeledTreeExperimental(text) : parseLabeledTree(text);
    const wordLookup = new Map(result.terms.map((term) => [term.word, term] as const));
    const rootBox = buildNestingNode(tree, 0, wordLookup);
    if (rootBox) {
      nestingContainer.innerHTML = "";
      nestingContainer.appendChild(rootBox);
      nestingSection.hidden = false;
      return;
    }
  } catch {
    // Best-effort visualization on top of an already-successful analyze()
    // result -- on any failure, just hide this section rather than breaking
    // the results the user already has.
  }
  nestingSection.hidden = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError();
  setExperimentalGrammarNotice(false);
  setWordListFallbackNotice(false);
  resultsTable.hidden = true;
  nestingSection.hidden = true;

  const text = textarea.value.trim();
  if (!text) {
    showError("Please enter some Lojban text.");
    return;
  }

  try {
    const result = await analyze(text, { allowWordListFallback: true });
    setExperimentalGrammarNotice(result.usedExperimentalGrammar);
    setWordListFallbackNotice(result.usedWordListFallback);
    renderResults(result.terms);
    renderNesting(text, result);
  } catch (err) {
    if (err instanceof LojbanSyntaxError) {
      showError(`${err.message} (line ${err.line}, column ${err.column})`);
    } else {
      showError(err instanceof Error ? err.message : String(err));
    }
  }
});

// The lujvo-decompose section is currently commented out in index.html;
// guard against it being absent rather than throwing on load, while staying
// ready to work again the moment that markup comes back.
const lujvoForm = document.getElementById("lujvo-form") as HTMLFormElement | null;
const lujvoInput = document.getElementById("lujvo-input") as HTMLInputElement | null;
const lujvoError = document.getElementById("lujvo-error") as HTMLElement | null;
const lujvoResultsList = document.getElementById("lujvo-results-list") as HTMLUListElement | null;

function showLujvoError(message: string): void {
  if (!lujvoError || !lujvoResultsList) return;
  lujvoError.textContent = message;
  lujvoError.hidden = false;
  lujvoResultsList.hidden = true;
}

function renderLujvoComponents(components: readonly { rafsi: string; gismu: string | null }[]): void {
  if (!lujvoResultsList) return;
  lujvoResultsList.innerHTML = "";
  for (const component of components) {
    const item = document.createElement("li");
    item.textContent = component.gismu ? `${component.rafsi} → ${component.gismu}` : component.rafsi;
    lujvoResultsList.appendChild(item);
  }
  lujvoResultsList.hidden = false;
}

lujvoForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!lujvoInput || !lujvoError || !lujvoResultsList) return;
  lujvoError.hidden = true;
  lujvoResultsList.hidden = true;

  const word = lujvoInput.value.trim();
  if (!word) {
    showLujvoError("Please enter a word.");
    return;
  }

  try {
    renderLujvoComponents(decomposeLujvo(word));
  } catch (err) {
    if (err instanceof NotLujvoError) {
      showLujvoError(err.message);
    } else {
      showLujvoError(err instanceof Error ? err.message : String(err));
    }
  }
});

// This app's only 3rd-party runtime dependency is lensisku itself -- camxes
// and camxes-exp are bundled static assets, not a separate live service to
// check. "coi" is a real, guaranteed-to-exist cmavo (and the first word of
// the pre-filled example above), so this doubles as a real exercise of the
// exact endpoint analyze() depends on rather than a separate health-check
// path that could pass while the one we actually use is broken. A short
// timeout keeps a slow/unreachable service from leaving this notice pending
// for long; this only ever checks once, on load -- it's advisory, not a
// gate on submitting the form.
async function checkDictionaryAvailability(): Promise<void> {
  const client = new LensiskuClient({ timeoutMs: 5_000 });
  try {
    await client.getValsi("coi");
  } catch {
    dictionaryStatus.textContent =
      "The lensisku dictionary service isn't responding right now -- word lookups may fail until it's back.";
    dictionaryStatus.hidden = false;
  }
}

void checkDictionaryAvailability();

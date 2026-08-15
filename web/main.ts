import { analyze, decomposeLujvo, LojbanSyntaxError, NotLujvoError } from "../src/browser.js";
import type { AnnotatedLujvoComponent, AnnotatedTerm } from "../src/browser.js";
import type { ValsiDefinition } from "../src/browser.js";

const form = document.getElementById("analyze-form") as HTMLFormElement;
const textarea = document.getElementById("lojban-input") as HTMLTextAreaElement;
const errorBox = document.getElementById("error-message") as HTMLElement;
const resultsTable = document.getElementById("results-table") as HTMLTableElement;
const resultsBody = document.getElementById("results-body") as HTMLTableSectionElement;

function showError(message: string): void {
  errorBox.textContent = message;
  errorBox.hidden = false;
  resultsTable.hidden = true;
}

function hideError(): void {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function englishDefinitionText(definitions: readonly ValsiDefinition[]): string | null {
  return definitions.find((d) => d.langrealname === "English")?.definition ?? null;
}

function buildLujvoBreakdown(components: readonly AnnotatedLujvoComponent[]): HTMLUListElement {
  const list = document.createElement("ul");
  list.className = "lujvo-breakdown";
  for (const component of components) {
    const item = document.createElement("li");
    const gloss = component.gismu ? englishDefinitionText(component.definitions) : null;
    item.textContent = component.gismu
      ? `${component.rafsi} → ${component.gismu}${gloss ? `: ${gloss}` : ""}`
      : component.rafsi;
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
    cell.textContent = englishDefinition;
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
    for (const text of [term.word, term.selmaho, term.valsi ? term.valsi.type_name : "—"]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.appendChild(cell);
    }
    row.appendChild(buildDefinitionCell(term));
    resultsBody.appendChild(row);
  }
  resultsTable.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError();
  resultsTable.hidden = true;

  const text = textarea.value.trim();
  if (!text) {
    showError("Please enter some Lojban text.");
    return;
  }

  try {
    const result = await analyze(text);
    renderResults(result.terms);
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

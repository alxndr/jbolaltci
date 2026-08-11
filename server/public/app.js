const form = document.getElementById("analyze-form");
const textarea = document.getElementById("lojban-input");
const errorBox = document.getElementById("error-message");
const resultsTable = document.getElementById("results-table");
const resultsBody = document.getElementById("results-body");

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  resultsTable.hidden = true;
}

function hideError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function englishDefinitionText(definitions) {
  return definitions.find((d) => d.langrealname === "English")?.definition ?? null;
}

function buildLujvoBreakdown(components) {
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

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function buildDefinitionCell(term) {
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

function renderResults(terms) {
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

  let response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    showError("Couldn't reach the server. Please try again.");
    return;
  }

  const body = await response.json();
  if (!response.ok) {
    const location =
      typeof body.error.line === "number" ? ` (line ${body.error.line}, column ${body.error.column})` : "";
    showError(body.error.message + location);
    return;
  }

  renderResults(body.terms);
});

const lujvoForm = document.getElementById("lujvo-form");
const lujvoInput = document.getElementById("lujvo-input");
const lujvoError = document.getElementById("lujvo-error");
const lujvoResultsList = document.getElementById("lujvo-results-list");

function showLujvoError(message) {
  lujvoError.textContent = message;
  lujvoError.hidden = false;
  lujvoResultsList.hidden = true;
}

function renderLujvoComponents(components) {
  lujvoResultsList.innerHTML = "";
  for (const component of components) {
    const item = document.createElement("li");
    item.textContent = component.gismu ? `${component.rafsi} → ${component.gismu}` : component.rafsi;
    lujvoResultsList.appendChild(item);
  }
  lujvoResultsList.hidden = false;
}

lujvoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  lujvoError.hidden = true;
  lujvoResultsList.hidden = true;

  const word = lujvoInput.value.trim();
  if (!word) {
    showLujvoError("Please enter a word.");
    return;
  }

  let response;
  try {
    response = await fetch("/api/decompose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ word }),
    });
  } catch {
    showLujvoError("Couldn't reach the server. Please try again.");
    return;
  }

  const body = await response.json();
  if (!response.ok) {
    showLujvoError(body.error.message);
    return;
  }

  renderLujvoComponents(body.components);
});

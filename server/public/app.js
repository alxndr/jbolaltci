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

function renderResults(terms) {
  resultsBody.innerHTML = "";
  for (const term of terms) {
    const englishDefinition = term.definitions.find((d) => d.langrealname === "English");
    const definitionText = englishDefinition
      ? englishDefinition.definition
      : term.valsi
        ? ""
        : "(no dictionary entry)";

    const row = document.createElement("tr");
    for (const text of [term.word, term.selmaho, term.valsi ? term.valsi.type_name : "—", definitionText]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.appendChild(cell);
    }
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

import { expect, test } from "@playwright/test";

test("submitting the pre-filled example sentence renders a result row per word", async ({ page }) => {
  await page.goto("/");

  const textarea = page.locator("#lojban-input");
  await expect(textarea).toHaveValue("coi u'isai");

  await page.locator("#analyze-button").click();

  const rows = page.locator("#results-body tr");
  await expect(rows).toHaveCount(3, { timeout: 5_000 });

  const tavlaRow = page.locator("#results-body tr", { hasText: "coi" });
  await expect(tavlaRow).toContainText("COI");
  await expect(tavlaRow).toContainText("cmavo");
  await expect(tavlaRow).toContainText("greetings");

  await expect(page.locator("#error-message")).toBeHidden();
});

test("the dictionary-status notice stays hidden when lensisku is reachable on page load", async ({ page }) => {
  await page.goto("/");

  // Give the page-load check (a real request to the real API) a moment to
  // resolve, then confirm it didn't surface anything.
  await page.waitForTimeout(1_000);
  await expect(page.locator("#dictionary-status")).toBeHidden();
});

test("the dictionary-status notice appears on page load when lensisku is unreachable", async ({ page }) => {
  await page.route("https://lensisku.lojban.org/api/**", (route) => route.abort("connectionfailed"));

  await page.goto("/");

  const status = page.locator("#dictionary-status");
  await expect(status).toBeVisible({ timeout: 10_000 });
  await expect(status).toContainText("isn't responding");

  // Advisory only -- the rest of the page must still be usable.
  await expect(page.locator("#analyze-button")).toBeEnabled();
});

test("submitting ungrammatical text shows a syntax error instead of results", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("...###invalid###...");
  await page.locator("#analyze-button").click();

  const error = page.locator("#error-message");
  await expect(error).toBeVisible();
  await expect(error).toContainText("#");

  await expect(page.locator("#results-table")).toBeHidden();
});

test("submitting empty input is rejected client-side, with no request sent", async ({ page }) => {
  await page.goto("/");

  let requestCount = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/analyze")) requestCount++;
  });

  await page.locator("#lojban-input").fill("   ");
  await page.locator("#analyze-button").click();

  await expect(page.locator("#error-message")).toBeVisible();
  expect(requestCount).toBe(0);
});

test("analyzing a sentence with an undocumented lujvo shows its decomposition instead of 'no dictionary entry'", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("mi tavla do le jbolaltci");
  await page.locator("#analyze-button").click();

  const lujvoRow = page.locator("#results-body tr", { hasText: "jbolaltci" });
  await expect(lujvoRow).toBeVisible({ timeout: 15_000 });

  const definitionCell = lujvoRow.locator("td").last();
  await expect(definitionCell).not.toContainText("no dictionary entry");
  await expect(definitionCell).toContainText("jbo");
  await expect(definitionCell).toContainText("lojbo");
  await expect(definitionCell).toContainText("lal");
  await expect(definitionCell).toContainText("lanli");
  await expect(definitionCell).toContainText("tci");
  await expect(definitionCell).toContainText("tutci");
});

test("a term with a real dictionary entry links its word to the lensisku entry", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("ti melbi");
  await page.locator("#analyze-button").click();

  const melbiRow = page.locator("#results-body tr", { hasText: "melbi" });
  await expect(melbiRow).toBeVisible();

  const wordLink = melbiRow.locator("td").first().locator("a");
  await expect(wordLink).toHaveAttribute("href", "https://lensisku.lojban.org/en/valsi/melbi");
  await expect(wordLink).toHaveAttribute("target", "_blank");
});

test("a lujvo's decomposed component gismu also link to their lensisku entries", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("mi tavla do le jbolaltci");
  await page.locator("#analyze-button").click();

  const lujvoRow = page.locator("#results-body tr", { hasText: "jbolaltci" });
  await expect(lujvoRow).toBeVisible({ timeout: 15_000 });

  // The lujvo term itself has no dictionary entry of its own -- its word
  // cell should stay plain text, not link anywhere that would 404.
  await expect(lujvoRow.locator("td").first().locator("a")).toHaveCount(0);

  const definitionCell = lujvoRow.locator("td").last();
  const gismuLink = definitionCell.locator("a", { hasText: "lojbo" });
  await expect(gismuLink).toHaveAttribute("href", "https://lensisku.lojban.org/en/valsi/lojbo");
});

test("gismu place-structure placeholders like $x_1$ render as formatted subscripts, not raw markup", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("mi tavla do le jbolaltci");
  await page.locator("#analyze-button").click();

  const tavlaRow = page.locator("#results-body tr", { hasText: "tavla" });
  await expect(tavlaRow).toBeVisible({ timeout: 15_000 });

  const definitionCell = tavlaRow.locator("td").last();
  await expect(definitionCell).not.toContainText("$x_");
  const firstPlace = definitionCell.locator("i sub").first();
  await expect(firstPlace).toHaveText("1");
});

test("analyzing an experimental cmavo the standard grammar rejects falls back to camxes-exp, with a notice", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#experimental-grammar-notice")).toBeHidden();

  await page.locator("#lojban-input").fill("mi tavla do ue'i");
  await page.locator("#analyze-button").click();

  const notice = page.locator("#experimental-grammar-notice");
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(notice).toContainText("experimental");
  await expect(page.locator("#error-message")).toBeHidden();

  const uiRow = page.locator("#results-body tr", { hasText: "ue'i" });
  await expect(uiRow).toBeVisible();
  await expect(uiRow).toContainText("UI");
});

test("the experimental-grammar notice clears after a subsequent standard-grammar analysis", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("ue'i");
  await page.locator("#analyze-button").click();
  await expect(page.locator("#experimental-grammar-notice")).toBeVisible({ timeout: 15_000 });

  await page.locator("#lojban-input").fill("ti melbi");
  await page.locator("#analyze-button").click();
  await expect(page.locator("#experimental-grammar-notice")).toBeHidden();
});

test("the nesting section is hidden until an analysis succeeds", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#nesting-section")).toBeHidden();
});

test("analyzing a sentence shows the nesting boxes with grammatical-role captions and linked words", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("mi tavla do fi la .lojban.");
  await page.locator("#analyze-button").click();

  const nestingSection = page.locator("#nesting-section");
  await expect(nestingSection).toBeVisible({ timeout: 15_000 });

  const captions = nestingSection.locator(".nest-caption");
  await expect(captions).toContainText(["sumti", "selbri", "sumti", "sumti", "sentence"]);

  const tavlaLeaf = nestingSection.locator(".nest-leaf", { hasText: "tavla" });
  await expect(tavlaLeaf.locator("a")).toHaveAttribute("href", "https://lensisku.lojban.org/en/valsi/tavla");

  // "cu"/"vau" are elided in this input -- nothing was typed for them, so
  // no leaf box should exist for either.
  await expect(nestingSection.getByText("CU", { exact: true })).toHaveCount(0);
  await expect(nestingSection.getByText("VAU", { exact: true })).toHaveCount(0);
});

test("the nesting boxes still render for a sentence that needed the camxes-exp fallback", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("mi tavla do ue'i");
  await page.locator("#analyze-button").click();

  const nestingSection = page.locator("#nesting-section");
  await expect(nestingSection).toBeVisible({ timeout: 15_000 });
  await expect(nestingSection.locator(".nest-leaf", { hasText: "ue'i" })).toBeVisible();
});

test("the nesting section hides again after a subsequent syntax error", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("ti melbi");
  await page.locator("#analyze-button").click();
  await expect(page.locator("#nesting-section")).toBeVisible({ timeout: 15_000 });

  await page.locator("#lojban-input").fill("...###invalid###...");
  await page.locator("#analyze-button").click();
  await expect(page.locator("#nesting-section")).toBeHidden();
});

test("analyzing text neither grammar can parse falls back to a per-word dictionary lookup, with a notice", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#word-list-fallback-notice")).toBeHidden();

  // "a'oi" (a piratical vocative greeting, "ahoy") has a real lensisku
  // entry but isn't in either vendored grammar's hardcoded cmavo list --
  // see ADR 006.
  await page.locator("#lojban-input").fill("a'oi");
  await page.locator("#analyze-button").click();

  const notice = page.locator("#word-list-fallback-notice");
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#error-message")).toBeHidden();

  const row = page.locator("#results-body tr", { hasText: "a'oi" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("COI");
  await expect(row).toContainText("piratical");

  // No grammatical structure was found, so there's nothing to nest.
  await expect(page.locator("#nesting-section")).toBeHidden();
});

test("the word-list fallback still splits a compound cmavo token that's grammatical on its own, instead of showing it as one unresolved word", async ({ page }) => {
  await page.goto("/");

  // "a'oi u'isai" fails to parse as a whole (a'oi breaks it), but "u'isai"
  // -- a compound of u'i and sai with no space -- is grammatical by itself
  // and shouldn't be swallowed into a single "(no dictionary entry)" row.
  await page.locator("#lojban-input").fill("a'oi u'isai");
  await page.locator("#analyze-button").click();

  await expect(page.locator("#word-list-fallback-notice")).toBeVisible({ timeout: 15_000 });

  const uiRow = page.locator("#results-body tr", { hasText: "u'i" }).first();
  await expect(uiRow).toBeVisible();
  await expect(uiRow).toContainText("UI");
  await expect(uiRow).not.toContainText("no dictionary entry");

  const saiRow = page.locator("#results-body tr", { hasText: "sai" });
  await expect(saiRow).toBeVisible();
  await expect(saiRow).toContainText("CAI");
  await expect(saiRow).not.toContainText("no dictionary entry");
});

test("the word-list-fallback notice clears after a subsequent grammatical analysis", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("a'oi");
  await page.locator("#analyze-button").click();
  await expect(page.locator("#word-list-fallback-notice")).toBeVisible({ timeout: 15_000 });

  await page.locator("#lojban-input").fill("ti melbi");
  await page.locator("#analyze-button").click();
  await expect(page.locator("#word-list-fallback-notice")).toBeHidden();
});

test("analyzing a sentence with an undocumented name shows 'name: Capitalized' instead of 'no dictionary entry'", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("mi tavla do la rexs.");
  await page.locator("#analyze-button").click();

  const nameRow = page.locator("#results-body tr", { hasText: "rexs" });
  await expect(nameRow).toBeVisible({ timeout: 15_000 });

  const definitionCell = nameRow.locator("td").last();
  await expect(definitionCell).toHaveText("name: Rexs");

  // An undocumented name has no dictionary entry to link to.
  await expect(nameRow.locator("td").first().locator("a")).toHaveCount(0);
});

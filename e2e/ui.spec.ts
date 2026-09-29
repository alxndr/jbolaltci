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

test("analyzing a sentence with an undocumented name shows 'name: Capitalized' instead of 'no dictionary entry'", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("mi tavla do la rexs.");
  await page.locator("#analyze-button").click();

  const nameRow = page.locator("#results-body tr", { hasText: "rexs" });
  await expect(nameRow).toBeVisible({ timeout: 15_000 });

  const definitionCell = nameRow.locator("td").last();
  await expect(definitionCell).toHaveText("name: Rexs");
});

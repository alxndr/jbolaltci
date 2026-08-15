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

test("analyzing a sentence with an undocumented name shows 'name: Capitalized' instead of 'no dictionary entry'", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lojban-input").fill("mi tavla do la rexs.");
  await page.locator("#analyze-button").click();

  const nameRow = page.locator("#results-body tr", { hasText: "rexs" });
  await expect(nameRow).toBeVisible({ timeout: 15_000 });

  const definitionCell = nameRow.locator("td").last();
  await expect(definitionCell).toHaveText("name: Rexs");
});

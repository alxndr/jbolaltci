import { expect, test } from "@playwright/test";

test("submitting the pre-filled example sentence renders a result row per word", async ({ page }) => {
  await page.goto("/");

  const textarea = page.locator("#lojban-input");
  await expect(textarea).toHaveValue("mi tavla do fi la .lojban.");

  await page.locator("#analyze-button").click();

  const rows = page.locator("#results-body tr");
  await expect(rows).toHaveCount(6, { timeout: 15_000 });

  const tavlaRow = page.locator("#results-body tr", { hasText: "tavla" });
  await expect(tavlaRow).toContainText("G");
  await expect(tavlaRow.locator("td").last()).not.toBeEmpty();

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

test("decomposing the pre-filled lujvo shows its rafsi and source gismu", async ({ page }) => {
  await page.goto("/");

  const lujvoInput = page.locator("#lujvo-input");
  await expect(lujvoInput).toHaveValue("jbolaltci");

  await page.locator("#decompose-button").click();

  const items = page.locator("#lujvo-results-list li");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("jbo");
  await expect(items.nth(0)).toContainText("lojbo");
  await expect(items.nth(1)).toContainText("lal");
  await expect(items.nth(1)).toContainText("lanli");
  await expect(items.nth(2)).toContainText("tci");
  await expect(items.nth(2)).toContainText("tutci");

  await expect(page.locator("#lujvo-error")).toBeHidden();
});

test("decomposing a plain gismu shows an error instead of results", async ({ page }) => {
  await page.goto("/");

  await page.locator("#lujvo-input").fill("melbi");
  await page.locator("#decompose-button").click();

  const error = page.locator("#lujvo-error");
  await expect(error).toBeVisible();
  await expect(error).toContainText("melbi");

  await expect(page.locator("#lujvo-results-list")).toBeHidden();
});

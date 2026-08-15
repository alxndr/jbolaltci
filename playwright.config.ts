import { defineConfig } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    command: "npm run build:web && npm run serve:web",
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

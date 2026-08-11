import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const port = 3100;
const cacheDir = mkdtempSync(join(tmpdir(), "jbolaltci-e2e-cache-"));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    command: "npx tsx server/index.ts",
    port,
    env: {
      PORT: String(port),
      CACHE_PATH: join(cacheDir, "dictionary.sqlite"),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  // ESM only: the vendored camxes parser is loaded via createRequire(import.meta.url),
  // which has no CJS equivalent, so a dual-format build would break at runtime.
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});

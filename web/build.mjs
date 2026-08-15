import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outdir = join(here, "dist");

const PORT = 3100;

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");

function copyStaticAssets() {
  mkdirSync(outdir, { recursive: true });
  for (const file of ["index.html", "about.html", "style.css"]) {
    cpSync(join(here, file), join(outdir, file));
  }
  // camxes.js/camxes_postproc.js are loaded as classic <script> globals (see
  // src/parser/camxes.browser.ts) -- copied from the single canonical vendor
  // location rather than duplicated as a second checked-in copy.
  for (const file of ["camxes.js", "camxes_postproc.js"]) {
    cpSync(join(root, "vendor", "ilmentufa", file), join(outdir, file));
  }
}

const buildOptions = {
  entryPoints: [join(here, "main.ts")],
  outfile: join(outdir, "main.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  sourcemap: true,
};

if (serve && !watch) {
  // --serve without --watch: assumes web/dist/ is already built (e.g. by a
  // prior `npm run build:web`), just serves it. Used by Playwright/CI so a
  // build failure surfaces separately from server startup.
  const ctx = await esbuild.context(buildOptions);
  // esbuild's serve() resolves with { hosts: string[], port }, not a single
  // `host` -- binding explicitly to loopback keeps that array predictable
  // and keeps the dev server off the LAN.
  const { port } = await ctx.serve({ servedir: outdir, port: PORT, host: "127.0.0.1" });
  console.log(`Serving ${outdir} at http://localhost:${port}`);
} else {
  rmSync(outdir, { recursive: true, force: true });
  copyStaticAssets();
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    if (serve) {
      const { port } = await ctx.serve({ servedir: outdir, port: PORT, host: "127.0.0.1" });
      console.log(`Serving ${outdir} at http://localhost:${port}`);
    } else {
      console.log(`Watching for changes...`);
    }
  } else {
    await esbuild.build(buildOptions);
    console.log(`Built ${outdir}`);
  }
}

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  for (const file of ["about.html", "style.css"]) {
    cpSync(join(here, file), join(outdir, file));
  }
  writeIndexHtml();
  // camxes.js/camxes_postproc.js are loaded as classic <script> globals (see
  // src/parser/camxes.browser.ts) -- copied from the single canonical vendor
  // location rather than duplicated as a second checked-in copy.
  for (const file of ["camxes.js", "camxes_postproc.js"]) {
    cpSync(join(root, "vendor", "ilmentufa", file), join(outdir, file));
  }
  writeWrappedExperimentalGrammar();
}

// esbuild's dev server exposes a /esbuild SSE endpoint that fires a "change"
// event after each successful rebuild (confirmed hands-on: curling it while
// editing main.ts printed a change event within milliseconds of the save).
// This is esbuild's own documented live-reload recipe, not something we're
// inventing -- wiring a listener to it is what turns "the bundle on disk
// updated" into "the open tab actually shows it". Only injected in --watch
// mode: there's no such endpoint on the static GitHub Pages build, so this
// script would do nothing there but leave a dangling reconnect loop.
const LIVE_RELOAD_SCRIPT =
  '<script>new EventSource("/esbuild").addEventListener("change", () => location.reload());</script>';

function writeIndexHtml() {
  let html = readFileSync(join(here, "index.html"), "utf8");
  if (watch) {
    html = html.replace("</body>", `  ${LIVE_RELOAD_SCRIPT}\n</body>`);
  }
  writeFileSync(join(outdir, "index.html"), html);
}

// camxes-exp.js declares the same top-level `var camxes` as camxes.js does,
// so loading it as a second plain <script> would silently clobber
// window.camxes. Wrap the vendored file's own text (unmodified) in an IIFE
// so that `var` stays function-scoped, and expose the result as
// window.camxes_exp instead -- see src/parser/camxes.browser.ts.
function writeWrappedExperimentalGrammar() {
  const source = readFileSync(join(root, "vendor", "ilmentufa", "camxes-exp.js"), "utf8");
  const wrapped = `(function () {\n${source}\nwindow.camxes_exp = camxes;\n})();\n`;
  writeFileSync(join(outdir, "camxes-exp.js"), wrapped);
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

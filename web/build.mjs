import { cpSync, mkdirSync, readFileSync, rmSync, watch as watchDir, writeFileSync } from "node:fs";
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

// esbuild's own ctx.watch() only tracks main.ts's bundled module graph --
// main.ts and everything under src/ it imports -- so editing those already
// triggers a rebuild (and, via the live-reload script above, a browser
// reload) with no extra code needed here. These CSS/HTML files and the
// vendored grammar .js files are never imported, only copied into dist/ once
// at startup (see copyStaticAssets()/writeWrappedExperimentalGrammar()), so
// esbuild has no way to know editing them should do anything. Watching them
// here and recopying on change keeps dist/ in sync; calling ctx.rebuild()
// (confirmed hands-on: it fires the same "/esbuild" SSE "change" event
// ctx.watch()'s own rebuilds do, even with nothing esbuild bundles actually
// changed) is what gets the already-injected live-reload script to pick it
// up and reload the tab.
function watchStaticAssets(ctx) {
  const webBasenames = new Set(["index.html", "about.html", "style.css"]);
  const vendorBasenames = new Set(["camxes.js", "camxes_postproc.js", "camxes-exp.js"]);
  const vendorDir = join(root, "vendor", "ilmentufa");

  const changedFiles = new Set();
  let debounceTimer;
  function scheduleRebuild(filename) {
    changedFiles.add(filename);
    clearTimeout(debounceTimer);
    // Debounced because a single save can fire more than one fs.watch event
    // (e.g. a separate "rename" and "change"), and because an editor writing
    // several files as part of one save (rare here, but cheap to guard
    // against) should still only trigger one rebuild.
    debounceTimer = setTimeout(async () => {
      console.log(`Changed: ${[...changedFiles].join(", ")} -- rebuilding...`);
      changedFiles.clear();
      copyStaticAssets();
      await ctx.rebuild();
    }, 50);
  }

  // Watching the containing directories, rather than each file path
  // individually, survives an editor's atomic save (write a temp file, then
  // rename it over the original) -- fs.watch on a single file path can stop
  // firing once the underlying inode it was watching gets replaced that way.
  watchDir(here, (_event, filename) => {
    if (filename && webBasenames.has(filename)) scheduleRebuild(filename);
  });
  watchDir(vendorDir, (_event, filename) => {
    if (filename && vendorBasenames.has(filename)) scheduleRebuild(filename);
  });
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
    watchStaticAssets(ctx);
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

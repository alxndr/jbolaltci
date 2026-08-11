import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import { LojbanSyntaxError } from "../src/index.js";
import type { AnalyzeResult } from "../src/index.js";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "public");

export type AnalyzeFn = (text: string) => Promise<AnalyzeResult>;

/** Builds the Express app with the given analyze function injected, so
 * tests can supply a fake with no real cache/network involved. */
export function createApp(analyzeFn: AnalyzeFn): Express {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));

  app.post("/api/analyze", async (req, res) => {
    const text = (req.body as { text?: unknown } | undefined)?.text;
    if (typeof text !== "string") {
      res.status(400).json({ error: { message: 'Request body must include a "text" string.' } });
      return;
    }

    try {
      const result = await analyzeFn(text);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof LojbanSyntaxError) {
        res.status(400).json({
          error: {
            message: err.message,
            expected: err.expected,
            found: err.found,
            line: err.line,
            column: err.column,
          },
        });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: { message } });
    }
  });

  return app;
}

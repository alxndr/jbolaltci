import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";
import { LojbanSyntaxError } from "../src/index.js";
import type { AnalyzeResult } from "../src/index.js";

let activeServer: Server | undefined;

async function startServer(analyzeFn: (text: string) => Promise<AnalyzeResult>) {
  const app = createApp(analyzeFn);
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  activeServer = server;
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("server has no port");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

afterEach(async () => {
  if (activeServer) {
    await new Promise<void>((resolve, reject) => activeServer!.close((err) => (err ? reject(err) : resolve())));
    activeServer = undefined;
  }
});

describe("createApp", () => {
  it("returns 200 with the analyze result for valid text", async () => {
    const fakeResult: AnalyzeResult = { input: "ti melbi", parseTree: [], terms: [] };
    const { baseUrl } = await startServer(async (text) => {
      expect(text).toBe("ti melbi");
      return fakeResult;
    });

    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "ti melbi" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fakeResult);
  });

  it("returns 400 without calling analyze when text is missing", async () => {
    let called = false;
    const { baseUrl } = await startServer(async () => {
      called = true;
      return { input: "", parseTree: [], terms: [] };
    });

    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    expect(called).toBe(false);
  });

  it("returns 400 with syntax error details when analyze throws LojbanSyntaxError", async () => {
    const { baseUrl } = await startServer(async () => {
      throw new LojbanSyntaxError({
        message: "bad input",
        expected: [{ type: "class", description: "x" }],
        found: "#",
        offset: 3,
        line: 1,
        column: 4,
      });
    });

    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "...###..." }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string; found: string; line: number; column: number } };
    expect(body.error.message).toBe("bad input");
    expect(body.error.found).toBe("#");
    expect(body.error.line).toBe(1);
    expect(body.error.column).toBe(4);
  });

  it("returns 500 with just a message when analyze throws a generic error", async () => {
    const { baseUrl } = await startServer(async () => {
      throw new Error("dictionary unreachable");
    });

    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "ti melbi" }),
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { message: "dictionary unreachable" } });
  });

  it("serves the static index page at GET /", async () => {
    const { baseUrl } = await startServer(async () => ({ input: "", parseTree: [], terms: [] }));

    const res = await fetch(`${baseUrl}/`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});

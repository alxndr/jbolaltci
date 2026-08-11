import type { Valsi, ValsiDefinition } from "./types.js";

const DEFAULT_BASE_URL = "https://lensisku.lojban.org/api";
const DEFAULT_TIMEOUT_MS = 10_000;

export class LensiskuApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(url: string, status: number, body: string) {
    super(`lensisku API request to ${url} failed with status ${status}: ${body}`);
    this.name = "LensiskuApiError";
    this.status = status;
    this.url = url;
  }
}

export interface LensiskuClientOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export class LensiskuClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: LensiskuClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async getValsi(word: string): Promise<Valsi | null> {
    const body = await this.getJson(`/jbovlaste/valsi/${encodeURIComponent(word)}`);
    if (body === null) return null;
    return (body as { valsi: Valsi }).valsi;
  }

  async getDefinitions(word: string): Promise<ValsiDefinition[]> {
    const body = await this.getJson(`/jbovlaste/valsi/${encodeURIComponent(word)}/definitions`);
    if (body === null) return [];
    return body as ValsiDefinition[];
  }

  private async getJson(path: string): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new LensiskuApiError(url, response.status, await response.text());
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { DictionaryCache } from "./cache.js";
import type { Valsi, ValsiDefinition } from "../dictionary/types.js";

export function defaultCachePath(): string {
  return join(homedir(), ".cache", "jboski-update", "dictionary.sqlite");
}

export interface SqliteDictionaryCacheOptions {
  readonly filePath?: string;
}

export class SqliteDictionaryCache implements DictionaryCache {
  private readonly db: Database.Database;

  constructor(opts: SqliteDictionaryCacheOptions = {}) {
    const filePath = opts.filePath ?? defaultCachePath();
    if (filePath !== ":memory:") mkdirSync(dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.exec("CREATE TABLE IF NOT EXISTS valsi (word TEXT PRIMARY KEY, json TEXT NOT NULL)");
    this.db.exec("CREATE TABLE IF NOT EXISTS definitions (word TEXT PRIMARY KEY, json TEXT NOT NULL)");
  }

  getValsi(word: string): Valsi | null | undefined {
    const row = this.db.prepare("SELECT json FROM valsi WHERE word = ?").get(word) as
      | { json: string }
      | undefined;
    return row === undefined ? undefined : (JSON.parse(row.json) as Valsi | null);
  }

  setValsi(word: string, value: Valsi | null): void {
    this.upsert("valsi", word, value);
  }

  getDefinitions(word: string): ValsiDefinition[] | undefined {
    const row = this.db.prepare("SELECT json FROM definitions WHERE word = ?").get(word) as
      | { json: string }
      | undefined;
    return row === undefined ? undefined : (JSON.parse(row.json) as ValsiDefinition[]);
  }

  setDefinitions(word: string, value: ValsiDefinition[]): void {
    this.upsert("definitions", word, value);
  }

  close(): void {
    this.db.close();
  }

  private upsert(table: "valsi" | "definitions", word: string, value: unknown): void {
    this.db
      .prepare(
        `INSERT INTO ${table} (word, json) VALUES (?, ?)
         ON CONFLICT(word) DO UPDATE SET json = excluded.json`,
      )
      .run(word, JSON.stringify(value));
  }
}

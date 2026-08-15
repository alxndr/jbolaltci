export interface RawLojbanSyntaxError {
  message: string;
  expected: Array<{ type: string; value?: string; description: string }>;
  found: string | null;
  offset: number;
  line: number;
  column: number;
}

export class LojbanSyntaxError extends Error {
  readonly expected: Array<{ type: string; value?: string; description: string }>;
  readonly found: string | null;
  readonly offset: number;
  readonly line: number;
  readonly column: number;

  constructor(raw: RawLojbanSyntaxError) {
    super(raw.message);
    this.name = "LojbanSyntaxError";
    this.expected = raw.expected;
    this.found = raw.found;
    this.offset = raw.offset;
    this.line = raw.line;
    this.column = raw.column;
  }
}

export interface CamxesRawSyntaxError extends Error {
  expected: Array<{ type: string; value?: string; description: string }>;
  found: string | null;
  offset: number;
  line: number;
  column: number;
}

export interface Camxes {
  parse(text: string): unknown;
  SyntaxError: new (...args: unknown[]) => CamxesRawSyntaxError;
}

export interface CamxesPostproc {
  postprocess(tree: unknown, mode: string): string;
  postprocessing(tree: unknown, mode: string): string;
}

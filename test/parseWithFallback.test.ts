import { describe, expect, it, vi } from "vitest";
import { parseWithFallback } from "../src/parser/parseWithFallback.js";
import { LojbanSyntaxError } from "../src/parser/lojbanSyntaxError.js";

function fakeSyntaxError(): LojbanSyntaxError {
  return new LojbanSyntaxError({
    message: "bad input",
    expected: [],
    found: null,
    offset: 0,
    line: 1,
    column: 1,
  });
}

describe("parseWithFallback", () => {
  it("returns the standard result, unflagged, when standard parsing succeeds", () => {
    const standard = vi.fn(() => "standard result");
    const experimental = vi.fn(() => "experimental result");

    const { result, usedExperimentalGrammar } = parseWithFallback("text", standard, experimental);

    expect(result).toBe("standard result");
    expect(usedExperimentalGrammar).toBe(false);
    expect(experimental).not.toHaveBeenCalled();
  });

  it("falls back to experimental, flagged, when standard throws LojbanSyntaxError", () => {
    const standard = vi.fn(() => {
      throw fakeSyntaxError();
    });
    const experimental = vi.fn(() => "experimental result");

    const { result, usedExperimentalGrammar } = parseWithFallback("text", standard, experimental);

    expect(result).toBe("experimental result");
    expect(usedExperimentalGrammar).toBe(true);
  });

  it("propagates a non-LojbanSyntaxError from standard without attempting the fallback", () => {
    const standard = vi.fn(() => {
      throw new Error("something else entirely");
    });
    const experimental = vi.fn(() => "experimental result");

    expect(() => parseWithFallback("text", standard, experimental)).toThrow("something else entirely");
    expect(experimental).not.toHaveBeenCalled();
  });

  it("re-throws the standard grammar's error when no experimental parser was supplied", () => {
    const standardError = fakeSyntaxError();
    const standard = vi.fn(() => {
      throw standardError;
    });

    expect(() => parseWithFallback("text", standard, undefined)).toThrow(standardError);
  });

  it("re-throws the *standard* grammar's error when experimental also fails", () => {
    const standardError = fakeSyntaxError();
    const standard = vi.fn(() => {
      throw standardError;
    });
    const experimental = vi.fn(() => {
      throw new Error("experimental grammar's own, differently-worded error");
    });

    expect(() => parseWithFallback("text", standard, experimental)).toThrow(standardError);
  });
});

import { describe, expect, it } from "vitest";
import { decomposeLujvo, NotLujvoError } from "../src/lujvo/decompose.js";

describe("decomposeLujvo", () => {
  it("decomposes jbolaltci into lojbo + lanli + tutci", () => {
    expect(decomposeLujvo("jbolaltci")).toEqual([
      { rafsi: "jbo", gismu: "lojbo" },
      { rafsi: "lal", gismu: "lanli" },
      { rafsi: "tci", gismu: "tutci" },
    ]);
  });

  it("decomposes latkerlo into mlatu + kerlo, matching upstream's own docstring example", () => {
    expect(decomposeLujvo("latkerlo")).toEqual([
      { rafsi: "lat", gismu: "mlatu" },
      { rafsi: "kerlo", gismu: "kerlo" },
    ]);
  });

  it("throws NotLujvoError for a plain gismu, which has nothing to decompose", () => {
    expect(() => decomposeLujvo("melbi")).toThrow(NotLujvoError);
  });
});

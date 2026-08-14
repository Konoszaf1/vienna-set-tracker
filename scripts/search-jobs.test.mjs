import { describe, expect, it } from "vitest";
import { isViennaLocation } from "./search-jobs.mjs";

describe("search-jobs location boundary", () => {
  it("accepts Vienna as an explicit location in a multi-city listing", () => {
    expect(isViennaLocation("Wien")).toBe(true);
    expect(isViennaLocation("Graz, Wien, Linz")).toBe(true);
  });

  it("rejects nearby cities whose names merely contain Wien", () => {
    expect(isViennaLocation("Wiener Neustadt")).toBe(false);
    expect(isViennaLocation("Gemeinde Wiener Neudorf")).toBe(false);
    expect(isViennaLocation("Gemeinde Breitenfurt bei Wien")).toBe(false);
  });
});

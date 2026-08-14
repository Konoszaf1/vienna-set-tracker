import { describe, expect, it } from "vitest";
import { isDevjobsBlockedPage, isViennaLocation } from "./search-jobs.mjs";

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

describe("search-jobs DEVjobs response classification", () => {
  it("recognizes the automation checkpoint without mistaking a normal page for it", () => {
    expect(isDevjobsBlockedPage("Vercel Security Checkpoint", "We're verifying your browser")).toBe(true);
    expect(isDevjobsBlockedPage("Test Automation Jobs", "78 Stellenangebote gefunden")).toBe(false);
  });
});

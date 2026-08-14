import { describe, expect, it } from "vitest";
import { canonicalizeTechStack } from "./normalizeTech";

describe("canonicalizeTechStack", () => {
  it("merges case and common label variants", () => {
    expect(canonicalizeTechStack(["JIRA", "Jira", "github action", "GitHub Actions"]))
      .toEqual(["GitHub Actions", "Jira"]);
  });
});

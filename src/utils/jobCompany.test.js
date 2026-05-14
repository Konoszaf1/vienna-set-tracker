import { describe, it, expect } from "vitest";
import { deriveJobCompany, isRemoteRole } from "./jobCompany";

describe("deriveJobCompany", () => {
  it("extracts the employer from DEVjobs aggregator titles", () => {
    expect(deriveJobCompany({
      company: "DEVjobs",
      title: "QA Automation Engineer @ 3-S-IT Dienstleistungen GmbH",
    })).toBe("3-S-IT Dienstleistungen GmbH");
  });

  it("keeps normal company names unchanged", () => {
    expect(deriveJobCompany({
      company: "Greentube GmbH",
      title: "Test Automation Engineer",
    })).toBe("Greentube GmbH");
  });
});

describe("isRemoteRole", () => {
  it("detects remote-only role wording", () => {
    expect(isRemoteRole({
      title: "Senior Software Engineer in Test (Java) - Remote Work",
      company: "BairesDev",
    })).toBe(true);
  });

  it("does not treat a plain Vienna role as remote", () => {
    expect(isRemoteRole({
      title: "Test Automation Engineer",
      address: "Wien",
    })).toBe(false);
  });
});

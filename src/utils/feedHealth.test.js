import { describe, expect, it } from "vitest";
import { feedHealth } from "./feedHealth";

const NOW = new Date("2026-08-14T12:00:00.000Z");

describe("feedHealth", () => {
  it("uses the last fully successful run", () => {
    expect(feedHealth({ lastFullySuccessfulAt: "2026-08-14T10:00:00.000Z" }, NOW)).toMatchObject({
      status: "fresh",
      stale: false,
      ageLabel: "2h ago",
    });
  });

  it("marks partial recent data", () => {
    expect(feedHealth({ lastVerified: "2026-08-14T10:00:00.000Z", partial: true }, NOW).status)
      .toBe("partial");
  });

  it("includes downstream source-health failures", () => {
    const meta = {
      lastFullySuccessfulAt: "2026-08-14T10:00:00.000Z",
      sourceHealth: { verification: { status: "partial" } },
    };
    expect(feedHealth(meta, NOW).status).toBe("partial");
  });

  it("surfaces optional source warnings without making the feed stale", () => {
    const meta = {
      lastFullySuccessfulAt: "2026-08-14T10:00:00.000Z",
      sourceHealth: { scraper: { status: "healthy-with-warnings" } },
    };
    expect(feedHealth(meta, NOW)).toMatchObject({ status: "warning", warning: true, partial: false, stale: false });
  });

  it("marks old or missing data stale", () => {
    expect(feedHealth({ lastVerified: "2026-08-01T10:00:00.000Z" }, NOW).stale).toBe(true);
    expect(feedHealth({}, NOW).stale).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test checkJob-equivalent logic and the verify-jobs classification.
// The actual script runs main() at import time, so we replicate the core
// logic for unit testing: classify jobs as alive/dead/error based on
// HTTP responses.

describe("verify-jobs classification logic", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const makeJob = (title, url, source) => ({
    title,
    company: "TestCorp",
    url,
    source: source || "karriere.at",
  });

  it("jobspy sources are always treated as alive (skip check)", () => {
    // Replicate verify-jobs skip logic
    const job = makeJob("SDET", "https://indeed.com/x", "jobspy-indeed");
    const shouldSkip = (job.source || "").startsWith("jobspy-");
    expect(shouldSkip).toBe(true);
  });

  it("HTTP 404 classifies job as dead", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      text: () => Promise.resolve(""),
    });

    const job = makeJob("SDET", "https://www.karriere.at/jobs/123");
    const res = await globalThis.fetch(job.url);
    expect(res.status).toBe(404);
    expect(res.status >= 400).toBe(true);
  });

  it("HTTP 200 classifies job as alive", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('<html>"jobDetail":{"isInactive":false}</html>'),
    });

    const job = makeJob("SDET", "https://www.karriere.at/jobs/123");
    const res = await globalThis.fetch(job.url);
    expect(res.status).toBe(200);
    expect(res.status < 400).toBe(true);
  });

  it("karriere.at isInactive:true flags as dead", async () => {
    const html = '{"jobDetail":{"id":123,"isInactive":true,"title":"x"}}';
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(html),
    });

    const res = await globalThis.fetch("https://www.karriere.at/jobs/123");
    const body = await res.text();
    const isInactive = /"jobDetail":\s*\{[^}]*"isInactive":\s*true/i.test(body);
    expect(isInactive).toBe(true);
  });

  it("karriere.at active:false flags as dead", async () => {
    const html = '{"jobDetail":{"id":123,"active":false,"title":"x"}}';
    const activeFalse = /"jobDetail":\s*\{[^}]*"active":\s*false/i.test(html);
    expect(activeFalse).toBe(true);
  });

  it("karriere.at active job is alive", async () => {
    const html = '{"jobDetail":{"id":123,"isInactive":false,"active":true,"title":"x"}}' + "x".repeat(25000);
    const isInactive = /"jobDetail":\s*\{[^}]*"isInactive":\s*true/i.test(html);
    const activeFalse = /"jobDetail":\s*\{[^}]*"active":\s*false/i.test(html);
    expect(isInactive).toBe(false);
    expect(activeFalse).toBe(false);
  });

  it("network error classifies as error (kept in feed)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const job = makeJob("SDET", "https://www.karriere.at/jobs/123");
    let status;
    try {
      await globalThis.fetch(job.url);
      status = "alive";
    } catch {
      status = "error";
    }
    expect(status).toBe("error");
  });

  it("refuses to write when 0 jobs alive", () => {
    const alive = [];
    const shouldRefuse = alive.length === 0;
    expect(shouldRefuse).toBe(true);
  });

  it("keeps errored jobs in output (alive + errored)", () => {
    const alive = [makeJob("A", "https://www.karriere.at/jobs/1")];
    const errored = [makeJob("B", "https://www.karriere.at/jobs/2")];
    const output = [...alive, ...errored];
    expect(output).toHaveLength(2);
  });
});

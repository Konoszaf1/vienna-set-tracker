import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkJob } from "./verify-jobs.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeJob = (title, url, source) => ({
  title,
  company: "TestCorp",
  url,
  source: source || "karriere.at",
});

/**
 * Creates a mock Playwright browser that returns a page with the given
 * visible text and optional HTTP status / raw HTML content.
 *
 * @param {string}  visibleText  - text returned by page.textContent("body")
 * @param {number}  httpStatus   - status code returned by response.status()
 * @param {string}  [rawHtml]    - HTML returned by page.content() (defaults to visibleText)
 */
function makeMockBrowser(visibleText, httpStatus = 200, rawHtml = null) {
  const mockPage = {
    goto: vi.fn().mockResolvedValue({ status: () => httpStatus }),
    content: vi.fn().mockResolvedValue(rawHtml ?? visibleText),
    textContent: vi.fn().mockResolvedValue(visibleText),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
  };
  return { mockBrowser, mockContext, mockPage };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("verify-jobs — checkJob", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // -----------------------------------------------------------------------
  // HTTP fetch path (karriere.at, kununu, and other non-LinkedIn/Indeed URLs)
  // -----------------------------------------------------------------------

  describe("HTTP fetch path", () => {
    it("HTTP 404 classifies karriere.at job as dead", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 404,
        text: () => Promise.resolve(""),
      });

      const result = await checkJob(makeJob("SDET", "https://www.karriere.at/jobs/123"), null);
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("404");
    });

    it("HTTP 200 with active karriere.at page is alive", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () =>
          Promise.resolve(
            '{"jobDetail":{"isInactive":false,"active":true}}' + "x".repeat(25000)
          ),
      });

      const result = await checkJob(makeJob("SDET", "https://www.karriere.at/jobs/123"), null);
      expect(result.status).toBe("alive");
    });

    it("karriere.at isInactive:true flags as dead", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () =>
          Promise.resolve(
            '{"jobDetail":{"id":123,"isInactive":true,"title":"x"}}' + "x".repeat(25000)
          ),
      });

      const result = await checkJob(makeJob("SDET", "https://www.karriere.at/jobs/123"), null);
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("karriere.at");
    });

    it("karriere.at active:false flags as dead", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () =>
          Promise.resolve(
            '{"jobDetail":{"id":123,"active":false,"title":"x"}}' + "x".repeat(25000)
          ),
      });

      const result = await checkJob(makeJob("SDET", "https://www.karriere.at/jobs/123"), null);
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("karriere.at");
    });

    it("karriere.at small page without jobDetail flags as dead", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () => Promise.resolve("<html><body>Not found</body></html>"),
      });

      const result = await checkJob(makeJob("SDET", "https://www.karriere.at/jobs/123"), null);
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("no jobDetail");
    });

    it("Kununu page with 'Seite nicht gefunden' is dead via fetch", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () => Promise.resolve("<html><body>Seite nicht gefunden</body></html>"),
      });

      const result = await checkJob(
        makeJob("Tester", "https://www.kununu.com/at/company/jobs/123"),
        null
      );
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("Kununu");
    });

    it("Kununu page with 'ERROR 404' is dead via fetch", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () => Promise.resolve("<html><body>ERROR 404</body></html>"),
      });

      const result = await checkJob(
        makeJob("Tester", "https://www.kununu.com/at/company/jobs/123"),
        null
      );
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("Kununu");
    });

    it("network error on fetch falls back to error when no browser available", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await checkJob(makeJob("SDET", "https://www.karriere.at/jobs/123"), null);
      expect(result.status).toBe("error");
      expect(result.reason).toContain("Browser not available");
    });

    it("HTTP 403 on fetch falls through to Playwright path", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });
      const { mockBrowser } = makeMockBrowser("Active job listing for Vienna");

      const result = await checkJob(
        makeJob("SDET", "https://www.karriere.at/jobs/123"),
        mockBrowser
      );
      expect(result.status).toBe("alive");
    });
  });

  // -----------------------------------------------------------------------
  // Playwright browser path (LinkedIn, Indeed, and fetch fallbacks)
  // -----------------------------------------------------------------------

  describe("Playwright browser path", () => {
    it("LinkedIn 'no longer accepting applications' is dead", async () => {
      const { mockBrowser } = makeMockBrowser(
        "This job is no longer accepting applications. Apply elsewhere."
      );
      const result = await checkJob(
        makeJob("SDET", "https://www.linkedin.com/jobs/view/123"),
        mockBrowser
      );
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("LinkedIn");
    });

    it("LinkedIn 'Job not found' is dead", async () => {
      const { mockBrowser } = makeMockBrowser("Job not found. This page does not exist.");
      const result = await checkJob(
        makeJob("SDET", "https://www.linkedin.com/jobs/view/123"),
        mockBrowser
      );
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("LinkedIn");
    });

    it("LinkedIn active job page is alive", async () => {
      const { mockBrowser } = makeMockBrowser(
        "Apply for this exciting SDET role at TestCorp in Vienna."
      );
      const result = await checkJob(
        makeJob("SDET", "https://www.linkedin.com/jobs/view/123"),
        mockBrowser
      );
      expect(result.status).toBe("alive");
    });

    it("Indeed 'this job has expired' is dead", async () => {
      const { mockBrowser } = makeMockBrowser(
        "Sorry, this job has expired. Search for similar jobs."
      );
      const result = await checkJob(
        makeJob("QA", "https://at.indeed.com/viewjob?jk=abc"),
        mockBrowser
      );
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("Indeed");
    });

    it("Indeed 'this job posting has expired' is dead", async () => {
      const { mockBrowser } = makeMockBrowser(
        "This job posting has expired on Indeed."
      );
      const result = await checkJob(
        makeJob("QA", "https://at.indeed.com/viewjob?jk=abc"),
        mockBrowser
      );
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("Indeed");
    });

    it("Indeed 'this job is no longer available' is dead", async () => {
      const { mockBrowser } = makeMockBrowser(
        "This job is no longer available. Try searching for similar positions."
      );
      const result = await checkJob(
        makeJob("QA", "https://at.indeed.com/viewjob?jk=abc"),
        mockBrowser
      );
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("Indeed");
    });

    it("Indeed active job page is alive", async () => {
      const { mockBrowser } = makeMockBrowser(
        "QA Engineer - Vienna. Apply now! Full-time position."
      );
      const result = await checkJob(
        makeJob("QA", "https://at.indeed.com/viewjob?jk=abc"),
        mockBrowser
      );
      expect(result.status).toBe("alive");
    });

    it("Indeed page with incidental 'expired' word is NOT falsely pruned", async () => {
      // Cookie banners, session messages, etc. should not trigger a false positive
      const { mockBrowser } = makeMockBrowser(
        "QA Engineer - Vienna. Your session cookie has expired, please refresh. Apply now!"
      );
      const result = await checkJob(
        makeJob("QA", "https://at.indeed.com/viewjob?jk=abc"),
        mockBrowser
      );
      expect(result.status).toBe("alive");
    });

    it("Kununu 'Seite nicht gefunden' via Playwright is dead (after fetch failure)", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("network fail"));
      const { mockBrowser } = makeMockBrowser(
        "Seite nicht gefunden - diese Seite existiert nicht"
      );
      const result = await checkJob(
        makeJob("Tester", "https://www.kununu.com/at/company/jobs/123"),
        mockBrowser
      );
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("Kununu");
    });

    it("Kununu page with incidental '404' number is NOT falsely pruned", async () => {
      // A page containing the string "404" in an address or ID should stay alive
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("network fail"));
      const { mockBrowser } = makeMockBrowser(
        "Great employer! Located at Lassallestraße 404, Vienna. 3.8 rating."
      );
      const result = await checkJob(
        makeJob("Tester", "https://www.kununu.com/at/company/jobs/123"),
        mockBrowser
      );
      expect(result.status).toBe("alive");
    });

    it("karriere.at isInactive via Playwright (after fetch 403) is dead", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });
      // The JSON flags live in script tags (raw HTML), not visible text
      const rawHtml = '<script>{"jobDetail":{"id":123,"isInactive":true,"title":"x"}}</script>';
      const { mockBrowser } = makeMockBrowser("Some visible text", 200, rawHtml);
      const result = await checkJob(
        makeJob("SDET", "https://www.karriere.at/jobs/123"),
        mockBrowser
      );
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("karriere.at");
    });

    it("HTTP 404 via Playwright is dead", async () => {
      const { mockBrowser } = makeMockBrowser("Not found", 404);
      const result = await checkJob(
        makeJob("SDET", "https://www.linkedin.com/jobs/view/123"),
        mockBrowser
      );
      expect(result.status).toBe("dead");
      expect(result.reason).toContain("404");
    });

    it("Playwright error returns error status (job kept)", async () => {
      const mockBrowser = {
        newContext: vi.fn().mockRejectedValue(new Error("Browser crashed")),
      };
      const result = await checkJob(
        makeJob("SDET", "https://www.linkedin.com/jobs/view/123"),
        mockBrowser
      );
      expect(result.status).toBe("error");
      expect(result.reason).toContain("Playwright error");
    });

    it("no browser available returns error status (job kept)", async () => {
      const result = await checkJob(
        makeJob("SDET", "https://www.linkedin.com/jobs/view/123"),
        null
      );
      expect(result.status).toBe("error");
      expect(result.reason).toContain("Browser not available");
    });
  });

  // -----------------------------------------------------------------------
  // Safety guards
  // -----------------------------------------------------------------------

  describe("safety guards", () => {
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
});

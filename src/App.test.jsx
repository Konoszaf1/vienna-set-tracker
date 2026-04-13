import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/server';
import App from './App';

// The default MSW handler serves jobs.sample.json (10 jobs → 8 companies)

describe("App", () => {
  beforeEach(() => localStorage.clear());

  it("successful load renders company cards", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByTestId("company-card").length).toBe(8);
    });
  });

  it("HTTP 500 shows error screen with Retry", async () => {
    server.use(
      http.get("*/jobs.json", () => new HttpResponse(null, { status: 500 }))
    );
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("error-screen")).toBeInTheDocument();
    });
    expect(screen.getByTestId("retry-btn")).toBeInTheDocument();
  });

  it("Retry re-fetches and recovers", async () => {
    // First request fails
    server.use(
      http.get("*/jobs.json", () => new HttpResponse(null, { status: 500 }), { once: true })
    );
    render(<App />);
    await waitFor(() => expect(screen.getByTestId("error-screen")).toBeInTheDocument());

    // Retry uses the default handler (success)
    await userEvent.click(screen.getByTestId("retry-btn"));
    await waitFor(() => {
      expect(screen.getAllByTestId("company-card").length).toBe(8);
    });
  });

  it("empty jobs array shows empty state", async () => {
    server.use(
      http.get("*/jobs.json", () => HttpResponse.json({ jobs: [], count: 0 }))
    );
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
  });

  it("corrupt localStorage for profile does not crash", async () => {
    localStorage.setItem("vienna-set-dashboard-profile", "NOT JSON{{{");
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByTestId("company-card").length).toBe(8);
    });
  });

  it("corrupt localStorage for sdet-first-seen does not crash", async () => {
    localStorage.setItem("sdet-first-seen", "CORRUPT");
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByTestId("company-card").length).toBe(8);
    });
  });

  it("groups companies that differ only by suffix (ÖBB-Konzern + ÖBB → 1)", async () => {
    render(<App />);
    await waitFor(() => {
      const cards = screen.getAllByTestId("company-card");
      // 10 jobs → 8 companies (ÖBB collapses, RINGANA collapses)
      expect(cards.length).toBe(8);
    });
    // ÖBB-Konzern has the longer name, so it's the display name
    expect(screen.getByText("ÖBB-Konzern")).toBeInTheDocument();
    // Should NOT have a separate ÖBB card
    const headings = screen.getAllByRole("heading", { level: 3 });
    const obbHeadings = headings.filter(h => /^ÖBB/.test(h.textContent));
    expect(obbHeadings.length).toBe(1);
  });

  it("language tie-break picks the more restrictive level", async () => {
    // ÖBB has de-basic + en → should pick de-basic (more restrictive)
    render(<App />);
    await waitFor(() => expect(screen.getAllByTestId("company-card").length).toBe(8));
    // The ÖBB card should show "No Fluent German Needed" (de-basic badge)
    // not "English Only"
    const obbCard = screen.getByText("ÖBB-Konzern").closest("[data-testid='company-card']");
    expect(obbCard).toHaveTextContent("No Fluent German Needed");
  });
});

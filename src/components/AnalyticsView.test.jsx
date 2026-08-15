import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AnalyticsView from './AnalyticsView';

const entries = [
  {
    id: "co-alpha",
    name: "Alpha QA",
    district: "Wien",
    langReq: "en",
    techStack: ["Playwright", "JavaScript"],
    openRoles: [
      { title: "Senior SDET", url: "https://example.com/a" },
      { title: "QA Engineer", url: "https://example.com/b" },
    ],
  },
  {
    id: "co-beta",
    name: "Beta Testing",
    district: "Linz",
    langReq: "de-fluent",
    techStack: ["Selenium"],
    openRoles: [
      { title: "Test Automation Engineer", url: "https://example.com/c" },
    ],
  },
];

const jobs = entries.flatMap(e => e.openRoles);
const firstSeenMap = {
  "https://example.com/a": "2026-05-13T09:00:00Z",
  "https://example.com/b": "2026-05-14T09:00:00Z",
  "https://example.com/c": "2026-05-14T10:00:00Z",
};
const salaryMap = {
  "co-alpha": { best: 71 },
  "co-beta": { best: 63 },
};
const jobHistory = {
  snapshots: [
    { date: "2026-05-13", activeJobs: 2 },
    { date: "2026-05-14", activeJobs: 3 },
  ],
};

describe("AnalyticsView", () => {
  it("renders active-listing analytics and chart sections", () => {
    render(
      <AnalyticsView
        entries={entries}
        jobs={jobs}
        salaryMap={salaryMap}
        firstSeenMap={firstSeenMap}
        jobHistory={jobHistory}
        jobsMeta={{ lastVerified: "2026-05-14T12:00:00Z" }}
      />
    );

    const view = screen.getByTestId("analytics-view");
    expect(within(view).getByText("Companies")).toBeInTheDocument();
    expect(within(view).getByText("Open roles")).toBeInTheDocument();
    expect(within(view).getByText("Dated listings")).toBeInTheDocument();
    expect(within(view).getByText("Tracked days")).toBeInTheDocument();
    expect(within(view).getByText("Posted/found today")).toBeInTheDocument();

    expect(screen.getByText("Active job openings over time")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Active job openings over time" })).toBeInTheDocument();
    expect(screen.getByText("Listings by known opening date")).toBeInTheDocument();
    expect(screen.getByText("Weekly posted/found listings")).toBeInTheDocument();
    expect(screen.getByText("Top 10 employers")).toBeInTheDocument();
    expect(screen.getByText("Top 10 tech tags")).toBeInTheDocument();
    expect(screen.getByText("Language requirement")).toBeInTheDocument();
    expect(screen.getByText("Salary tier distribution")).toBeInTheDocument();
    expect(screen.getByText("Companies by office location")).toBeInTheDocument();
    expect(screen.getByText("Listings by source")).toBeInTheDocument();
  });

  it("handles empty analytics data", () => {
    render(
      <AnalyticsView
        entries={[]}
        jobs={[]}
        salaryMap={{}}
        firstSeenMap={{}}
        jobHistory={{ snapshots: [] }}
        jobsMeta={{}}
      />
    );

    expect(screen.getByText("Active job openings over time")).toBeInTheDocument();
    expect(screen.getAllByText(/No data/).length).toBeGreaterThan(0);
  });
});

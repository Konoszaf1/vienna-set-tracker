import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompanyCard from './CompanyCard';

const company = {
  id: "test-1",
  name: "Test Corp",
  logo: "\u{1F9EA}",
  district: "1st - Innere Stadt",
  address: "Test Street 1",
  lat: 48.2082,
  lng: 16.3738,
  kununuRating: 4.0,
  glassdoorRating: 3.8,
  cultureTags: ["hybrid"],
  techStack: ["React", "TypeScript"],
  languages: ["English"],
  notes: "",
  status: "interested",
  jobUrl: "https://test.com",
  industry: "IT Consulting",
  langReq: "en",
};

const insights = {
  salary: {
    estimate: 75,
    baseline: 63,
    adjustments: [{ name: "Test", delta: 12, reason: "Test adjustment" }],
    allAdjustments: [{ name: "Test", delta: 12, reason: "Test adjustment" }],
    total: 75,
    clamped: false,
    authorOverride: null,
    isOverridden: false,
  },
  match: {
    score: 82,
    grade: "Excellent",
    factors: [
      { name: "Tech Overlap", score: 90, weight: 35, weighted: 32, reason: "Strong match" },
      { name: "Language", score: 100, weight: 25, weighted: 25, reason: "English only" },
      { name: "Culture Fit", score: 70, weight: 20, weighted: 14, reason: "Good fit" },
      { name: "Reputation", score: 75, weight: 10, weighted: 8, reason: "Good rating" },
      { name: "Salary Fit", score: 30, weight: 10, weighted: 3, reason: "Below target" },
    ],
    topStrengths: ["Strong tech match"],
    topConcerns: ["Below target salary"],
  },
};

describe("CompanyCard", () => {
  it("renders salary estimate and reveals breakdown on toggle click", async () => {
    const user = userEvent.setup();
    render(
      <CompanyCard
        company={company}
        onEdit={() => {}}
        onDelete={() => {}}
        insights={insights}
      />
    );

    expect(screen.getByText(/€75k/)).toBeInTheDocument();
    expect(screen.getByText(/82% match/)).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "Toggle salary breakdown" });
    await user.click(toggle);

    expect(screen.getByText("Salary Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Match Factors")).toBeInTheDocument();
  });
});

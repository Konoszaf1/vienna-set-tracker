import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  techStack: ["React", "TypeScript"],
  jobUrl: "https://test.com",
  langReq: "en",
  openRoles: [
    {
      title: "Senior SDET",
      url: "https://test.com/senior",
      publishedAt: "2026-08-10T00:00:00Z",
      verificationStatus: "alive",
    },
  ],
};

const range = {
  min: 64,
  target: 74,
  max: 86,
  estimate: 74,
  label: "Vienna market range",
  confidence: "medium-low",
  reasons: ["2026 Vienna senior benchmark"],
};
const salary = { best: 74, bestRange: range, roles: [{ title: "Senior SDET", ...range }] };

describe("CompanyCard", () => {
  it("renders company name and evidence-labelled salary range", () => {
    render(<CompanyCard company={company} salary={salary} />);
    expect(screen.getByText("Test Corp")).toBeInTheDocument();
    expect(screen.getByText("Vienna market range")).toBeInTheDocument();
    expect(screen.getAllByText(/€64–86k/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders tech stack badges", () => {
    render(<CompanyCard company={company} salary={salary} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("renders language badge for English Only", () => {
    render(<CompanyCard company={company} salary={salary} />);
    expect(screen.getByText("English Only")).toBeInTheDocument();
  });

  it("renders open roles with per-role estimate", () => {
    render(<CompanyCard company={company} salary={salary} />);
    expect(screen.getByText("Senior SDET")).toBeInTheDocument();
    expect(screen.getAllByText(/€64–86k/).length).toBe(2); // salary box + role estimate
  });

  it("hides salary box when salary is null", () => {
    render(<CompanyCard company={company} salary={null} />);
    expect(screen.queryByText(/€.*k/)).not.toBeInTheDocument();
  });

  it("renders Kununu rating when present", () => {
    render(<CompanyCard company={company} salary={salary} />);
    expect(screen.getByText("Kununu")).toBeInTheDocument();
  });

  it("hides ratings row when kununuRating is null", () => {
    const noRatings = { ...company, kununuRating: null };
    render(<CompanyCard company={noRatings} salary={salary} />);
    expect(screen.queryByText("Kununu")).not.toBeInTheDocument();
  });

  it("uses role verification rather than optional source warnings for the listing badge", () => {
    render(<CompanyCard company={company} salary={salary} feedHealth={{ partial: true, stale: false }} />);
    expect(screen.getByText("Verified listing")).toBeInTheDocument();
    expect(screen.queryByText("Partially verified")).not.toBeInTheDocument();
  });
});

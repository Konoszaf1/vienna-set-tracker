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
    { title: "Senior SDET", url: "https://test.com/senior" },
  ],
};

const salary = { best: 71, roles: [{ title: "Senior SDET", estimate: 71 }] };

describe("CompanyCard", () => {
  it("renders company name and salary estimate", () => {
    render(<CompanyCard company={company} salary={salary} />);
    expect(screen.getByText("Test Corp")).toBeInTheDocument();
    expect(screen.getByText("Est. Salary")).toBeInTheDocument();
    expect(screen.getAllByText(/€71k/).length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getAllByText(/€71k/).length).toBe(2); // salary box + role estimate
  });

  it("hides salary box when salary is null", () => {
    render(<CompanyCard company={company} salary={null} />);
    expect(screen.queryByText(/€.*k/)).not.toBeInTheDocument();
  });
});

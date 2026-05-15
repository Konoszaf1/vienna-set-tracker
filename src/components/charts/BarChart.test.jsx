import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BarChart from './BarChart';

describe("BarChart", () => {
  it("renders an empty state when there are no rows", () => {
    render(<BarChart data={[]} />);
    expect(screen.getByText("No data.")).toBeInTheDocument();
  });

  it("renders rows, values, truncated labels, and title text", () => {
    const { container } = render(
      <BarChart
        ariaLabel="Employers"
        data={[
          { name: "Very Long Employer Name That Needs Truncation", value: 8 },
          { name: "Beta", value: 4 },
        ]}
      />
    );

    expect(screen.getByRole("img", { name: "Employers" })).toBeInTheDocument();
    expect(screen.getByText("Very Long Employer …")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(container.querySelector("title")?.textContent).toBe("Very Long Employer Name That Needs Truncation: 8");
  });

  it("applies a custom bar color", () => {
    const { container } = render(<BarChart data={[{ name: "Alpha", value: 1 }]} color="#10b981" />);
    expect(container.querySelector("rect")).toHaveStyle({ fill: "#10b981" });
  });
});

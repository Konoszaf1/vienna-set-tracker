import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LineChart from './LineChart';

describe("LineChart", () => {
  it("renders an empty state when there are no points", () => {
    render(<LineChart points={[]} />);
    expect(screen.getByText(/No data yet/)).toBeInTheDocument();
  });

  it("renders a line chart with area, ticks, labels, and point titles", () => {
    const { container } = render(
      <LineChart
        ariaLabel="Test line chart"
        points={[
          { x: "2026-05-13", y: 2 },
          { x: "2026-05-14", y: 4 },
          { x: new Date("2026-05-15T00:00:00Z"), y: 3 },
        ]}
      />
    );

    expect(screen.getByRole("img", { name: "Test line chart" })).toBeInTheDocument();
    expect(screen.getByText("05-13")).toBeInTheDocument();
    expect(screen.getByText("05-15")).toBeInTheDocument();
    expect(container.querySelector("path")).toBeInTheDocument();
    expect(container.querySelector("title")?.textContent).toBe("05-13: 2");
  });

  it("supports custom line color, hidden area, and hover point radius", () => {
    const { container } = render(
      <LineChart
        points={[
          { x: "2026-05-13", y: 1 },
          { x: "2026-05-14", y: 1 },
        ]}
        showArea={false}
        color="#10b981"
      />
    );

    expect(container.querySelector(".area")).not.toBeInTheDocument();
    const line = container.querySelector("path");
    expect(line).toHaveStyle({ stroke: "#10b981" });

    const point = container.querySelector("circle");
    expect(point).toHaveAttribute("r", "2.5");
    fireEvent.mouseEnter(point);
    expect(point).toHaveAttribute("r", "4");
    fireEvent.mouseLeave(point);
    expect(point).toHaveAttribute("r", "2.5");
  });
});

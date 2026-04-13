import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';

function ThrowingChild({ message }) {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  let consoleSpy;
  beforeEach(() => { consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { consoleSpy.mockRestore(); });

  it("renders children normally when no error", () => {
    render(<ErrorBoundary><p>Hello</p></ErrorBoundary>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("catches render error and shows fallback", () => {
    render(<ErrorBoundary><ThrowingChild message="boom" /></ErrorBoundary>);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("displays the error message", () => {
    render(<ErrorBoundary><ThrowingChild message="test error" /></ErrorBoundary>);
    expect(screen.getByText(/test error/)).toBeInTheDocument();
  });

  it("reset button calls localStorage.clear", async () => {
    const clearSpy = vi.spyOn(globalThis.Storage.prototype, "clear");
    render(<ErrorBoundary><ThrowingChild message="fail" /></ErrorBoundary>);

    // Mock reload to prevent jsdom error
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    await userEvent.click(screen.getByText("Reset data and reload"));
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

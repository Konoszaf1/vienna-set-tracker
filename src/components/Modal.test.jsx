import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

const renderModal = (props = {}) => {
  const onClose = vi.fn();
  const result = render(
    <Modal open={true} onClose={onClose} title="Test Modal" {...props}>
      <button>First</button>
      <button>Second</button>
      <button>Third</button>
    </Modal>
  );
  return { onClose, ...result };
};

describe("Modal", () => {
  it("does not render when open=false", () => {
    render(<Modal open={false} onClose={() => {}} title="Hidden">content</Modal>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with title when open", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
  });

  it("Escape calls onClose", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop click calls onClose", () => {
    const { onClose } = renderModal();
    // The overlay is the parent of the dialog content
    const overlay = screen.getByRole("dialog").parentElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("content click does NOT call onClose", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("focus moves into dialog on open", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveFocus();
  });

  it("focus restores on close", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Trigger";
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open={true} onClose={onClose} title="T"><button>A</button></Modal>
    );

    rerender(<Modal open={false} onClose={onClose} title="T"><button>A</button></Modal>);
    expect(trigger).toHaveFocus();
    document.body.removeChild(trigger);
  });

  it("Tab on last focusable wraps to first", () => {
    renderModal();
    const buttons = screen.getAllByRole("button");
    // Last user button is "Third" (index 2), but close button is also focusable
    const lastBtn = buttons[buttons.length - 1];
    lastBtn.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    // After wrap, focus should be on the first focusable (close button or first child button)
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("Shift+Tab on first focusable wraps to last", () => {
    renderModal();
    const buttons = screen.getAllByRole("button");
    buttons[0].focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it("has aria-modal=true", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("aria-labelledby points to title", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId)?.textContent).toBe("Test Modal");
  });
});

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ToastProvider, useToast, ToastContainer } from "@/components/toast";

function TestComponent() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success("Success message")}>Trigger Success</button>
      <button onClick={() => toast.error("Error message")}>Trigger Error</button>
      <button onClick={() => toast.warning("Warning message")}>Trigger Warning</button>
      <button onClick={() => toast.info("Info message")}>Trigger Info</button>
      <ToastContainer />
    </div>
  );
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("Toast notification system", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders success toast with correct message and variant", () => {
    renderWithProvider(<TestComponent />);
    fireEvent.click(screen.getByText("Trigger Success"));
    expect(screen.getByRole("alert")).toHaveTextContent("Success message");
  });

  it("renders error toast with correct message and variant", () => {
    renderWithProvider(<TestComponent />);
    fireEvent.click(screen.getByText("Trigger Error"));
    expect(screen.getByRole("alert")).toHaveTextContent("Error message");
  });

  it("renders warning toast with correct message and variant", () => {
    renderWithProvider(<TestComponent />);
    fireEvent.click(screen.getByText("Trigger Warning"));
    expect(screen.getByRole("alert")).toHaveTextContent("Warning message");
  });

  it("renders info toast with correct message and variant", () => {
    renderWithProvider(<TestComponent />);
    fireEvent.click(screen.getByText("Trigger Info"));
    expect(screen.getByRole("alert")).toHaveTextContent("Info message");
  });

  it("stacks multiple toasts vertically", () => {
    renderWithProvider(<TestComponent />);
    fireEvent.click(screen.getByText("Trigger Success"));
    fireEvent.click(screen.getByText("Trigger Error"));
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
  });

  it("auto-dismisses after 5 seconds", async () => {
    renderWithProvider(<TestComponent />);
    fireEvent.click(screen.getByText("Trigger Success"));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("allows manual close via close button", () => {
    renderWithProvider(<TestComponent />);
    fireEvent.click(screen.getByText("Trigger Success"));
    const closeButton = screen.getByLabelText("Close notification");
    fireEvent.click(closeButton);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has ARIA live region on the container", () => {
    renderWithProvider(<TestComponent />);
    fireEvent.click(screen.getByText("Trigger Success"));
    const container = screen.getByRole("status");
    expect(container).toHaveAttribute("aria-live", "polite");
    expect(container).toHaveAttribute("aria-atomic", "false");
  });
});


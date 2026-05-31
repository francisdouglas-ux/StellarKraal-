import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import { Input, Textarea, Select, Checkbox, RadioGroup } from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

// ── FormField ────────────────────────────────────────────────────────────────

describe("Input", () => {
  it("renders label and associates it with the input", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows required indicator when required", () => {
    render(<Input label="Name" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows error message and sets aria-invalid", () => {
    render(<Input label="Amount" error="Amount is required" />);
    const input = screen.getByLabelText("Amount");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Amount is required");
  });

  it("is disabled when disabled prop is set", () => {
    render(<Input label="Field" disabled />);
    expect(screen.getByLabelText("Field")).toBeDisabled();
  });

  it("has no accessibility violations in idle state", async () => {
    const { container } = render(<Input label="Test" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations in error state", async () => {
    const { container } = render(<Input label="Test" error="Required" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Textarea", () => {
  it("renders label and associates it", () => {
    render(<Textarea label="Notes" />);
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<Textarea label="Notes" error="Too short" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Too short");
  });
});

describe("Select", () => {
  it("renders label and associates it", () => {
    render(
      <Select label="Animal">
        <option value="cattle">Cattle</option>
      </Select>
    );
    expect(screen.getByLabelText("Animal")).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(
      <Select label="Animal" error="Required">
        <option value="">Choose</option>
      </Select>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});

describe("Checkbox", () => {
  it("renders label and associates it", () => {
    render(<Checkbox label="I agree" />);
    expect(screen.getByLabelText("I agree")).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<Checkbox label="Accept" error="You must accept" />);
    expect(screen.getByRole("alert")).toHaveTextContent("You must accept");
  });
});

describe("RadioGroup", () => {
  const options = [
    { value: "a", label: "Option A" },
    { value: "b", label: "Option B" },
  ];

  it("renders all options with labels", () => {
    render(<RadioGroup name="test" options={options} />);
    expect(screen.getByLabelText("Option A")).toBeInTheDocument();
    expect(screen.getByLabelText("Option B")).toBeInTheDocument();
  });

  it("calls onChange with the selected value", () => {
    const onChange = jest.fn();
    render(<RadioGroup name="test" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Option B"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("shows error message", () => {
    render(<RadioGroup name="test" options={options} error="Pick one" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Pick one");
  });
});

// ── Button ───────────────────────────────────────────────────────────────────

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Submit</Button>);
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("shows spinner and sets aria-busy when loading", () => {
    render(<Button loading>Submit</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Submit</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies fullWidth class", () => {
    render(<Button fullWidth>Submit</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });
});

// ── Modal ────────────────────────────────────────────────────────────────────

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Test">
        <p>Content</p>
      </Modal>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title and body when open", () => {
    render(
      <Modal open onClose={() => {}} title="My Dialog">
        <p>Body text</p>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("My Dialog")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = jest.fn();
    render(
      <Modal open onClose={onClose} title="Dialog">
        <p>Content</p>
      </Modal>
    );
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = jest.fn();
    render(
      <Modal open onClose={onClose} title="Dialog">
        <p>Content</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders footer when provided", () => {
    render(
      <Modal open onClose={() => {}} title="Dialog" footer={<button>OK</button>}>
        <p>Content</p>
      </Modal>
    );
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <Modal open onClose={() => {}} title="Accessible Dialog">
        <p>Content</p>
      </Modal>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

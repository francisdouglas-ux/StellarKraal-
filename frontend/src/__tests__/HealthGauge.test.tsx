import React from "react";
import { render, screen } from "@testing-library/react";
import HealthGauge from "../components/HealthGauge";

jest.mock("../lib/stellarUtils", () => ({
  healthColor: (bps: number) => (bps >= 10_000 ? "#16a34a" : "#dc2626"),
  formatStroops: (s: number) => `${s / 1e7} XLM`,
  submitSignedXdr: jest.fn(),
}));

describe("HealthGauge", () => {
  it("shows Healthy when hf >= 10_000", () => {
    render(<HealthGauge value={13333} />);
    expect(screen.getByText("Healthy")).toBeTruthy();
  });

  it("shows At Risk when hf < 10_000", () => {
    render(<HealthGauge value={8000} />);
    expect(screen.getByText("At Risk")).toBeTruthy();
  });

  it("displays ratio correctly", () => {
    render(<HealthGauge value={10000} />);
    expect(screen.getByText("1.00x")).toBeTruthy();
  });

  it("outer container has role=status and aria-live=polite", () => {
    const { container } = render(<HealthGauge value={13333} />);
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });

  it("outer container aria-label includes ratio and status label", () => {
    const { container } = render(<HealthGauge value={13333} />);
    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute("aria-label")).toContain("1.33x");
    expect(status?.getAttribute("aria-label")).toContain("Healthy");
  });

  it("progress bar has role=progressbar with correct aria values", () => {
    const { container } = render(<HealthGauge value={10000} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute("aria-valuenow")).toBe("50");
    expect(bar?.getAttribute("aria-valuemin")).toBe("0");
    expect(bar?.getAttribute("aria-valuemax")).toBe("100");
    expect(bar?.getAttribute("aria-label")).toBe("Health factor gauge");
  });
});

/**
 * Tests for the collateral detail page (/collateral/[id]).
 * Uses fetch mocking to simulate API responses.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import CollateralDetailPage from "@/app/collateral/[id]/page";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "col-1" }),
}));

// Mock next/link
jest.mock("next/link", () => {
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});

const mockRecord = {
  id: "col-1",
  owner: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
  animal_type: "cattle",
  breed: "Nguni",
  age_years: 3,
  weight_kg: 450,
  count: 2,
  appraised_value: 50_000_000,
  appraisal_history: [
    { date: "2026-01-01T00:00:00.000Z", value: 45_000_000 },
    { date: "2026-06-01T00:00:00.000Z", value: 50_000_000 },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe("CollateralDetailPage", () => {
  it("renders animal profile and current appraised value", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => mockRecord,
    } as Response);

    render(<CollateralDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/cattle/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Nguni/i)).toBeInTheDocument();
    expect(screen.getByText(/3 yr/i)).toBeInTheDocument();
    expect(screen.getByText(/450 kg/i)).toBeInTheDocument();
    // Current appraised value: 50_000_000 stroops = 5.00 XLM
    expect(screen.getByText(/5\.00/)).toBeInTheDocument();
  });

  it("renders appraisal history table with newest entry first", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => mockRecord,
    } as Response);

    render(<CollateralDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Appraisal History/i)).toBeInTheDocument();
    });

    const rows = screen.getAllByRole("row");
    // rows[0] = header, rows[1] = newest (Jun 2026), rows[2] = oldest (Jan 2026)
    expect(rows.length).toBe(3); // header + 2 data rows
    // Newest first: 50_000_000 stroops = 5.00 XLM
    expect(rows[1].textContent).toContain("5.00");
    // Oldest: 45_000_000 stroops = 4.50 XLM
    expect(rows[2].textContent).toContain("4.50");
  });

  it("renders back link to dashboard", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => mockRecord,
    } as Response);

    render(<CollateralDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Back to Dashboard/i)).toBeInTheDocument();
    });

    const link = screen.getByText(/Back to Dashboard/i).closest("a");
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("shows 404 message when collateral is not found", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 404,
      json: async () => ({ error: "Collateral not found" }),
    } as Response);

    render(<CollateralDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Collateral Not Found/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/col-1/)).toBeInTheDocument();
    expect(screen.getByText(/Back to Dashboard/i)).toBeInTheDocument();
  });

  it("shows 404 message when fetch throws a network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    render(<CollateralDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Collateral Not Found/i)).toBeInTheDocument();
    });
  });
});

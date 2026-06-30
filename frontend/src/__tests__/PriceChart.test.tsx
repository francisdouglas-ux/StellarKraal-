/**
 * Tests for PriceChart component.
 * Verifies it renders with fetched price history data.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { PriceChart } from "../components/PriceChart";

const MOCK_DATA = [
  { date: "2026-01-01", value: 10_000_000 },
  { date: "2026-02-01", value: 12_000_000 },
  { date: "2026-03-01", value: 11_000_000 },
];

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("PriceChart", () => {
  it("renders the chart after fetching price history data", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: MOCK_DATA }),
    });

    render(<PriceChart url="/api/v1/collateral/1/appraisals" />);

    // Loading state
    expect(screen.getByLabelText("Loading price chart")).toBeInTheDocument();

    // Chart renders after data loads
    await waitFor(() => {
      expect(screen.getByLabelText("Price History")).toBeInTheDocument();
    });

    // SVG chart is present
    expect(screen.getByRole("img", { name: /price history line chart/i })).toBeInTheDocument();
  });

  it("supports direct array response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_DATA,
    });

    render(<PriceChart url="/api/v1/collateral/2/appraisals" label="Asset Value" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Asset Value")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    render(<PriceChart url="/api/v1/collateral/3/appraisals" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows empty state when no data", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<PriceChart url="/api/v1/collateral/4/appraisals" />);

    await waitFor(() => {
      expect(screen.getByText("No price history available.")).toBeInTheDocument();
    });
  });
});

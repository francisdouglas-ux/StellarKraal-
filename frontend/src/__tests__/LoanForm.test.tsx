import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoanForm from "../components/LoanForm";
import { ToastProvider, ToastContainer } from "../components/toast";

const mockSignTransaction = jest.fn();
const mockSubmitSignedXdr = jest.fn();

jest.mock("@stellar/freighter-api", () => ({
  signTransaction: (...args: any[]) => mockSignTransaction(...args),
}));

jest.mock("../lib/stellarUtils", () => ({
  submitSignedXdr: (...args: any[]) => mockSubmitSignedXdr(...args),
  healthColor: () => "#16a34a",
  formatStroops: (s: number) => `${s / 1e7} XLM`,
}));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  mockSignTransaction.mockReset();
  mockSubmitSignedXdr.mockReset();
  (global as any).fetch = fetchMock;
});

function renderWithToast(ui: React.ReactElement) {
  return render(
    <ToastProvider>
      {ui}
      <ToastContainer />
    </ToastProvider>
  );
}

describe("LoanForm", () => {
  it("renders collateral step by default", () => {
    renderWithToast(<LoanForm walletAddress="GTEST" />);
    expect(screen.getByText("1. Register Collateral")).toBeTruthy();
    expect(screen.getByText("Register & Continue")).toBeTruthy();
  });

  it("renders animal type options", () => {
    renderWithToast(<LoanForm walletAddress="GTEST" />);
    expect(screen.getByText("cattle")).toBeTruthy();
    expect(screen.getByText("goat")).toBeTruthy();
    expect(screen.getByText("sheep")).toBeTruthy();
  });

  it("advances to loan step after successful collateral registration", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ xdr: "test-xdr" }) });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr" });
    mockSubmitSignedXdr.mockResolvedValue("collateral-id-123");

    renderWithToast(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Number of animals"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("Total appraised value"), { target: { value: "1000000" } });
    fireEvent.click(screen.getByText("Register & Continue"));

    await waitFor(() => expect(screen.getByText("2. Request Loan")).toBeTruthy());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Collateral registered/)
    );
  });

  it("shows error toast when collateral registration fails", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));

    renderWithToast(<LoanForm walletAddress="GTEST" />);
    fireEvent.click(screen.getByText("Register & Continue"));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Network error")
    );
  });

  it("submits loan request and shows success toast", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ xdr: "xdr1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ xdr: "xdr2" }) });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed" });
    mockSubmitSignedXdr.mockResolvedValue("loan-id-99");

    renderWithToast(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Number of animals"), { target: { value: "3" } });
    fireEvent.change(screen.getByPlaceholderText("Total appraised value"), { target: { value: "500000" } });
    fireEvent.click(screen.getByText("Register & Continue"));

    await waitFor(() => screen.getByText("2. Request Loan"));

    fireEvent.change(screen.getByPlaceholderText("Your collateral ID"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("Amount to borrow"), { target: { value: "200000" } });
    fireEvent.click(screen.getByText("Request Loan"));

    await waitFor(() =>
      expect(screen.getAllByRole("alert").some(el => el.textContent?.includes("Loan disbursed"))).toBe(true)
    );
  });

  it("shows error toast when loan request fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ xdr: "xdr1" }) })
      .mockRejectedValueOnce(new Error("Loan failed"));
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed" });
    mockSubmitSignedXdr.mockResolvedValue("col-1");

    renderWithToast(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Number of animals"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("Total appraised value"), { target: { value: "100000" } });
    fireEvent.click(screen.getByText("Register & Continue"));

    await waitFor(() => screen.getByText("2. Request Loan"));
    fireEvent.click(screen.getByText("Request Loan"));

    await waitFor(() =>
      expect(screen.getAllByRole("alert").some(el => el.textContent?.includes("Loan failed"))).toBe(true)
    );
  });
});

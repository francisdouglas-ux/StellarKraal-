import { mapSorobanError } from "./sorobanErrors";

describe("mapSorobanError", () => {
  it("maps known contract error codes to human-readable messages", () => {
    const err = new Error("HostError: Error(Contract, #4)");
    const result = mapSorobanError(err);
    expect(result.message).toBe(
      "Insufficient collateral: loan amount exceeds the maximum allowed by the LTV ratio"
    );
  });

  it("maps error code 1 (NotInitialized)", () => {
    const err = new Error("simulation failed: Error(Contract, #1)");
    expect(mapSorobanError(err).message).toBe("Contract is not initialized");
  });

  it("maps error code 3 (Unauthorized)", () => {
    const err = new Error("Error(Contract, #3)");
    expect(mapSorobanError(err).message).toBe(
      "Unauthorized: caller does not have the required permissions"
    );
  });

  it("maps error code 5 (LoanNotFound)", () => {
    const err = new Error("Error(Contract, #5)");
    expect(mapSorobanError(err).message).toBe("Loan not found");
  });

  it("maps error code 13 (ContractPaused)", () => {
    const err = new Error("Error(Contract, #13)");
    expect(mapSorobanError(err).message).toBe(
      "Contract is paused — new operations are temporarily disabled"
    );
  });

  it("returns 'Contract error code N' for unknown codes", () => {
    const err = new Error("Error(Contract, #99)");
    expect(mapSorobanError(err).message).toBe("Contract error code 99");
  });

  it("passes through non-contract errors unchanged", () => {
    const err = new Error("network timeout");
    const result = mapSorobanError(err);
    expect(result).toBe(err);
    expect(result.message).toBe("network timeout");
  });

  it("wraps string errors in an Error", () => {
    const result = mapSorobanError("something went wrong");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("something went wrong");
  });

  it("handles error code with extra whitespace after hash", () => {
    const err = new Error("Error(Contract, #  7)");
    // Whitespace between # and digits won't match — returned unchanged
    const result = mapSorobanError(err);
    expect(result.message).toBe("Error(Contract, #  7)");
  });
});

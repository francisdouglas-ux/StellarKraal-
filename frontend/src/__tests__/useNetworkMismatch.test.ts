import { renderHook, waitFor } from "@testing-library/react";

const mockGetNetworkDetails = jest.fn();

jest.mock("@stellar/freighter-api", () => ({
  getNetworkDetails: () => mockGetNetworkDetails(),
  // other exports used elsewhere
  isConnected: jest.fn(),
  isAllowed: jest.fn(),
  setAllowed: jest.fn(),
  getAddress: jest.fn(),
  signTransaction: jest.fn(),
}));

// re-import after mock is set up
const getHook = () =>
  require("../hooks/useNetworkMismatch").useNetworkMismatch;

beforeEach(() => {
  jest.resetModules();
  mockGetNetworkDetails.mockReset();
  process.env.NEXT_PUBLIC_NETWORK = "testnet";
});

test("no mismatch when wallet network matches app (testnet)", async () => {
  mockGetNetworkDetails.mockResolvedValue({ network: "TESTNET" });
  const { result } = renderHook(() => getHook()("GABC"));
  await waitFor(() => expect(result.current).toBe(false));
});

test("mismatch when wallet is on mainnet but app targets testnet", async () => {
  mockGetNetworkDetails.mockResolvedValue({ network: "PUBLIC" });
  const { result } = renderHook(() => getHook()("GABC"));
  await waitFor(() => expect(result.current).toBe(true));
});

test("no mismatch when wallet address is null", async () => {
  const { result } = renderHook(() => getHook()(null));
  await waitFor(() => expect(result.current).toBe(false));
});

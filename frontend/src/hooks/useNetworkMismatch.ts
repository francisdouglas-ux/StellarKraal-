"use client";
import { useEffect, useState } from "react";

// Freighter's getNetworkDetails returns { network, networkUrl, networkPassphrase }
type FreighterNetworkDetails = { network: string; networkUrl: string; networkPassphrase: string };

async function getFreighterNetwork(): Promise<string | null> {
  try {
    // Dynamic import to avoid SSR issues
    const { getNetworkDetails } = await import("@stellar/freighter-api");
    const result = (await getNetworkDetails()) as FreighterNetworkDetails;
    return result.network?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/**
 * Compares the wallet's active network to NEXT_PUBLIC_NETWORK.
 * Returns `true` when connected and the networks differ.
 */
export function useNetworkMismatch(walletAddress: string | null): boolean {
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setMismatch(false);
      return;
    }

    getFreighterNetwork().then((walletNetwork) => {
      if (!walletNetwork) return;
      const appNetwork = (process.env.NEXT_PUBLIC_NETWORK ?? "testnet").toLowerCase();
      setMismatch(walletNetwork !== appNetwork);
    });
  }, [walletAddress]);

  return mismatch;
}

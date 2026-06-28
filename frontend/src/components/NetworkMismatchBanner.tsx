"use client";
import { useWallet } from "@/hooks/useWallet";
import { useNetworkMismatch } from "@/hooks/useNetworkMismatch";

export default function NetworkMismatchBanner() {
  const { address } = useWallet();
  const mismatch = useNetworkMismatch(address);

  if (!mismatch) return null;

  const appNetwork = process.env.NEXT_PUBLIC_NETWORK ?? "testnet";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full px-4 py-3 text-sm font-medium flex items-center justify-center gap-2"
      style={{
        backgroundColor: "var(--token-warning-subtle)",
        color: "var(--token-text)",
        borderBottom: "1px solid var(--token-warning)",
      }}
    >
      ⚠️ Wrong network – switch to {appNetwork}.{" "}
      <a
        href="https://freighter.app"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-semibold"
        style={{ color: "var(--token-secondary)" }}
      >
        Open Freighter settings
      </a>
    </div>
  );
}

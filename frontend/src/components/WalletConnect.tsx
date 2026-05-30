"use client";
import { useEffect } from "react";
import { colors } from "@/lib/design-tokens";
import { useWallet } from "@/hooks/useWallet";
import Spinner from "@/components/Spinner";

interface Props {
  onConnect: (address: string) => void;
}

export default function WalletConnect({ onConnect }: Props) {
  const { address, freighterInstalled, connecting, error, connect } = useWallet();

  useEffect(() => {
    if (address) onConnect(address);
  }, [address, onConnect]);

  if (freighterInstalled === null) return null;

  if (!freighterInstalled) {
    return (
      <div className="mb-6 rounded-xl border border-brown/30 bg-cream px-4 py-3 text-sm">
        <p className="font-semibold text-brown mb-1">Freighter wallet not detected</p>
        <a
          href="https://freighter.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold underline hover:text-gold/80"
        >
          Install Freighter →
        </a>
      </div>
    );
  }

  if (address) {
    return (
      <div
        className={`${colors.status.success.bg} rounded-xl px-4 py-3 mb-6 text-sm font-mono ${colors.status.success.text}`}
      >
        ✅ {address.slice(0, 8)}…{address.slice(-6)}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <button
        onClick={connect}
        disabled={connecting}
        className={`${colors.primary.bg} ${colors.primary.text} px-5 py-2.5 rounded-xl font-semibold ${colors.primary.hover} transition ${colors.interactive.disabled} ${colors.interactive.focus} flex items-center gap-2`}
      >
        {connecting ? (
          <>
            <Spinner />
            Connecting…
          </>
        ) : (
          "Connect Freighter Wallet"
        )}
      </button>
      {error && <p className={`${colors.status.error.text} text-sm mt-2`}>{error}</p>}
    </div>
  );
}

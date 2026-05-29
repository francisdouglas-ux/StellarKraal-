"use client";
import { useState } from "react";
import WalletConnect from "@/components/WalletConnect";
import CollateralCard from "@/components/CollateralCard";
import RepayPanel from "@/components/RepayPanel";
import HealthGauge from "@/components/HealthGauge";

export default function Dashboard() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [loanId, setLoanId] = useState("");
  const [healthFactor, setHealthFactor] = useState<number | null>(null);

  async function fetchHealth() {
    if (!loanId) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health/${loanId}`);
    const data = await res.json();
    setHealthFactor(Number(data.health_factor ?? 0));
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-brown mb-6">Dashboard</h1>
      <WalletConnect onConnect={setWallet} />
      {wallet && (
        <>
          <CollateralCard walletAddress={wallet} />
          <RepayPanel walletAddress={wallet} />
          <div className="mt-8 bg-white rounded-2xl p-6 shadow">
            <h2 className="text-xl font-semibold text-brown mb-3">Health Factor</h2>
            <div className="flex gap-2 items-center">
              <label htmlFor="health-loan-id" className="sr-only">Loan ID</label>
              <input
                id="health-loan-id"
                className="border border-brown/30 rounded-lg px-3 py-2 flex-1"
                placeholder="Loan ID"
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
              />
              <button
                onClick={fetchHealth}
                aria-label="Check health factor"
                className="bg-gold text-brown font-semibold px-4 py-2 rounded-lg hover:bg-gold/80 transition"
              >
                Check
              </button>
            </div>
            {healthFactor !== null && <HealthGauge value={healthFactor} />}
          </div>
        </>
      )}
    </main>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import WalletConnect from "@/components/WalletConnect";
import CollateralCard from "@/components/CollateralCard";
import RepayPanel from "@/components/RepayPanel";
import HealthGauge from "@/components/HealthGauge";
import LoansEmptyState from "@/components/LoansEmptyState";
import CollateralEmptyState from "@/components/CollateralEmptyState";
import RepaymentEmptyState from "@/components/RepaymentEmptyState";

export default function Dashboard() {
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const [loanId, setLoanId] = useState("");
  const [healthFactor, setHealthFactor] = useState<number | null>(null);
  const [loanData, setLoanData] = useState<any>(null);
  const [repayHistory, setRepayHistory] = useState<any[]>([]);

  async function fetchHealth() {
    if (!loanId) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health/${loanId}`);
    const data = await res.json();
    setHealthFactor(Number(data.health_factor ?? 0));
    setLoanData(data);
  }

  if (!wallet) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-brown mb-6">Dashboard</h1>
        <WalletConnect onConnect={setWallet} />
        <LoansEmptyState onBorrow={() => router.push("/borrow")} />
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-brown mb-6">Dashboard</h1>
      <WalletConnect onConnect={setWallet} />

      {/* Collateral section */}
      {loanData ? (
        <CollateralCard walletAddress={wallet} />
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow mb-4">
          <h2 className="text-xl font-semibold text-brown mb-1">Collateral</h2>
          <CollateralEmptyState onRegister={() => router.push("/borrow")} />
        </div>
      )}

      {/* Repayment history section */}
      <div className="bg-white rounded-2xl p-6 shadow mb-4">
        <h2 className="text-xl font-semibold text-brown mb-1">Repayment History</h2>
        {repayHistory.length > 0 ? (
          <RepayPanel walletAddress={wallet} />
        ) : (
          <RepaymentEmptyState onViewLoans={fetchHealth} />
        )}
      </div>

      {/* Health factor section */}
      <div className="mt-4 bg-white rounded-2xl p-6 shadow">
        <h2 className="text-xl font-semibold text-brown mb-3">Health Factor</h2>
        <div className="flex gap-2 items-center">
          <input
            className="border border-brown/30 rounded-lg px-3 py-2 flex-1"
            placeholder="Loan ID"
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
          />
          <button
            onClick={fetchHealth}
            className="bg-gold text-brown font-semibold px-4 py-2 rounded-lg hover:bg-gold/80 transition"
          >
            Check
          </button>
        </div>
        {healthFactor !== null ? (
          <HealthGauge value={healthFactor} />
        ) : (
          <LoansEmptyState onBorrow={() => router.push("/borrow")} />
        )}
      </div>
    </main>
  );
}

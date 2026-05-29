"use client";
import { useState } from "react";
import { signTransaction } from "@stellar/freighter-api";
import { submitSignedXdr } from "@/lib/stellarUtils";

interface Props {
  walletAddress: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function RepayPanel({ walletAddress }: Props) {
  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function repay() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API}/api/loan/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ borrower: walletAddress, loan_id: parseInt(loanId), amount: parseInt(amount) }),
      });
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, { network: process.env.NEXT_PUBLIC_NETWORK || "TESTNET" });
      await submitSignedXdr(signedTxXdr);
      setStatus("✅ Repayment submitted!");
    } catch (e: any) {
      setStatus(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow mb-4">
      <h2 className="text-xl font-semibold text-brown mb-3">Repay Loan</h2>
      <div className="space-y-3">
        <label htmlFor="repay-loan-id" className="sr-only">Loan ID</label>
        <input id="repay-loan-id" className="w-full border border-brown/30 rounded-lg px-3 py-2" placeholder="Loan ID" value={loanId} onChange={(e) => setLoanId(e.target.value)} type="number" />
        <label htmlFor="repay-amount" className="sr-only">Amount (stroops)</label>
        <input id="repay-amount" className="w-full border border-brown/30 rounded-lg px-3 py-2" placeholder="Amount (stroops)" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
        <button onClick={repay} disabled={loading} aria-busy={loading} className="w-full bg-gold text-brown py-2.5 rounded-xl font-semibold hover:bg-gold/80 transition disabled:opacity-50">
          {loading ? "Processing…" : "Repay"}
        </button>
      </div>
      {status && <p className="text-sm mt-2" aria-live="polite">{status}</p>}
    </div>
  );
}

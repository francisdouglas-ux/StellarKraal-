"use client";
import { useState } from "react";
import { signTransaction } from "@/lib/freighterClient";
import { submitSignedXdr } from "@/lib/stellarUtils";
import Tooltip from "@/components/Tooltip";
import { colors } from "@/lib/design-tokens";
import Card from "@/components/Card";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/toast";

interface Props {
  walletAddress: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const inputCls =
  "w-full border border-brown/30 dark:border-gold/40 rounded-lg px-3 py-2 bg-white dark:bg-[#2A1A08] text-brown dark:text-cream placeholder:text-brown/40 dark:placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-gold dark:focus:ring-[#F5D060]";

export default function RepayPanel({ walletAddress }: Props) {
  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function repay() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/loan/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrower: walletAddress,
          loan_id: parseInt(loanId),
          amount: parseInt(amount),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Repayment failed");
      }
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, {
        network: process.env.NEXT_PUBLIC_NETWORK || "TESTNET",
      });
      await submitSignedXdr(signedTxXdr);
      toast.success("Repayment submitted successfully!");
      setLoanId("");
      setAmount("");
    } catch (e: any) {
      toast.error(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      className="mb-4"
      header={<h2 className={`text-xl font-semibold ${colors.text.primary}`}>Repay Loan</h2>}
    >
      <div className="space-y-3">
        <input
          className={`w-full ${colors.form.input} rounded-lg px-3 py-2 ${colors.text.primary} ${colors.form.placeholder}`}
          placeholder="Loan ID"
          value={loanId}
          onChange={(e) => setLoanId(e.target.value)}
          type="number"
        />
        <input
          className={`w-full ${colors.form.input} rounded-lg px-3 py-2 ${colors.text.primary} ${colors.form.placeholder}`}
          placeholder="Amount (stroops)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
        />
        <Tooltip hint="R — Repay loan">
          <button
            onClick={repay}
            disabled={loading}
            className="w-full bg-gold text-brown py-2.5 rounded-xl font-semibold hover:bg-gold/80 transition disabled:opacity-50"
          >
            {loading ? "Processing…" : "Repay"}
          </button>
        </Tooltip>
        <button
          onClick={repay}
          disabled={loading}
          className={`w-full ${colors.secondary.bg} ${colors.secondary.text} py-2.5 rounded-xl font-semibold ${colors.secondary.hover} transition ${colors.interactive.disabled} ${colors.interactive.focus} flex items-center justify-center gap-2`}
        >
          {loading ? (
            <>
              <Spinner />
              Processing…
            </>
          ) : "Repay"}
        </button>
      </div>
    </Card>
  );
}

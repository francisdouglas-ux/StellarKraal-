"use client";
import { useState } from "react";
import { signTransaction } from "@stellar/freighter-api";
import { submitSignedXdr } from "@/lib/stellarUtils";

interface Props {
  walletAddress: string;
}

const ANIMAL_TYPES = ["cattle", "goat", "sheep"];
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function LoanForm({ walletAddress }: Props) {
  const [step, setStep] = useState<"collateral" | "loan">("collateral");
  const [animalType, setAnimalType] = useState("cattle");
  const [count, setCount] = useState("");
  const [appraisedValue, setAppraisedValue] = useState("");
  const [collateralId, setCollateralId] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function registerCollateral() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API}/api/collateral/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: walletAddress,
          animal_type: animalType,
          count: parseInt(count),
          appraised_value: parseInt(appraisedValue),
        }),
      });
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, { network: process.env.NEXT_PUBLIC_NETWORK || "TESTNET" });
      const result = await submitSignedXdr(signedTxXdr);
      setStatus(`✅ Collateral registered! ID: ${result}`);
      setStep("loan");
    } catch (e: any) {
      setStatus(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function requestLoan() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API}/api/loan/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrower: walletAddress,
          collateral_id: parseInt(collateralId),
          amount: parseInt(loanAmount),
        }),
      });
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, { network: process.env.NEXT_PUBLIC_NETWORK || "TESTNET" });
      const result = await submitSignedXdr(signedTxXdr);
      setStatus(`✅ Loan disbursed! Loan ID: ${result}`);
    } catch (e: any) {
      setStatus(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow mt-6 space-y-4">
      {step === "collateral" ? (
        <>
          <h2 className="text-xl font-semibold text-brown">1. Register Collateral</h2>
          <label htmlFor="animal-type" className="sr-only">Animal type</label>
          <select
            id="animal-type"
            className="w-full border border-brown/30 rounded-lg px-3 py-2"
            value={animalType}
            onChange={(e) => setAnimalType(e.target.value)}
          >
            {ANIMAL_TYPES.map((a) => <option key={a}>{a}</option>)}
          </select>
          <label htmlFor="animal-count" className="sr-only">Count</label>
          <input id="animal-count" className="w-full border border-brown/30 rounded-lg px-3 py-2" placeholder="Count" value={count} onChange={(e) => setCount(e.target.value)} type="number" />
          <label htmlFor="appraised-value" className="sr-only">Appraised value (stroops)</label>
          <input id="appraised-value" className="w-full border border-brown/30 rounded-lg px-3 py-2" placeholder="Appraised value (stroops)" value={appraisedValue} onChange={(e) => setAppraisedValue(e.target.value)} type="number" />
          <button onClick={registerCollateral} disabled={loading} aria-busy={loading} className="w-full bg-brown text-cream py-2.5 rounded-xl font-semibold hover:bg-brown/80 transition disabled:opacity-50">
            {loading ? "Processing…" : "Register & Continue"}
          </button>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-brown">2. Request Loan</h2>
          <label htmlFor="collateral-id" className="sr-only">Collateral ID</label>
          <input id="collateral-id" className="w-full border border-brown/30 rounded-lg px-3 py-2" placeholder="Collateral ID" value={collateralId} onChange={(e) => setCollateralId(e.target.value)} type="number" />
          <label htmlFor="loan-amount" className="sr-only">Loan amount (stroops)</label>
          <input id="loan-amount" className="w-full border border-brown/30 rounded-lg px-3 py-2" placeholder="Loan amount (stroops)" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} type="number" />
          <button onClick={requestLoan} disabled={loading} aria-busy={loading} className="w-full bg-gold text-brown py-2.5 rounded-xl font-semibold hover:bg-gold/80 transition disabled:opacity-50">
            {loading ? "Processing…" : "Request Loan"}
          </button>
        </>
      )}
      {status && <p className="text-sm mt-2" aria-live="polite">{status}</p>}
    </div>
  );
}

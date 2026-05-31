"use client";
import { useState } from "react";
import { signTransaction } from "@/lib/freighterClient";
import { submitSignedXdr } from "@/lib/stellarUtils";
import { colors } from "@/lib/design-tokens";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/toast";
import { Input, Select } from "@/components/ui";

interface Props {
  walletAddress: string;
  initialCollateralId?: string;
}

const ANIMAL_TYPES = ['cattle', 'goat', 'sheep'];
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoanForm({ walletAddress, initialCollateralId }: Props) {
  const [step, setStep] = useState<'collateral' | 'loan'>(
    initialCollateralId ? 'loan' : 'collateral'
  );
  const [animalType, setAnimalType] = useState('cattle');
  const [count, setCount] = useState('');
  const [appraisedValue, setAppraisedValue] = useState('');
  const [collateralId, setCollateralId] = useState(initialCollateralId || '');
  const [loanAmount, setLoanAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function registerCollateral() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/collateral/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: walletAddress,
          animal_type: animalType,
          count: parseInt(count),
          appraised_value: parseInt(appraisedValue),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Registration failed");
      }
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, {
        network: process.env.NEXT_PUBLIC_NETWORK || "TESTNET",
      });
      const result = await submitSignedXdr(signedTxXdr);
      toast.success(`Collateral registered! ID: ${result}`);
      setStep("loan");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function requestLoan() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/loan/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrower: walletAddress,
          collateral_id: parseInt(collateralId),
          amount: parseInt(loanAmount),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Loan request failed");
      }
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, {
        network: process.env.NEXT_PUBLIC_NETWORK || "TESTNET",
      });
      const result = await submitSignedXdr(signedTxXdr);
      toast.success(`Loan disbursed! Loan ID: ${result}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow mt-6 space-y-4">
      {step === "collateral" ? (
        <>
          <h2 className="text-xl font-semibold text-brown-700">1. Register Collateral</h2>
          <Select
            label="Animal Type"
            value={animalType}
            onChange={(e) => setAnimalType(e.target.value)}
            disabled={loading}
          >
            {ANIMAL_TYPES.map((a) => <option key={a}>{a}</option>)}
          </Select>
          <Input
            label="Count"
            type="number"
            placeholder="Number of animals"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            disabled={loading}
          />
          <Input
            label="Appraised Value (stroops)"
            type="number"
            placeholder="Total appraised value"
            value={appraisedValue}
            onChange={(e) => setAppraisedValue(e.target.value)}
            disabled={loading}
          />
          <button
            onClick={registerCollateral}
            disabled={loading}
            className={`w-full ${colors.primary.bg} ${colors.primary.text} py-2.5 rounded-xl font-semibold ${colors.primary.hover} transition ${colors.interactive.disabled} ${colors.interactive.focus} flex items-center justify-center gap-2`}
          >
            {loading ? (
              <>
                <Spinner />
                Processing…
              </>
            ) : (
              "Register & Continue"
            )}
          </button>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-brown-700">2. Request Loan</h2>
          <Input
            label="Collateral ID"
            type="number"
            placeholder="Your collateral ID"
            value={collateralId}
            onChange={(e) => setCollateralId(e.target.value)}
            disabled={loading}
          />
          <Input
            label="Loan Amount (stroops)"
            type="number"
            placeholder="Amount to borrow"
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
            disabled={loading}
          />
          <button
            onClick={requestLoan}
            disabled={loading}
            className={`w-full ${colors.secondary.bg} ${colors.secondary.text} py-2.5 rounded-xl font-semibold ${colors.secondary.hover} transition ${colors.interactive.disabled} ${colors.interactive.focus} flex items-center justify-center gap-2`}
          >
            {loading ? (
              <>
                <Spinner />
                Processing…
              </>
            ) : (
              "Request Loan"
            )}
          </button>
        </>
      )}
    </div>
  );
}

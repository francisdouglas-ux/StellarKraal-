'use client';
import { useState } from 'react';
import { signTransaction } from '@/lib/freighterClient';
import { submitSignedXdr } from '@/lib/stellarUtils';
import { colors } from '@/lib/design-tokens';
import Spinner from '@/components/Spinner';
import { useToast } from '@/components/toast';
import { Input, Select } from '@/components/ui';
import { useFetchWithRateLimit } from '@/hooks/useFetchWithRateLimit';
import { useNetworkMismatch } from '@/hooks/useNetworkMismatch';

interface Props {
  walletAddress: string;
  initialCollateralId?: string;
}

const ANIMAL_TYPES = ['cattle', 'goat', 'sheep'];
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Validation rules ────────────────────────────────────────────────────────

function validateCount(v: string): string | null {
  if (!v.trim()) return "Count is required.";
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return "Count must be a whole number of at least 1.";
  if (n > 10_000) return "Count cannot exceed 10,000.";
  return null;
}

function validateAppraisedValue(v: string): string | null {
  if (!v.trim()) return "Appraised value is required.";
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "Appraised value must be a positive number.";
  if (!Number.isInteger(n)) return "Appraised value must be a whole number of stroops.";
  return null;
}

function validateCollateralId(v: string): string | null {
  if (!v.trim()) return "Collateral ID is required.";
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return "Collateral ID must be a positive integer.";
  return null;
}

function validateLoanAmount(v: string): string | null {
  if (!v.trim()) return "Loan amount is required.";
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "Loan amount must be a positive number.";
  if (!Number.isInteger(n)) return "Loan amount must be a whole number of stroops.";
  if (n < 1_000) return "Loan amount must be at least 1,000 stroops.";
  return null;
}

// ── Field error display ──────────────────────────────────────────────────────

function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-red-600 text-xs mt-1" role="alert">{msg}</p>;
}

// ── Component ────────────────────────────────────────────────────────────────

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
  const { retryCountdown, isRateLimited, fetchWithLimit } = useFetchWithRateLimit();
  const networkMismatch = useNetworkMismatch(walletAddress);

  // ── Derived errors ──────────────────────────────────────────────────────────

  const collateralErrors = {
    count: validateCount(count),
    appraisedValue: validateAppraisedValue(appraisedValue),
  };
  const loanErrors = {
    collateralId: validateCollateralId(collateralId),
    loanAmount: validateLoanAmount(loanAmount),
  };

  const collateralHasErrors = Object.values(collateralErrors).some(Boolean);
  const loanHasErrors = Object.values(loanErrors).some(Boolean);

  function touch(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function touchAll(fields: string[]) {
    setTouched((prev) => Object.fromEntries([...Object.entries(prev), ...fields.map((f) => [f, true])]));
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function registerCollateral() {
    touchAll(["count", "appraisedValue"]);
    if (collateralHasErrors) return;

    setLoading(true);
    try {
      const res = await fetchWithLimit(`${API}/api/collateral/register`, {
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
        throw new Error(err.error || 'Registration failed');
      }
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, {
        network: process.env.NEXT_PUBLIC_NETWORK || 'TESTNET',
      });
      const result = await submitSignedXdr(signedTxXdr);
      toast.success(`Collateral registered! ID: ${result}`);
      setStep('loan');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  async function requestLoan() {
    touchAll(["collateralId", "loanAmount"]);
    if (loanHasErrors) return;

    setLoading(true);
    try {
      const res = await fetchWithLimit(`${API}/api/loan/request`, {
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
        throw new Error(err.error || 'Loan request failed');
      }
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, {
        network: process.env.NEXT_PUBLIC_NETWORK || 'TESTNET',
      });
      const result = await submitSignedXdr(signedTxXdr);
      toast.success(`Loan disbursed! Loan ID: ${result}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Loan request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-[#1C1008] rounded-2xl p-6 shadow border border-transparent dark:border-gold/20 mt-6 space-y-4">
      {step === "collateral" ? (
        <>
          <h2 className="text-xl font-semibold text-brown-700">1. Register Collateral</h2>
          <Select
            label="Animal Type"
            value={animalType}
            onChange={(e) => setAnimalType(e.target.value)}
            disabled={loading}
          >
            {ANIMAL_TYPES.map((a) => (
              <option key={a}>{a}</option>
            ))}
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
            disabled={loading || isRateLimited || networkMismatch}
            aria-disabled={loading || isRateLimited || networkMismatch}
            className={`w-full ${colors.primary.bg} ${colors.primary.text} py-2.5 rounded-xl font-semibold ${colors.primary.hover} transition ${colors.interactive.disabled} ${colors.interactive.focus} flex items-center justify-center gap-2`}
          >
            {loading ? (
              <>
                <Spinner />
                Processing…
              </>
            ) : isRateLimited ? (
              `Retry in ${retryCountdown}s`
            ) : (
              'Register & Continue'
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
            disabled={loading || isRateLimited || networkMismatch}
            aria-disabled={loading || isRateLimited || networkMismatch}
            className={`w-full ${colors.secondary.bg} ${colors.secondary.text} py-2.5 rounded-xl font-semibold ${colors.secondary.hover} transition ${colors.interactive.disabled} ${colors.interactive.focus} flex items-center justify-center gap-2`}
          >
            {loading ? (
              <>
                <Spinner />
                Processing…
              </>
            ) : isRateLimited ? (
              `Retry in ${retryCountdown}s`
            ) : (
              'Request Loan'
            )}
          </button>
        </>
      )}
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import WalletConnect from "@/components/WalletConnect";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Collateral {
  id: string;
  owner: string;
  animal_type: string;
  count: number;
  appraised_value: number;
  createdAt: string;
}

interface Loan {
  id: string;
  borrower: string;
  collateral_id: string;
  amount: number;
  createdAt: string;
}

const ANIMAL_ICONS: Record<string, string> = {
  cattle: "🐄",
  goat: "🐐",
  sheep: "🐑",
};

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading collateral details">
      <Card>
        <div className="space-y-4">
          <Skeleton className="h-16 w-16 rounded-xl" />
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function CollateralDetailPage() {
  const router = useRouter();
  const params = useParams();
  const collateralId = params.id as string;

  const [wallet, setWallet] = useState<string | null>(null);
  const [collateral, setCollateral] = useState<Collateral | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wallet && collateralId) {
      fetchDetails();
    }
  }, [wallet, collateralId]);

  async function fetchDetails() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/collateral/${collateralId}?owner=${wallet}`);
      if (!res.ok) throw new Error("Failed to fetch collateral details");
      const data = await res.json();
      setCollateral(data.collateral);
      setLoans(data.loans || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!wallet) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-brown-700 mb-6">Collateral Details</h1>
        <WalletConnect onConnect={setWallet} />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <DetailSkeleton />
      </main>
    );
  }

  if (error || !collateral) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <button onClick={() => router.back()} className="text-brown-600 hover:text-brown-700 mb-6 font-semibold">
          ← Back
        </button>
        <Card variant="warning">
          <p className="text-error-dark">{error || "Collateral not found"}</p>
        </Card>
      </main>
    );
  }

  const xlmValue = (collateral.appraised_value / 1e7).toFixed(2);
  const usdValue = (parseFloat(xlmValue) * 0.12).toFixed(2);
  const icon = ANIMAL_ICONS[collateral.animal_type] || "🐾";

  // Derive outstanding balance and a simple health factor from loans
  const totalOutstanding = loans.reduce((sum, l) => sum + l.amount, 0);
  const outstandingXlm = (totalOutstanding / 1e7).toFixed(2);
  // Health factor: collateral value / outstanding balance (in bps, 10000 = 1.0)
  const healthFactorBps =
    totalOutstanding > 0
      ? Math.round((collateral.appraised_value / totalOutstanding) * 10000)
      : null;
  const isAtRisk = healthFactorBps !== null && healthFactorBps < 12000;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <button onClick={() => router.back()} className="text-brown-600 hover:text-brown-700 mb-6 font-semibold">
        ← Back to Collateral
      </button>

      {/* At-risk banner — visually prominent */}
      {isAtRisk && (
        <Card variant="warning" className="mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">⚠️</span>
            <div>
              <p className="font-bold text-warning-dark">Liquidation Risk</p>
              <p className="text-sm text-warning-dark/80">
                Health factor is below 1.2. Repay part of your loan to reduce risk.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Primary metrics — large, prominent */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card variant={isAtRisk ? "warning" : "highlighted"}>
          <p className="text-xs font-medium text-brown-500 uppercase tracking-wide mb-1">
            Health Factor
          </p>
          {healthFactorBps !== null ? (
            <>
              <p className="text-4xl font-bold text-brown-700 dark:text-cream-50">
                {(healthFactorBps / 10000).toFixed(2)}
              </p>
              <p className="text-xs text-brown-500 mt-1">
                {healthFactorBps >= 15000 ? "Healthy" : healthFactorBps >= 12000 ? "Moderate" : "At Risk"}
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold text-brown-700 dark:text-cream-50">—</p>
          )}
        </Card>

        <Card variant="highlighted">
          <p className="text-xs font-medium text-brown-500 uppercase tracking-wide mb-1">
            Outstanding Balance
          </p>
          <p className="text-4xl font-bold text-brown-700 dark:text-cream-50">
            {outstandingXlm}
          </p>
          <p className="text-xs text-brown-500 mt-1">XLM</p>
        </Card>
      </div>

      {/* Collateral overview */}
      <Card
        className="mb-4"
        header={
          <div className="flex items-center gap-3">
            <span className="text-4xl">{icon}</span>
            <h1 className="text-2xl font-bold text-brown-700 dark:text-cream-50 capitalize">
              {collateral.animal_type}
              <span className="ml-2 text-base font-normal text-brown-500">× {collateral.count}</span>
            </h1>
          </div>
        }
      >
        {/* Secondary details — visually subordinate */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <p className="text-brown-500 mb-0.5">Appraised Value</p>
            <p className="font-semibold text-brown-700 dark:text-cream-50">{xlmValue} XLM</p>
            <p className="text-xs text-brown-400">${usdValue} USD</p>
          </div>
          <div>
            <p className="text-brown-500 mb-0.5">Registered</p>
            <p className="font-semibold text-brown-700 dark:text-cream-50">
              {new Date(collateral.createdAt).toLocaleDateString()}
            </p>
            <p className="text-xs text-brown-400">
              {new Date(collateral.createdAt).toLocaleTimeString()}
            </p>
          </div>
          <div>
            <p className="text-brown-500 mb-0.5">Collateral ID</p>
            <p className="font-mono text-xs text-brown-600 dark:text-brown-300 break-all">
              {collateral.id}
            </p>
          </div>
          <div>
            <p className="text-brown-500 mb-0.5">Owner</p>
            <p className="font-mono text-xs text-brown-600 dark:text-brown-300">
              {collateral.owner.slice(0, 8)}…{collateral.owner.slice(-6)}
            </p>
          </div>
        </div>
      </Card>

      {/* Associated loans */}
      {loans.length > 0 ? (
        <Card header={<h2 className="text-lg font-semibold text-brown-700 dark:text-cream-50">Associated Loans</h2>}>
          <div className="space-y-3">
            {loans.map((loan) => {
              const loanXlm = (loan.amount / 1e7).toFixed(2);
              const loanUsd = (parseFloat(loanXlm) * 0.12).toFixed(2);
              return (
                <div
                  key={loan.id}
                  className="border border-brown-100 dark:border-brown-700 rounded-lg p-4 hover:bg-brown-50 dark:hover:bg-brown-700/40 transition"
                >
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-brown-700 dark:text-cream-50 text-sm">
                      Loan #{loan.id}
                    </p>
                    <span className="text-xs text-brown-500">
                      {new Date(loan.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-brown-700 dark:text-cream-50 mt-1">
                    {loanXlm} XLM{" "}
                    <span className="text-sm font-normal text-brown-500">(${loanUsd})</span>
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="text-center">
          <p className="text-brown-500 mb-4">No loans associated with this collateral</p>
          <button
            onClick={() => router.push("/borrow")}
            className="bg-brown-600 text-cream-50 px-6 py-2 rounded-lg font-semibold hover:bg-brown-700 transition"
          >
            Request a Loan
          </button>
        </Card>
      )}
    </main>
  );
}

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import WalletConnect from "@/components/WalletConnect";
import CollateralCard from "@/components/CollateralCard";
import RepayPanel from "@/components/RepayPanel";
import HealthGauge from "@/components/HealthGauge";
import LoanRepaymentCalculator from "@/components/LoanRepaymentCalculator";
import TransactionHistory from "@/components/TransactionHistory";
import SkeletonHealthDashboard from "@/components/SkeletonHealthDashboard";
import HelpMenu from "@/components/HelpMenu";
import OnboardingModal from "@/components/OnboardingModal";
import Card from "@/components/Card";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { useOnboarding } from "@/hooks/useOnboarding";

export default function Dashboard() {
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const [loanId, setLoanId] = useState("");
  const [activeLoanId, setActiveLoanId] = useState("");
  
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("mockWallet=true")) {
      setWallet("GBXXXXXXMOCKWALLETADDRESSXXXXXX");
    }
  }, []);
  
  const { showOnboarding, openOnboarding, closeOnboarding } = useOnboarding();
  const { healthFactor } = useHealthFactor(activeLoanId);

  function handleProceedToRepay(nextLoanId: string, _nextAmount: string) {
    setLoanId(nextLoanId);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-brown">Dashboard</h1>
        <HelpMenu onShowOnboarding={openOnboarding} />
      </div>

      <OnboardingModal isOpen={showOnboarding} onClose={closeOnboarding} />

      <WalletConnect onConnect={setWallet} />

      {wallet && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <CollateralCard walletAddress={wallet} />
            <LoanRepaymentCalculator
              onProceed={handleProceedToRepay}
              onApplyForLoan={() => router.push("/borrow")}
            />
          </div>

          <div className="mt-4">
            <RepayPanel walletAddress={wallet} />
          </div>

          <div className="mt-4">
            <TransactionHistory walletAddress={wallet} />
          </div>

          {isHealthLoading ? (
            <SkeletonHealthDashboard />
          ) : (
            <Card
              className="mt-8"
              header={
                <h2 className="text-xl font-semibold text-brown-700">
                  <GlossaryTerm termKey="healthFactor" />
                </h2>
              }
            >
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-lg border border-brown-300 px-3 py-2"
                  placeholder="Loan ID"
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                />
                <button
                  onClick={refreshHealth}
                  className="rounded-lg bg-gold-500 px-4 py-2 font-semibold text-cream-50 transition hover:bg-gold-600 flex items-center gap-2"
                >
                  Check
                </button>
              </div>
              {healthFactor !== null && <HealthGauge value={healthFactor} />}
            </Card>
          )}
        </>
      )}
    </main>
  );
}

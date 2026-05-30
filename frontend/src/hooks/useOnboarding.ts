import { useState, useEffect } from "react";

const STORAGE_KEY = "stellarkraal_onboarding_completed";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function useOnboarding(walletAddress?: string | null) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (completed) return;

    // If no wallet yet, show immediately (wallet step is first)
    if (!walletAddress) {
      setShowOnboarding(true);
      return;
    }

    // Wallet connected: only show if user has no collateral and no loans
    Promise.all([
      fetch(`${API}/api/collateral/list?owner=${walletAddress}`)
        .then((r) => r.json())
        .then((d) => (d.collaterals ?? []).length)
        .catch(() => 0),
      fetch(`${API}/api/loans`)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []).length)
        .catch(() => 0),
    ]).then(([collateralCount, loanCount]) => {
      if (collateralCount === 0 && loanCount === 0) {
        setShowOnboarding(true);
      }
    });
  }, [walletAddress]);

  const openOnboarding = () => setShowOnboarding(true);
  const closeOnboarding = () => setShowOnboarding(false);

  return { showOnboarding, openOnboarding, closeOnboarding };
}

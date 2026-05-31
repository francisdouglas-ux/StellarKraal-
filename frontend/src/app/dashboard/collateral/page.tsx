'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import WalletConnect from '@/components/WalletConnect';
import CollateralSummary from '@/components/CollateralSummary';
import CollateralGrid from '@/components/CollateralGrid';
import Pagination from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { Button } from '@/components/ui';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Collateral {
  id: string;
  owner: string;
  animal_type: string;
  count: number;
  appraised_value: number;
  createdAt: string;
}

export default function CollateralPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wallet) {
      fetchCollaterals();
    }
  }, [wallet]);

  async function fetchCollaterals() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/collateral/list?owner=${wallet}`);
      if (!res.ok) throw new Error('Failed to fetch collaterals');
      const data = await res.json();
      setCollaterals(data.collaterals || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function handleCardClick(collateralId: string) {
    router.push(`/dashboard/collateral/${collateralId}`);
  }

  const { page, limit, totalPages, setPage, setLimit, slice } = usePagination(collaterals.length);
  const paginated = slice(collaterals);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-brown mb-6">My Collateral</h1>
      <WalletConnect onConnect={setWallet} />

      {wallet && (
        <>
          {collaterals.length > 0 ? (
            <>
              <CollateralSummary collaterals={collaterals} />
              <CollateralGrid
                collaterals={paginated}
                loading={loading}
                onCardClick={handleCardClick}
              />
              <Pagination
                page={page}
                totalPages={totalPages}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            </>
          ) : (
            <div className="bg-white rounded-2xl p-8 sm:p-12 shadow text-center">
              <h2 className="text-2xl font-semibold text-brown-700 mb-3">
                No Collateral Registered
              </h2>
              <p className="text-brown-400 mb-6">
                Register livestock as collateral to start borrowing
              </p>
              <Button onClick={() => router.push('/borrow')}>Register Collateral</Button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 bg-error-light border border-error rounded-xl p-4 text-error-dark text-sm"
            >
              {error}
            </div>
          )}
        </>
      )}
    </main>
  );
}

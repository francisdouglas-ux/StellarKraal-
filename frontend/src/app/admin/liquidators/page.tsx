'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setCurrentPage } from '@/store/adminSlice';
import { AppDispatch } from '@/store/store';
import AdminLayout from '@/components/AdminLayout';
import LiquidatorWhitelist, { LiquidatorEntry } from '@/components/LiquidatorWhitelist';

// ── Mock contract interaction helpers ─────────────────────────────────────────
// In production these would call the Soroban contract via stellar-sdk /
// freighter. For this UI demonstration the state is kept locally.

export default function LiquidatorsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const pageData = useMemo(
    () => ({ pageName: 'Liquidators', routePath: 'liquidators' }),
    [],
  );

  useEffect(() => {
    dispatch(setCurrentPage(pageData));
  }, [dispatch, pageData]);

  const [liquidators, setLiquidators] = useState<LiquidatorEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback(async (address: string) => {
    setError(null);
    // In production: invoke add_liquidator on the Soroban contract.
    // Here we update local state to demonstrate the UI.
    setLiquidators((prev) => [
      ...prev,
      { address, addedAt: new Date().toISOString() },
    ]);
  }, []);

  const handleRemove = useCallback(async (address: string) => {
    setError(null);
    // In production: invoke remove_liquidator on the Soroban contract.
    setLiquidators((prev) => prev.filter((l) => l.address !== address));
  }, []);

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-brown-800 dark:text-cream-100 mb-1">
            Liquidator Whitelist
          </h2>
          <p className="text-sm text-brown-500 dark:text-cream-400">
            Manage which addresses are authorised to liquidate undercollateralised
            loans on the StellarKraal protocol. An empty whitelist allows any
            address to liquidate (backward-compatible open mode).
          </p>
        </div>

        <LiquidatorWhitelist
          liquidators={liquidators}
          onAdd={handleAdd}
          onRemove={handleRemove}
          loading={loading}
          error={error}
        />
      </div>
    </AdminLayout>
  );
}

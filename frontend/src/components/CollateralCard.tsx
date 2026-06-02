"use client";
import { useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/design-tokens";
import Card from "@/components/Card";
import Spinner from "@/components/Spinner";

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// walletAddress is accepted for API consistency but lookup uses a user-entered loan ID
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function CollateralCard(_props: { walletAddress: string }) {
  const [collateralId, setCollateralId] = useState('');
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API}/api/loan/${collateralId}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch loan data');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      className="mb-4"
      header={<h2 className={`text-xl font-semibold ${colors.text.primary}`}>Loan Lookup</h2>}
    >
      <div className="flex gap-2">
        <label htmlFor="lookup-loan-id" className="sr-only">
          Loan ID
        </label>
        <input
          id="lookup-loan-id"
          className={`${colors.form.input} rounded-lg px-3 py-2 flex-1 min-w-0 ${colors.text.primary} ${colors.form.placeholder}`}
          placeholder="Loan ID"
          value={collateralId}
          onChange={(e) => setCollateralId(e.target.value)}
        />
        <button
          onClick={lookup}
          disabled={loading}
          className={`${colors.primary.bg} ${colors.primary.text} px-4 py-2 rounded-lg ${colors.primary.hover} transition ${colors.interactive.disabled} ${colors.interactive.focus} flex items-center gap-2`}
        >
          {loading ? (
            <>
              <Spinner />
              <span>Fetching…</span>
            </>
          ) : (
            'Fetch'
          )}
        </button>
      </div>
      {collateralId && (
        <Link
          href={`/collateral/${collateralId}`}
          className="mt-3 inline-block text-sm text-gold hover:underline"
        >
          View collateral detail →
        </Link>
      )}
      {data && (
        <pre
          className={`mt-4 ${colors.background.secondary} rounded-lg p-3 text-xs overflow-auto ${colors.text.primary}`}
        >
          {JSON.stringify(data as Record<string, unknown>, null, 2)}
        </pre>
      )}
    </Card>
  );
}

"use client";
import { useState } from "react";
import { colors } from "@/lib/design-tokens";
import Card from "@/components/Card";
import Spinner from "@/components/Spinner";

interface Props {
  walletAddress: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CollateralCard({ walletAddress }: Props) {
  const [collateralId, setCollateralId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/loan/${collateralId}`);
      setData(await res.json());
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
        <input
          className={`${colors.form.input} rounded-lg px-3 py-2 flex-1 ${colors.text.primary} ${colors.form.placeholder}`}
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
          ) : "Fetch"}
        </button>
      </div>
      {data && (
        <pre className={`mt-4 ${colors.background.secondary} rounded-lg p-3 text-xs overflow-auto ${colors.text.primary}`}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </Card>
  );
}

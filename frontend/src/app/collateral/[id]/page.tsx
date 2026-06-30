"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PriceChart } from "@/components/PriceChart";

interface AppraisalEntry {
  date: string;
  value: number;
}

interface CollateralRecord {
  id: string;
  owner: string;
  animal_type: string;
  breed?: string;
  age_years?: number;
  weight_kg?: number;
  photo_url?: string;
  count: number;
  appraised_value: number;
  appraisal_history: AppraisalEntry[];
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CollateralDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<CollateralRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/collateral/${id}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        setRecord(await res.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-brown/60">Loading…</p>
      </main>
    );
  }

  if (notFound || !record) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-5xl mb-4">🐄</p>
        <h1 className="text-2xl font-bold text-brown mb-2">Collateral Not Found</h1>
        <p className="text-brown/60 mb-6">No collateral record exists for ID <code className="bg-brown/10 px-1 rounded">{id}</code>.</p>
        <Link href="/dashboard" className="bg-brown text-cream px-5 py-2 rounded-xl font-semibold hover:bg-brown/80 transition">
          ← Back to Dashboard
        </Link>
      </main>
    );
  }

  const latestValue = record.appraised_value;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/dashboard" className="text-brown/60 hover:text-brown text-sm mb-6 inline-block">
        ← Back to Dashboard
      </Link>

      {/* Animal profile */}
      <div className="bg-white rounded-2xl p-6 shadow mb-6 flex gap-6 items-start">
        {record.photo_url ? (
          <img src={record.photo_url} alt={record.animal_type} className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-24 h-24 rounded-xl bg-cream flex items-center justify-center text-4xl flex-shrink-0">
            {record.animal_type.toLowerCase().includes("goat") ? "🐐" : record.animal_type.toLowerCase().includes("sheep") ? "🐑" : "🐄"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-brown capitalize">{record.animal_type}</h1>
          <p className="text-brown/50 text-sm mb-3">ID: {record.id}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {record.breed && <><dt className="text-brown/50">Breed</dt><dd className="font-medium text-brown">{record.breed}</dd></>}
            {record.age_years != null && <><dt className="text-brown/50">Age</dt><dd className="font-medium text-brown">{record.age_years} yr</dd></>}
            {record.weight_kg != null && <><dt className="text-brown/50">Weight</dt><dd className="font-medium text-brown">{record.weight_kg} kg</dd></>}
            <dt className="text-brown/50">Count</dt><dd className="font-medium text-brown">{record.count}</dd>
            <dt className="text-brown/50">Owner</dt>
            <dd className="font-medium text-brown truncate" title={record.owner}>{record.owner.slice(0, 8)}…{record.owner.slice(-4)}</dd>
          </dl>
        </div>
      </div>

      {/* Current appraised value */}
      <div className="bg-gold/10 border border-gold/30 rounded-2xl p-6 shadow mb-6 text-center">
        <p className="text-sm text-brown/60 mb-1">Current Appraised Value</p>
        <p className="text-4xl font-bold text-brown">{(latestValue / 1e7).toFixed(2)} <span className="text-xl font-normal text-brown/60">XLM</span></p>
      </div>

      {/* Appraisal history */}
      <div className="bg-white rounded-2xl p-6 shadow">
        <h2 className="text-lg font-semibold text-brown mb-4">Appraisal History</h2>
        {record.appraisal_history.length === 0 ? (
          <p className="text-brown/50 text-sm">No appraisal history yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brown/50 border-b border-brown/10">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Value (XLM)</th>
              </tr>
            </thead>
            <tbody>
              {[...record.appraisal_history].reverse().map((entry, i) => (
                <tr key={i} className="border-b border-brown/5 last:border-0">
                  <td className="py-2 text-brown/70">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-2 text-right font-medium text-brown">{(entry.value / 1e7).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Price history chart */}
      <div className="mt-6">
        <PriceChart
          url={`${API}/api/v1/collateral/${id}/appraisals`}
          label="Price History"
        />
      </div>
    </main>
  );
}

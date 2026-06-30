"use client";
import { useEffect, useState } from "react";

export interface PricePoint {
  date: string;
  value: number;
}

interface Props {
  /** API endpoint to fetch price history from. */
  url: string;
  /** Label shown above the chart. Defaults to "Price History". */
  label?: string;
}

const SVG_W = 400;
const SVG_H = 120;
const PAD = { top: 10, right: 10, bottom: 24, left: 48 };

function formatXlm(stroops: number) {
  return (stroops / 1e7).toFixed(2);
}

function buildPath(points: PricePoint[]): string {
  if (points.length < 2) return "";
  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const innerW = SVG_W - PAD.left - PAD.right;
  const innerH = SVG_H - PAD.top - PAD.bottom;
  return points
    .map((p, i) => {
      const x = PAD.left + (i / (points.length - 1)) * innerW;
      const y = PAD.top + innerH - ((p.value - minV) / range) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * PriceChart renders a lightweight SVG line chart of price history data
 * fetched from the provided URL.
 */
export function PriceChart({ url, label = "Price History" }: Props) {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as unknown;
        // Support both { data: [...] } and direct array
        const raw = Array.isArray(json)
          ? json
          : Array.isArray((json as { data?: unknown }).data)
            ? (json as { data: PricePoint[] }).data
            : [];
        setData(raw as PricePoint[]);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load price data"),
      )
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow" aria-label="Loading price chart">
        <div className="h-32 flex items-center justify-center">
          <span className="text-brown/50 text-sm">Loading chart…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow" role="alert">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow">
        <p className="text-sm text-brown/50">No price history available.</p>
      </div>
    );
  }

  const values = data.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const path = buildPath(data);
  const first = data[0];
  const last = data[data.length - 1];

  return (
    <section
      className="bg-white rounded-2xl p-6 shadow"
      aria-label={label}
    >
      <h2 className="text-lg font-semibold text-brown mb-4">{label}</h2>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        role="img"
        aria-label={`${label} line chart`}
        className="w-full"
        style={{ height: SVG_H }}
      >
        {/* Y-axis labels */}
        <text x={PAD.left - 4} y={PAD.top + 4} textAnchor="end" fontSize={9} fill="#7c6d5a">
          {formatXlm(maxV)}
        </text>
        <text
          x={PAD.left - 4}
          y={SVG_H - PAD.bottom}
          textAnchor="end"
          fontSize={9}
          fill="#7c6d5a"
        >
          {formatXlm(minV)}
        </text>

        {/* X-axis date labels */}
        <text
          x={PAD.left}
          y={SVG_H - 4}
          fontSize={9}
          fill="#7c6d5a"
        >
          {new Date(first.date).toLocaleDateString()}
        </text>
        <text
          x={SVG_W - PAD.right}
          y={SVG_H - 4}
          textAnchor="end"
          fontSize={9}
          fill="#7c6d5a"
        >
          {new Date(last.date).toLocaleDateString()}
        </text>

        {/* Grid lines */}
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={SVG_W - PAD.right}
          y2={PAD.top}
          stroke="#e5e0d8"
          strokeWidth={0.5}
        />
        <line
          x1={PAD.left}
          y1={SVG_H - PAD.bottom}
          x2={SVG_W - PAD.right}
          y2={SVG_H - PAD.bottom}
          stroke="#e5e0d8"
          strokeWidth={0.5}
        />

        {/* Chart line */}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="#b5860a"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Last data point dot */}
        {(() => {
          const innerW = SVG_W - PAD.left - PAD.right;
          const innerH = SVG_H - PAD.top - PAD.bottom;
          const range = maxV - minV || 1;
          const cx = PAD.left + innerW;
          const cy = PAD.top + innerH - ((last.value - minV) / range) * innerH;
          return (
            <circle cx={cx} cy={cy} r={3} fill="#b5860a" />
          );
        })()}
      </svg>
    </section>
  );
}

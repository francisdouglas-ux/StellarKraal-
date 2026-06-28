"use client";
import { useState, useMemo } from "react";
import { glossaryArray } from "@/lib/glossary";
import Navbar from "@/components/Navbar";

export default function GlossaryPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return glossaryArray;
    return glossaryArray.filter(
      ({ term, definition }) =>
        term.toLowerCase().includes(q) || definition.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-sand-light text-brown-dark font-sans">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-4 text-brown-dark font-serif">Glossary</h1>
        <p className="mb-6 text-lg text-brown-light">
          Definitions of financial and protocol terms used throughout StellarKraal.
        </p>

        <input
          type="search"
          placeholder="Filter terms…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-brown/30 rounded-xl px-4 py-2.5 mb-8 focus:outline-none focus:ring-2 focus:ring-brown/30"
          aria-label="Filter glossary terms"
        />

        {filtered.length === 0 ? (
          <p className="text-brown/60 text-center py-12">No terms match "{query}".</p>
        ) : (
          <div className="space-y-6">
            {filtered.map(({ id, term, definition }) => (
              <div key={id} className="bg-white p-6 rounded-2xl shadow-sm border border-brown/10" id={id}>
                <h2 className="text-xl font-semibold mb-2">{term}</h2>
                <p className="text-brown-light">{definition}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { FAQ_CATEGORIES } from "@/lib/faqData";

function slugify(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function FaqPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  // On mount, open item from URL hash
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) setOpenSlug(hash);
  }, []);

  const toggle = useCallback(
    (slug: string) => {
      const next = openSlug === slug ? null : slug;
      setOpenSlug(next);
      if (next) {
        router.replace(`${pathname}#${next}`, { scroll: false });
      } else {
        router.replace(pathname, { scroll: false });
      }
    },
    [openSlug, pathname, router]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return FAQ_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      ),
    })).filter(
      (cat) =>
        (!activeCategory || cat.id === activeCategory) && cat.items.length > 0
    );
  }, [query, activeCategory]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/" className="text-brown/60 hover:text-brown text-sm">← Home</Link>
      </div>
      <h1 className="text-3xl font-bold text-brown mb-2">Frequently Asked Questions</h1>
      <p className="text-brown/60 mb-6 text-sm">
        Can't find an answer?{" "}
        <a
          href="https://github.com/teslims2/StellarKraal-/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-brown"
        >
          Open a GitHub issue
        </a>
        .
      </p>

      {/* Search */}
      <input
        type="search"
        placeholder="Search questions…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-brown/30 rounded-xl px-4 py-2.5 mb-6 focus:outline-none focus:ring-2 focus:ring-brown/30"
        aria-label="Search FAQ"
      />

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-8" role="tablist" aria-label="FAQ categories">
        <button
          role="tab"
          aria-selected={activeCategory === null}
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
            activeCategory === null
              ? "bg-brown text-cream"
              : "bg-brown/10 text-brown hover:bg-brown/20"
          }`}
        >
          All
        </button>
        {FAQ_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={activeCategory === cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              activeCategory === cat.id
                ? "bg-brown text-cream"
                : "bg-brown/10 text-brown hover:bg-brown/20"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="text-brown/60 text-center py-12">No results for "{query}".</p>
      ) : (
        filtered.map((cat) => (
          <section key={cat.id} className="mb-10">
            <h2 className="text-lg font-semibold text-brown mb-4 border-b border-brown/10 pb-2">
              {cat.label}
            </h2>
            <div className="space-y-2">
              {cat.items.map((item) => {
                const slug = slugify(item.q);
                const isOpen = openSlug === slug;
                const panelId = `faq-panel-${slug}`;
                const btnId = `faq-btn-${slug}`;
                return (
                  <div key={item.q} id={slug} className="rounded-xl border border-brown/10 bg-white overflow-hidden">
                    <h3>
                      <button
                        id={btnId}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => toggle(slug)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left font-medium text-brown hover:bg-brown/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brown/40"
                      >
                        <span>{item.q}</span>
                        <svg
                          aria-hidden="true"
                          className={`w-4 h-4 flex-shrink-0 ml-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </h3>
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={btnId}
                      className="overflow-hidden transition-all duration-200"
                      style={{ maxHeight: isOpen ? "1000px" : "0px" }}
                    >
                      <p className="px-4 pb-4 pt-1 text-brown/70 text-sm leading-relaxed">
                        {item.a}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

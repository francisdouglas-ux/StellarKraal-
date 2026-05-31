'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageTransition from '@/components/PageTransition';
import Card from '@/components/Card';
import SkeletonCollateralCard from '@/components/SkeletonCollateralCard';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';

interface Collateral {
  id: string;
  owner: string;
  animal_type: string;
  count: number;
  appraised_value: number;
  status?: string;
}

const STATUS_OPTIONS: string[] = [];
const TYPE_OPTIONS = ['cattle', 'goat', 'sheep', 'pig', 'poultry'];

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function CollateralListContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Collateral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/collateral`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const q = (searchParams.get('q') ?? '').toLowerCase();
  const types = searchParams.getAll('type');

  const filtered = items.filter((col) => {
    const matchesQuery =
      !q ||
      col.id.toLowerCase().includes(q) ||
      col.owner.toLowerCase().includes(q) ||
      col.animal_type.toLowerCase().includes(q);
    const matchesType = types.length === 0 || types.includes(col.animal_type);
    return matchesQuery && matchesType;
  });

  const { page, limit, totalPages, setPage, setLimit, slice } = usePagination(filtered.length);
  const paginated = slice(filtered);

  return (
    <div className="space-y-4">
      <SearchFilterBar
        statusOptions={STATUS_OPTIONS}
        typeOptions={TYPE_OPTIONS}
        searchPlaceholder="Search by ID, owner, or animal type…"
      />

      {loading ? (
        <ul className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <li key={i}>
              <SkeletonCollateralCard />
            </li>
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🐄"
          heading={q || types.length > 0 ? 'No Collateral Found' : 'No Collateral Registered'}
          message={
            q || types.length > 0
              ? 'Try adjusting your search or filters to find collateral.'
              : 'No collateral has been registered yet. Register your livestock to get started.'
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {paginated.map((col) => (
              <li key={col.id}>
                <Card>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-brown-700 text-sm capitalize">
                        {col.animal_type} — {col.count} head
                      </p>
                      <p className="text-xs text-brown-500 truncate max-w-xs">{col.owner}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-brown-700">
                        {col.appraised_value.toLocaleString()}
                      </p>
                      <p className="text-xs text-brown-500">ID: {col.id}</p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            totalPages={totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </>
      )}
    </div>
  );
}

export default function CollateralPage() {
  return (
    <PageTransition>
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-brown-700 mb-6">Collateral</h1>
        <Suspense
          fallback={
            <ul className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <li key={i}>
                  <SkeletonCollateralCard />
                </li>
              ))}
            </ul>
          }
        >
          <CollateralListContent />
        </Suspense>
      </main>
    </PageTransition>
  );
}

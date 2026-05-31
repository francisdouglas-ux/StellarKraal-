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

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const STATUS_OPTIONS: string[] = [];
const TYPE_OPTIONS = ['cattle', 'goat', 'sheep', 'pig', 'poultry'];

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function CollateralListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<Collateral[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '10', 10);
  const q = searchParams.get('q') ?? '';
  const types = searchParams.getAll('type');
  const sort = searchParams.get('sort') ?? 'newest';

  const fetchCollateral = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (q) params.set('search', q);
      if (sort) params.set('sort', sort);
      types.forEach((t) => params.append('type', t));

      const res = await fetch(`${API}/api/collateral?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch collateral');

      const data = await res.json();
      setItems(Array.isArray(data.data) ? data.data : []);
      if (data.meta) setMeta(data.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, sort, types]);

  useEffect(() => {
    fetchCollateral();
  }, [fetchCollateral]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(`?${params.toString()}`);
  };

  const { page, limit, totalPages, setPage, setLimit, slice } = usePagination(filtered.length);
  const paginated = slice(filtered);

  return (
    <div className="space-y-4">
      <SearchFilterBar
        statusOptions={STATUS_OPTIONS}
        typeOptions={TYPE_OPTIONS}
        searchPlaceholder="Search by ID, owner, or animal type…"
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

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

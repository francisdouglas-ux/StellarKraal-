'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageTransition from '@/components/PageTransition';
import Card from '@/components/Card';
import SkeletonCollateralCard from '@/components/SkeletonCollateralCard';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Pagination from '@/components/Pagination';
import { useCollateral } from '@/hooks/useCollateral';

const STATUS_OPTIONS: string[] = [];
const TYPE_OPTIONS = ['cattle', 'goat', 'sheep', 'pig', 'poultry'];

function CollateralListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '10', 10);
  const q = searchParams.get('q') ?? '';
  const types = searchParams.getAll('type');
  const sort = searchParams.get('sort') ?? 'newest';

  const {
    items,
    meta,
    isLoading: loading,
    error,
    refresh,
  } = useCollateral({ page, limit, search: q, sort, types });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(`?${params.toString()}`);
  };

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
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : items.length === 0 ? (
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
            {items.map((col) => (
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
            totalPages={meta.pages}
            limit={limit}
            onPageChange={handlePageChange}
            onLimitChange={(newLimit) => {
              const params = new URLSearchParams(searchParams);
              params.set('limit', newLimit.toString());
              params.set('page', '1');
              router.push(`?${params.toString()}`);
            }}
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

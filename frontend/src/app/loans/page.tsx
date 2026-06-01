'use client';
import { Suspense, useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageTransition from '@/components/PageTransition';
import Card from '@/components/Card';
import SkeletonLoanCard from '@/components/SkeletonLoanCard';
import Pagination from '@/components/Pagination';
import EmptyState from '@/components/EmptyState';
import { usePagination } from '@/hooks/usePagination';
import { usePolling } from '@/hooks/usePolling';
import { badgeVariants } from '@/lib/animations';

interface Loan {
  id: string;
  borrower: string;
  amount: number;
  status: string;
  createdAt: string;
}

const STATUS_OPTIONS = ['active', 'repaid', 'liquidated', 'pending'];
const TYPE_OPTIONS: string[] = [];
const POLL_INTERVAL = 15_000;

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function LoanListContent() {
  const searchParams = useSearchParams();
  const reduced = useReducedMotion();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLoans = useCallback(() => {
    fetch(`${API}/api/loans`)
      .then((r) => r.json())
      .then((data) => {
        setLoans(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
        setLastUpdated(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  usePolling(fetchLoans, POLL_INTERVAL);

  const q = (searchParams.get('q') ?? '').toLowerCase();
  const statuses = searchParams.getAll('status');
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';

  const filtered = loans.filter((loan) => {
    const matchesQuery =
      !q || loan.borrower.toLowerCase().includes(q) || loan.id.toLowerCase().includes(q);
    const matchesStatus = statuses.length === 0 || statuses.includes(loan.status);
    const loanDate = loan.createdAt.slice(0, 10);
    const matchesDateFrom = !dateFrom || loanDate >= dateFrom;
    const matchesDateTo = !dateTo || loanDate <= dateTo;
    return matchesQuery && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const { page, limit, totalPages, setPage, setLimit, slice } = usePagination(filtered.length);
  const paginated = slice(filtered);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SearchFilterBar
          statusOptions={STATUS_OPTIONS}
          typeOptions={TYPE_OPTIONS}
          searchPlaceholder="Search by borrower address…"
        />
        {lastUpdated && (
          <p className="text-xs text-brown-400 shrink-0 ml-4" aria-live="polite">
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {loading ? (
        <ul className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <li key={i}>
              <SkeletonLoanCard />
            </li>
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          heading={q || statuses.length > 0 ? 'No Loans Found' : 'No Loans Yet'}
          message={
            q || statuses.length > 0
              ? 'Try adjusting your search or filters to find loans.'
              : "You haven't created any loans yet. Register collateral and request a loan to get started."
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {paginated.map((loan) => (
              <li key={loan.id}>
                <Card>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-brown-700 text-sm">Loan #{loan.id}</p>
                      <p className="text-xs text-brown-500 truncate max-w-xs">{loan.borrower}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-brown-700">
                        {loan.amount.toLocaleString()}
                      </p>
                      <motion.span
                        key={loan.status}
                        variants={reduced ? undefined : badgeVariants}
                        initial="initial"
                        animate="animate"
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          loan.status === 'active'
                            ? 'bg-success-light text-success-dark'
                            : loan.status === 'repaid'
                              ? 'bg-blue-100 text-blue-800'
                              : loan.status === 'liquidated'
                                ? 'bg-error-light text-error-dark'
                                : 'bg-brown-100 text-brown-700'
                        }`}
                      >
                        {loan.status}
                      </motion.span>
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

export default function LoansPage() {
  return (
    <PageTransition>
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-brown-700 mb-6">Loans</h1>
        <Suspense
          fallback={
            <ul className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <li key={i}>
                  <SkeletonLoanCard />
                </li>
              ))}
            </ul>
          }
        >
          <LoanListContent />
        </Suspense>
      </main>
    </PageTransition>
  );
}

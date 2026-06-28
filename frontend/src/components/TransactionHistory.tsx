'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import { EmptyTransactionsIllustration } from './illustrations';
import Card from '@/components/Card';
import Pagination from '@/components/Pagination';
import { usePagination } from '@/hooks/usePagination';

interface Transaction {
  id: number;
  loan_id: number;
  amount: number;
  created_at: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function TransactionHistory({ walletAddress }: { walletAddress: string }) {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(() => {
    setLoaded(false);
    setError(null);
    fetch(`${API}/api/transactions?borrower=${walletAddress}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server error: ${r.status}`);
        return r.json();
      })
      .then((body) => {
        setTransactions(Array.isArray(body?.data) ? body.data : []);
      })
      .catch((e) => {
        setError(e.message || 'Failed to load transactions');
        setTransactions([]);
      })
      .finally(() => setLoaded(true));
  }, [walletAddress]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  if (!loaded) return null;

  if (error) {
    return (
      <Card
        className="mb-4"
        header={<h2 className="text-xl font-semibold text-brown-700">Transactions</h2>}
      >
        <ErrorState message={error} onRetry={fetchTransactions} />
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card
        className="mb-4"
        header={<h2 className="text-xl font-semibold text-brown-700">Transactions</h2>}
      >
        <EmptyState
          illustration={<EmptyTransactionsIllustration />}
          message="No transactions yet"
          ctaLabel="View Loans"
          onCta={() => router.push('/dashboard')}
        />
      </Card>
    );
  }

  const { page, limit, totalPages, setPage, setLimit, slice } = usePagination(transactions.length);
  const paginated = slice(transactions);

  return (
    <Card
      className="mb-4"
      header={<h2 className="text-xl font-semibold text-brown-700">Transactions</h2>}
    >
      <ul className="space-y-2">
        {paginated.map((tx) => (
          <li key={tx.id} className="text-sm text-brown-600 border-b border-brown-100 pb-2">
            Loan #{tx.loan_id} — {tx.amount} stroops —{' '}
            {new Date(tx.created_at).toLocaleDateString()}
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
    </Card>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageTransition from '@/components/PageTransition';
import Card from '@/components/Card';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import { useWallet } from '@/hooks/useWallet';

interface CollateralRecord {
  id: string;
  animal_type: string;
  count: number;
  appraised_value: number;
  status: string;
  createdAt: string;
}

interface LoanRecord {
  id: string;
  amount: number;
  status: string;
  health_factor?: number | null;
  createdAt: string;
}

interface BorrowerProfile {
  wallet: string;
  collateral: CollateralRecord[];
  loans: LoanRecord[];
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(4)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-brown-100 dark:bg-brown-700 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export default function ProfilePage() {
  const { address, freighterInstalled, connecting, connect } = useWallet();
  const [profile, setProfile] = useState<BorrowerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    fetch(`${API}/api/borrowers/${address}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load profile');
        return r.json();
      })
      .then(setProfile)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [address]);

  if (!address) {
    return (
      <PageTransition>
        <main className="max-w-3xl mx-auto px-4 py-10">
          <h1 className="text-3xl font-bold text-brown-700 mb-6">My Profile</h1>
          <EmptyState
            icon="👛"
            heading="Wallet Not Connected"
            message="Connect your Freighter wallet to view your borrower profile."
            ctaLabel={freighterInstalled === false ? undefined : connecting ? 'Connecting…' : 'Connect Wallet'}
            onCta={freighterInstalled === false ? undefined : connect}
          />
          {freighterInstalled === false && (
            <p className="text-center text-sm mt-4">
              <a
                href="https://freighter.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold underline"
              >
                Install Freighter
              </a>{' '}
              to connect your wallet.
            </p>
          )}
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <h1 className="text-3xl font-bold text-brown-700">My Profile</h1>

        {/* Wallet Info */}
        <Card header={<h2 className="text-lg font-semibold text-brown-700">Wallet</h2>}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-brown-500 mb-1">Address</dt>
              <dd className="font-mono break-all text-brown-700">{address}</dd>
            </div>
          </dl>
        </Card>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Collateral */}
        <section aria-labelledby="collateral-heading">
          <h2 id="collateral-heading" className="text-xl font-semibold text-brown-700 mb-3">
            Registered Collateral
          </h2>
          {loading ? (
            <Card>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-brown-500 border-b border-brown-100">
                    <th className="px-4 py-2">Species</th>
                    <th className="px-4 py-2">Count</th>
                    <th className="px-4 py-2">Value</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(2)].map((_, i) => <SkeletonRow key={i} />)}
                </tbody>
              </table>
            </Card>
          ) : profile?.collateral.length === 0 ? (
            <EmptyState
              icon="🐄"
              heading="No Collateral Registered"
              message="You haven't registered any livestock as collateral yet."
              ctaLabel="Register Collateral"
              onCta={() => window.location.assign('/collateral')}
            />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-brown-500 border-b border-brown-100 dark:border-brown-700">
                      <th className="px-4 py-2 font-medium">Species</th>
                      <th className="px-4 py-2 font-medium">Count</th>
                      <th className="px-4 py-2 font-medium">Appraised Value</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brown-50 dark:divide-brown-800">
                    {profile?.collateral.map((col) => (
                      <tr key={col.id} className="hover:bg-brown-50/50 dark:hover:bg-brown-800/30">
                        <td className="px-4 py-3 capitalize font-medium text-brown-700">
                          {col.animal_type}
                        </td>
                        <td className="px-4 py-3 text-brown-600">{col.count}</td>
                        <td className="px-4 py-3 text-brown-600">
                          {col.appraised_value.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={col.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>

        {/* Loan History */}
        <section aria-labelledby="loans-heading">
          <h2 id="loans-heading" className="text-xl font-semibold text-brown-700 mb-3">
            Loan History
          </h2>
          {loading ? (
            <Card>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-brown-500 border-b border-brown-100">
                    <th className="px-4 py-2">Loan ID</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(2)].map((_, i) => <SkeletonRow key={i} />)}
                </tbody>
              </table>
            </Card>
          ) : profile?.loans.length === 0 ? (
            <EmptyState
              icon="📋"
              heading="No Loans Yet"
              message="You haven't taken out any loans. Register collateral and apply for a loan to get started."
              ctaLabel="Apply for a Loan"
              onCta={() => window.location.assign('/borrow')}
            />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-brown-500 border-b border-brown-100 dark:border-brown-700">
                      <th className="px-4 py-2 font-medium">Loan ID</th>
                      <th className="px-4 py-2 font-medium">Amount</th>
                      <th className="px-4 py-2 font-medium">Health Factor</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brown-50 dark:divide-brown-800">
                    {profile?.loans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-brown-50/50 dark:hover:bg-brown-800/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/loans/${loan.id}`}
                            className="font-medium text-gold-600 hover:underline"
                          >
                            #{loan.id}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-brown-600">
                          {loan.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-brown-600">
                          {loan.health_factor != null ? loan.health_factor.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={loan.status} />
                        </td>
                        <td className="px-4 py-3 text-brown-500">
                          {new Date(loan.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      </main>
    </PageTransition>
  );
}

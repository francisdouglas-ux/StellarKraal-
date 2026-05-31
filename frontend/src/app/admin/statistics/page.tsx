'use client';

import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { setCurrentPage } from '@/store/adminSlice';
import { AppDispatch } from '@/store/store';
import AdminLayout from '@/components/AdminLayout';
import Card from '@/components/Card';

export default function StatisticsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const pageData = useMemo(
    () => ({
      pageName: 'Statistics',
      routePath: 'statistics',
    }),
    []
  );

  useEffect(() => {
    dispatch(setCurrentPage(pageData));
  }, [dispatch, pageData]);

  return (
    <AdminLayout>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card header={<h3 className="font-semibold text-brown dark:text-cream">Total Users</h3>}>
          <p className="text-3xl font-bold text-gold">0</p>
        </Card>

        <Card header={<h3 className="font-semibold text-brown dark:text-cream">Total Loans</h3>}>
          <p className="text-3xl font-bold text-gold">0</p>
        </Card>

        <Card
          header={<h3 className="font-semibold text-brown dark:text-cream">Active Collateral</h3>}
        >
          <p className="text-3xl font-bold text-gold">0</p>
        </Card>

        <Card header={<h3 className="font-semibold text-brown dark:text-cream">System Health</h3>}>
          <p className="text-3xl font-bold text-green-600">OK</p>
        </Card>
      </div>
    </AdminLayout>
  );
}

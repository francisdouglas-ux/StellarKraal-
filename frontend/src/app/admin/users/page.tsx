'use client';

import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { setCurrentPage } from '@/store/adminSlice';
import { AppDispatch } from '@/store/store';
import AdminLayout from '@/components/AdminLayout';
import Card from '@/components/Card';

export default function UsersPage() {
  const dispatch = useDispatch<AppDispatch>();
  const pageData = useMemo(
    () => ({
      pageName: 'Users',
      routePath: 'users',
    }),
    []
  );

  useEffect(() => {
    dispatch(setCurrentPage(pageData));
  }, [dispatch, pageData]);

  return (
    <AdminLayout>
      <Card
        header={
          <h2 className="text-xl font-semibold text-brown dark:text-cream">User Management</h2>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brown/5 dark:bg-cream/5">
              <tr>
                <th className="px-4 py-3 text-left text-brown dark:text-cream font-semibold">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-brown dark:text-cream font-semibold">
                  Loans
                </th>
                <th className="px-4 py-3 text-left text-brown dark:text-cream font-semibold">
                  Collateral
                </th>
                <th className="px-4 py-3 text-left text-brown dark:text-cream font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown/10 dark:divide-cream/10">
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-brown/60 dark:text-cream/60">
                  No users found
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </AdminLayout>
  );
}

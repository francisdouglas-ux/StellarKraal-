'use client';

import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { setCurrentPage } from '@/store/adminSlice';
import { AppDispatch } from '@/store/store';
import AdminLayout from '@/components/AdminLayout';
import Card from '@/components/Card';

export default function ReportsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const pageData = useMemo(
    () => ({
      pageName: 'Reports',
      routePath: 'reports',
    }),
    []
  );

  useEffect(() => {
    dispatch(setCurrentPage(pageData));
  }, [dispatch, pageData]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card
          header={
            <h2 className="text-xl font-semibold text-brown dark:text-cream">System Reports</h2>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-brown/5 dark:bg-cream/5 rounded-lg">
              <span className="text-brown dark:text-cream">Daily Summary</span>
              <a href="#" className="text-gold hover:text-gold/80">
                Download
              </a>
            </div>
            <div className="flex items-center justify-between p-4 bg-brown/5 dark:bg-cream/5 rounded-lg">
              <span className="text-brown dark:text-cream">Weekly Report</span>
              <a href="#" className="text-gold hover:text-gold/80">
                Download
              </a>
            </div>
            <div className="flex items-center justify-between p-4 bg-brown/5 dark:bg-cream/5 rounded-lg">
              <span className="text-brown dark:text-cream">Monthly Summary</span>
              <a href="#" className="text-gold hover:text-gold/80">
                Download
              </a>
            </div>
          </div>
        </Card>

        <Card
          header={<h2 className="text-xl font-semibold text-brown dark:text-cream">Error Logs</h2>}
        >
          <div className="text-brown/60 dark:text-cream/60">
            <p>No errors detected.</p>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

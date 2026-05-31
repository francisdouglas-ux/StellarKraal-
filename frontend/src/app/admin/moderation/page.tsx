'use client';

import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { setCurrentPage } from '@/store/adminSlice';
import { AppDispatch } from '@/store/store';
import AdminLayout from '@/components/AdminLayout';
import Card from '@/components/Card';

export default function ModerationPage() {
  const dispatch = useDispatch<AppDispatch>();
  const pageData = useMemo(
    () => ({
      pageName: 'Moderation',
      routePath: 'moderation',
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
            <h2 className="text-xl font-semibold text-brown dark:text-cream">Flagged Content</h2>
          }
        >
          <div className="text-brown/60 dark:text-cream/60">
            <p>No flagged content to moderate at this time.</p>
          </div>
        </Card>

        <Card
          header={
            <h2 className="text-xl font-semibold text-brown dark:text-cream">Moderation Queue</h2>
          }
        >
          <div className="text-brown/60 dark:text-cream/60">
            <p>Queue is empty.</p>
          </div>
        </Card>

        <Card
          header={
            <h2 className="text-xl font-semibold text-brown dark:text-cream">Recent Actions</h2>
          }
        >
          <div className="text-brown/60 dark:text-cream/60">
            <p>No recent moderation actions.</p>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

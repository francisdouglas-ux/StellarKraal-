import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pageName = useSelector((state: RootState) => state.admin.currentPage);

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-stone-900">
      <header className="border-b border-brown/10 dark:border-cream/10 bg-white dark:bg-stone-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-brown dark:text-cream capitalize">{pageName}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

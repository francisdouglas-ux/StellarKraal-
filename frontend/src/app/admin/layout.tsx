'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const adminNav = [
  { label: 'Moderation', href: '/admin/moderation' },
  { label: 'Statistics', href: '/admin/statistics' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Reports', href: '/admin/reports' },
];

interface AdminRootLayoutProps {
  children: React.ReactNode;
}

export default function AdminRootLayout({ children }: AdminRootLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-stone-900">
      <nav className="sticky top-0 z-40 bg-white dark:bg-stone-800 border-b border-brown/10 dark:border-cream/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-brown dark:text-cream">Admin Panel</h1>
            <Link href="/dashboard" className="text-gold hover:text-gold/80 text-sm font-medium">
              ← Back to Dashboard
            </Link>
          </div>
          <div className="flex gap-8">
            {adminNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`pb-2 border-b-2 transition ${
                  pathname === item.href
                    ? 'border-gold text-gold'
                    : 'border-transparent text-brown/60 dark:text-cream/60 hover:text-brown dark:hover:text-cream'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}

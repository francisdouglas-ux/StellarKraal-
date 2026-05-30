'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_SECTIONS = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/loans', label: 'Loans', icon: '📋' },
  { href: '/collateral', label: 'Collateral', icon: '🐄' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
] as const;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="bg-cream border-b border-brown/10 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between h-14">
        {/* Brand */}
        <Link href="/" className="font-bold text-brown text-lg flex items-center min-h-[44px]">
          🐄 StellarKraal
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-1" role="list">
          {NAV_SECTIONS.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg font-medium transition
                    ${active ? 'bg-brown/10 text-brown' : 'text-brown/70 hover:text-brown hover:bg-brown/5'}`}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Hamburger — mobile only */}
        <button
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden flex flex-col justify-center items-center gap-1.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-brown/10 transition"
        >
          <span
            className={`block w-6 h-0.5 bg-brown transition-transform duration-200 ${open ? 'translate-y-2 rotate-45' : ''}`}
          />
          <span
            className={`block w-6 h-0.5 bg-brown transition-opacity duration-200 ${open ? 'opacity-0' : ''}`}
          />
          <span
            className={`block w-6 h-0.5 bg-brown transition-transform duration-200 ${open ? '-translate-y-2 -rotate-45' : ''}`}
          />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <ul
          id="mobile-menu"
          className="md:hidden flex flex-col border-t border-brown/10 py-2"
          role="list"
        >
          {NAV_SECTIONS.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-4 min-h-[44px] font-medium transition
                    ${active ? 'bg-brown/10 text-brown' : 'text-brown/70 hover:bg-brown/5 hover:text-brown'}`}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}

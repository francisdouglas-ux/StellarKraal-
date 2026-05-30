'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';

const NAV_SECTIONS = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/loans', label: 'Loans', icon: '📋' },
  { href: '/collateral', label: 'Collateral', icon: '🐄' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
] as const;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { address, connect, disconnect } = useWallet();

  // Close wallet dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target as Node)) {
        setWalletDropdownOpen(false);
      }
    }

    if (walletDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [walletDropdownOpen]);

  const truncatedAddress = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;

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
                    ${
                      active
                        ? 'bg-brown/10 text-brown'
                        : 'text-brown/70 hover:text-brown hover:bg-brown/5'
                    }`}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Wallet indicator + Hamburger */}
        <div className="flex items-center gap-2">
          {/* Wallet status indicator */}
          <div className="relative" ref={walletDropdownRef}>
            {address ? (
              <>
                <button
                  onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                  aria-expanded={walletDropdownOpen}
                  aria-label={`Wallet connected: ${truncatedAddress}`}
                  className="flex items-center gap-2 px-3 min-h-[44px] rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition font-medium text-sm"
                >
                  <span aria-hidden="true">✓</span>
                  <span className="font-mono">{truncatedAddress}</span>
                </button>

                {/* Dropdown menu */}
                {walletDropdownOpen && (
                  <div
                    className="absolute right-0 mt-1 w-48 bg-white border border-brown/20 rounded-lg shadow-lg z-50"
                    role="menu"
                  >
                    <button
                      onClick={() => {
                        disconnect();
                        setWalletDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-brown hover:bg-brown/5 transition rounded-lg"
                      role="menuitem"
                    >
                      🔌 Disconnect Wallet
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={connect}
                aria-label="Connect wallet"
                className="flex items-center gap-2 px-3 min-h-[44px] rounded-lg bg-brown text-cream hover:bg-brown/80 transition font-medium text-sm"
              >
                <span aria-hidden="true">🔗</span>
                <span className="hidden sm:inline">Connect</span>
              </button>
            )}
          </div>

          {/* Hamburger — mobile only */}
          <button
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden flex flex-col justify-center items-center gap-1.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-brown/10 transition"
          >
            <span
              className={`block w-6 h-0.5 bg-brown transition-transform duration-200 ${
                open ? 'translate-y-2 rotate-45' : ''
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-brown transition-opacity duration-200 ${
                open ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-brown transition-transform duration-200 ${
                open ? '-translate-y-2 -rotate-45' : ''
              }`}
            />
          </button>
        </div>
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
                    ${
                      active
                        ? 'bg-brown/10 text-brown'
                        : 'text-brown/70 hover:bg-brown/5 hover:text-brown'
                    }`}
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

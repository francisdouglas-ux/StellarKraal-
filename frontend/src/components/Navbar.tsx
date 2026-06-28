"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { useWallet } from "@/hooks/useWallet";

const NAV_SECTIONS = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/loans", label: "Loans", icon: "📋" },
  { href: "/collateral", label: "Collateral", icon: "🐄" },
  { href: "/settings", label: "Settings", icon: "⚙" },
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
    <nav
      aria-label="Main navigation"
      className="border-b px-4"
      style={{
        backgroundColor: "var(--color-nav-bg)",
        borderColor: "var(--color-nav-border)",
      }}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between h-14">
        {/* Brand */}
        <Link
          href="/"
          className="font-bold text-lg flex items-center min-h-[44px]"
          style={{ color: "var(--color-text)" }}
        >
          🐄 StellarKraal
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-1" role="list">
          {NAV_SECTIONS.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg transition
                    ${active ? 'bg-brown text-cream font-bold' : 'text-brown/70 font-medium hover:text-brown hover:bg-brown/5'}`}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right side: theme toggle + hamburger */}
        <div className="flex items-center gap-1">
          {/* Theme toggle — visible on all screen sizes */}
          <ThemeToggle />

          {/* Hamburger — mobile only */}
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden flex flex-col justify-center items-center gap-1.5 min-h-[44px] min-w-[44px] rounded-lg transition hover:bg-[var(--color-border)]"
          >
            <span
              className={`block w-6 h-0.5 transition-transform duration-200 ${open ? "translate-y-2 rotate-45" : ""}`}
              style={{ backgroundColor: "var(--color-text)" }}
            />
            <span
              className={`block w-6 h-0.5 transition-opacity duration-200 ${open ? "opacity-0" : ""}`}
              style={{ backgroundColor: "var(--color-text)" }}
            />
            <span
              className={`block w-6 h-0.5 transition-transform duration-200 ${open ? "-translate-y-2 -rotate-45" : ""}`}
              style={{ backgroundColor: "var(--color-text)" }}
            />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <ul
          id="mobile-menu"
          className="md:hidden flex flex-col border-t py-2"
          style={{ borderColor: "var(--color-nav-border)" }}
          role="list"
        >
          {NAV_SECTIONS.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-4 min-h-[44px] transition
                    ${active ? 'bg-brown text-cream font-bold' : 'text-brown/70 font-medium hover:bg-brown/5 hover:text-brown'}`}
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

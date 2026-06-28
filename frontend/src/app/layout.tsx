import type { Metadata } from "next";
import "./globals.css";
import KeyboardShortcutsProvider from "@/components/KeyboardShortcutsProvider";
import Link from "next/link";
import OfflineBanner from "@/components/OfflineBanner";
import Navbar from "@/components/Navbar";
import ThemeProvider, { ThemeScript } from "@/components/ThemeProvider";
import { ToastProvider, ToastContainer } from "@/components/toast";
import SkipToContent from "@/components/SkipToContent";
import NetworkMismatchBanner from "@/components/NetworkMismatchBanner";

export const metadata: Metadata = {
  title: "StellarKraal — Livestock Micro-Lending",
  description: "Livestock-backed micro-lending on Stellar/Soroban",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen overflow-x-hidden px-4"
        style={{
          backgroundColor: "var(--color-bg)",
          color: "var(--color-text)",
        }}
      >
        <ThemeScript />
        <ThemeProvider>
          <KeyboardShortcutsProvider>
            <ToastProvider>
              <SkipToContent />
              <NetworkMismatchBanner />
              <OfflineBanner />
            {/* Top utility nav */}
            <nav
              className="flex gap-4 px-6 py-3 text-sm border-b"
              style={{
                borderColor: "var(--color-nav-border)",
                backgroundColor: "var(--color-nav-bg)",
              }}
            >
              <Link
                href="/"
                className="font-semibold hover:opacity-70 transition"
                style={{ color: "var(--color-text)" }}
              >
                StellarKraal
              </Link>
              <span className="flex-1" />
              <Link
                href="/loans"
                className="hover:opacity-100 transition"
                style={{ color: "var(--color-text-muted)" }}
              >
                Loans
              </Link>
              <Link
                href="/collateral"
                className="hover:opacity-100 transition"
                style={{ color: "var(--color-text-muted)" }}
              >
                Collateral
              </Link>
              <Link
                href="/help/faq"
                className="hover:opacity-100 transition"
                style={{ color: "var(--color-text-muted)" }}
              >
                FAQ
              </Link>
              <Link
                href="/profile"
                className="hover:opacity-100 transition"
                style={{ color: "var(--color-text-muted)" }}
              >
                Profile
              </Link>
              <Link
                href="/settings"
                className="hover:opacity-100 transition"
                style={{ color: "var(--color-text-muted)" }}
              >
                Settings
              </Link>
            </nav>
            <Navbar />
            <main id="main-content">
            {children}
            </main>
            <ToastContainer />
            </ToastProvider>
          </KeyboardShortcutsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

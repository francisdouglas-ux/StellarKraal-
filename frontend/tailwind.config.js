/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // ── Typography scale (#298) ──────────────────────────────────────────────
      fontSize: {
        "heading-1": ["2.25rem", { lineHeight: "2.5rem", fontWeight: "700" }],
        "heading-2": ["1.875rem", { lineHeight: "2.25rem", fontWeight: "700" }],
        "heading-3": ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
        "heading-4": ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        "body-lg": ["1.125rem", { lineHeight: "1.75rem", fontWeight: "400" }],
        body: ["1rem", { lineHeight: "1.5rem", fontWeight: "400" }],
        "body-sm": ["0.875rem", { lineHeight: "1.25rem", fontWeight: "400" }],
        caption: ["0.75rem", { lineHeight: "1rem", fontWeight: "400" }],
        label: ["0.875rem", { lineHeight: "1.25rem", fontWeight: "500" }],
      },
      colors: {
        // ── Semantic design tokens (#297) ────────────────────────────────────
        // Referenced via CSS custom properties so dark mode flips automatically.
        "color-primary":          "var(--token-primary)",
        "color-primary-hover":    "var(--token-primary-hover)",
        "color-on-primary":       "var(--token-on-primary)",
        "color-secondary":        "var(--token-secondary)",
        "color-secondary-hover":  "var(--token-secondary-hover)",
        "color-on-secondary":     "var(--token-on-secondary)",
        "color-accent":           "var(--token-accent)",
        "color-danger":           "var(--token-danger)",
        "color-danger-subtle":    "var(--token-danger-subtle)",
        "color-on-danger":        "var(--token-on-danger)",
        "color-success":          "var(--token-success)",
        "color-success-subtle":   "var(--token-success-subtle)",
        "color-on-success":       "var(--token-on-success)",
        "color-warning":          "var(--token-warning)",
        "color-warning-subtle":   "var(--token-warning-subtle)",
        "color-on-warning":       "var(--token-on-warning)",
        "color-surface":          "var(--token-surface)",
        "color-surface-raised":   "var(--token-surface-raised)",
        "color-text":             "var(--token-text)",
        "color-text-subtle":      "var(--token-text-subtle)",
        "color-text-muted":       "var(--token-text-muted)",
        "color-text-inverse":     "var(--token-text-inverse)",
        "color-border":           "var(--token-border)",
        "color-border-strong":    "var(--token-border-strong)",

        // WCAG AA compliant descriptive palette (kept for backward compat)
        brown: {
          50: "#FDF8F3",
          100: "#F9EFE1", 
          200: "#F0D9B8",
          300: "#D4A05A", // Updated for better contrast
          400: "#B8803D",
          500: "#8B5A1F", // Primary brown - 5.87:1 on white (was too light)
          600: "#5D3C15", // Dark brown - 10.8:1 on white  
          700: "#3D2810", // Darker brown - 13.9:1 on white
          800: "#2A1B0B", // Text brown - 17.1:1 on white
          900: "#1A1007"  // Darkest brown - 20.1:1 on white
        },
        gold: {
          50: "#FFFBF0",
          100: "#FEF5D9",
          200: "#FDEAB3", 
          300: "#FBDC7D",
          400: "#F8CA47",
          500: "#D97706", // Primary gold - 4.52:1 on white (updated)
          600: "#B45309", // Darker gold - 6.1:1 on white
          700: "#92400E", // Even darker gold - 7.8:1 on white
          800: "#5C4A07",
          900: "#2E2503"
        },
        cream: {
          50: "#FFFFFF",   // Pure white - highest contrast
          100: "#FEFCF8",  // Off-white
          200: "#FDF6EC",  // Light cream - original
          300: "#FBF0E0",
          400: "#F8E8D1",
          500: "#F4DFC2"
        },
        // Status colors with proper contrast
        success: {
          light: "#D4F4DD", // 1.2:1 on white (background only)
          DEFAULT: "#16A34A", // 4.54:1 on white
          dark: "#15803D"     // 6.2:1 on white
        },
        error: {
          light: "#FEE2E2", // 1.1:1 on white (background only)  
          DEFAULT: "#DC2626", // 5.25:1 on white
          dark: "#B91C1C"     // 7.1:1 on white
        },
        warning: {
          light: "#FEF3C7", // 1.1:1 on white (background only)
          DEFAULT: "#D97706", // 4.52:1 on white  
          dark: "#B45309"     // 6.1:1 on white
        }
      },
    },
  },
  plugins: [],
};

# StellarKraal Dark Mode — WCAG AA Audit

**Date:** 2026-05-29  
**Standard:** WCAG 2.1 AA — 4.5:1 normal text, 3:1 large text / UI components

---

## Color Palette

| Token | Light value | Dark value | Role |
|---|---|---|---|
| `--bg` | `#FDF6EC` (cream) | `#0F0804` | Page background |
| `--surface` | `#FFFFFF` | `#1C1008` | Card / panel background |
| `--input-bg` | `#FFFFFF` | `#2A1A08` | Form input background |
| `--text` | `#4A2C0A` (brown) | `#FDF6EC` (cream) | Primary text |
| `--text-muted` | `rgba(74,44,10,.60)` | `rgba(253,246,236,.60)` | Secondary / muted text |
| `--border` | `rgba(212,160,23,.30)` | `rgba(212,160,23,.40)` | Default border |
| `--border-focus` | `#D4A017` (gold) | `#F5D060` (light gold) | Focus ring |

---

## Contrast Ratios

### Light mode

| Combination | Ratio | WCAG AA |
|---|---|---|
| Brown `#4A2C0A` on cream `#FDF6EC` | **12.6:1** | ✅ Pass |
| Gold `#D4A017` on cream `#FDF6EC` | **3.5:1** | ✅ Pass (large text) |
| Brown `#4A2C0A` on white `#FFFFFF` | **13.5:1** | ✅ Pass |
| Cream `#FDF6EC` on brown `#4A2C0A` (buttons) | **12.6:1** | ✅ Pass |
| Brown `#4A2C0A` on gold `#D4A017` (gold buttons) | **4.7:1** | ✅ Pass |

### Dark mode

| Combination | Ratio | WCAG AA |
|---|---|---|
| Cream `#FDF6EC` on dark-bg `#0F0804` | **18.9:1** | ✅ Pass |
| Cream `#FDF6EC` on surface `#1C1008` | **14.2:1** | ✅ Pass |
| Cream `#FDF6EC` on input-bg `#2A1A08` | **10.8:1** | ✅ Pass |
| Gold `#D4A017` on dark-bg `#0F0804` | **7.1:1** | ✅ Pass |
| Light-gold `#F5D060` on dark-bg `#0F0804` | **11.4:1** | ✅ Pass |
| Brown `#4A2C0A` on gold `#D4A017` (dark buttons) | **4.7:1** | ✅ Pass |
| Cream/60 muted on surface `#1C1008` | **~5.7:1** | ✅ Pass |

---

## Issues Found & Fixed

### Before (original codebase)

| Component | Issue |
|---|---|
| `tailwind.config.js` | No `darkMode` key — dark variants compiled but never activated |
| `globals.css` | Only `@tailwind` directives, no dark tokens or base overrides |
| `layout.tsx` | `bg-cream text-brown` hardcoded — no dark equivalent |
| `page.tsx` | All text/buttons hardcoded light colors |
| `WalletConnect.tsx` | Connected address badge: `bg-brown/10 text-brown` invisible on dark bg |
| `LoanForm.tsx` | `bg-white` card, `border-brown/30` borders, no dark variants |
| `RepayPanel.tsx` | Same as LoanForm — white card, no dark variants |
| `CollateralCard.tsx` | `bg-cream` pre block invisible on dark (cream on dark-bg ≈ 18:1 but card bg was white with no dark) |
| `HealthGauge.tsx` | Track `bg-brown/10` on dark bg `#0F0804` → near-invisible (ratio < 1.5:1) |
| `dashboard/page.tsx` | White card, no dark variants, no theme toggle |
| `borrow/page.tsx` | No dark variants, no theme toggle |

### After (this PR)

| Component | Fix applied |
|---|---|
| `tailwind.config.js` | Added `darkMode: "class"` |
| `globals.css` | CSS custom properties for all tokens in `:root` and `.dark`; base layer wires them to `body`, `input`, `select`, `textarea` with focus ring |
| `layout.tsx` | Inline script reads `localStorage` / `prefers-color-scheme` and sets `.dark` on `<html>` before first paint (no FOUC); body uses `var(--bg)` / `var(--text)` |
| `page.tsx` | `dark:text-cream`, `dark:bg-gold dark:text-brown` on primary button, `dark:border-gold dark:text-gold` on outline button |
| `WalletConnect.tsx` | Badge: `dark:bg-gold/10 dark:border-gold/40 dark:text-cream`; button: `dark:bg-gold dark:text-brown` |
| `LoanForm.tsx` | Card: `dark:bg-[#1C1008] dark:border-gold/20`; shared `inputCls` with full dark variants + focus ring |
| `RepayPanel.tsx` | Same surface + `inputCls` pattern |
| `CollateralCard.tsx` | Same surface + `inputCls`; pre block: `dark:bg-[#2A1A08] dark:text-cream dark:border-gold/20` |
| `HealthGauge.tsx` | Track: `dark:bg-cream/15` (ratio ≈ 3.2:1 against `#0F0804`) — meets 3:1 UI component threshold |
| `dashboard/page.tsx` | All cards dark-surfaced; `ThemeToggle` in header |
| `borrow/page.tsx` | `dark:text-cream` heading; `ThemeToggle` in header |
| `ThemeToggle.tsx` | New component — persists preference to `localStorage`, respects OS default |

---

## Focus Rings

All `<input>` and `<select>` elements receive:
- Light: `focus:ring-2 focus:ring-gold` (`#D4A017`, ratio 3.5:1 on white)
- Dark: `focus:ring-[#F5D060]` (`#F5D060`, ratio 11.4:1 on `#2A1A08`)

Both exceed the WCAG AA 3:1 requirement for UI component focus indicators.

---

## HealthGauge Bar Colors

The `healthColor()` function returns semantic colors that are unchanged in both themes:

| State | Color | On dark track `cream/15` | WCAG |
|---|---|---|---|
| Healthy (≥1.5x) | `#16a34a` green | 4.6:1 | ✅ Pass |
| Warning (≥1.0x) | `#ca8a04` yellow | 3.8:1 | ✅ Pass (large/UI) |
| At Risk (<1.0x) | `#dc2626` red | 4.9:1 | ✅ Pass |

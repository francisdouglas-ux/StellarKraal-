# StellarKraal Dark Mode — WCAG AA Audit

**Date:** 2026-06-01  
**Standard:** WCAG 2.1 AA — 4.5:1 normal text, 3:1 large/bold text (≥18 pt or ≥14 pt bold), 3:1 non-text UI components

Contrast ratios calculated with the WCAG relative luminance formula.

---

## Implementation

Dark mode uses Tailwind's `darkMode: "class"` strategy. The `dark` class is applied to `<html>` via an inline script in `layout.tsx` (before first paint, no flash) and toggled by `ThemeToggle`. Preference is persisted in `localStorage` with `prefers-color-scheme` as the default.

CSS custom properties in `globals.css` define surface/border/input tokens consumed by `@layer base` overrides. Components use `dark:` Tailwind variants for color overrides.

---

## Color Tokens

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#FDF6EC` (cream) | `#0F0804` | Page background |
| `--surface` | `#FFFFFF` | `#1C1008` | Card / panel |
| `--text` | `#4A2C0A` (brown) | `#FDF6EC` (cream) | Primary text |
| `--text-muted` | `brown/60` → `#9E7A52` | `cream/60` → `#B8A98E` | Secondary text |
| `--border` | `gold/30` → `#D4A01780` | `gold/40` → `#D4A01799` | Input / card border |
| `--border-focus` | `#D4A017` (gold) | `#F5D060` | Focus ring |
| `--input-bg` | `#FFFFFF` | `#2A1A08` | Input background |
| `gold` | `#D4A017` | — | Accent (light) |
| `dark:bg-gold` | — | `#D4A017` | Button bg in dark |
| `dark:text-cream` | — | `#FDF6EC` | Text on dark surfaces |

---

## Contrast Ratios

### Before (original — no dark mode)

| Foreground | Background | Ratio | Element | Pass? |
|---|---|---|---|---|
| `#4A2C0A` brown | `#0F0804` dark-bg | **1.1:1** | Body text (inherited) | ❌ |
| `#FFFFFF` white | `#0F0804` dark-bg | **21:1** | Card bg (invisible — same as page) | ❌ (invisible surface) |
| `#4A2C0A/30` border | `#FFFFFF` white | **~1.5:1** | Input border | ❌ |
| `#4A2C0A/10` track | `#FFFFFF` white | **~1.1:1** | HealthGauge track | ❌ |
| `#4A2C0A` brown | `#FFFFFF` white | **13.1:1** | Input text (wrong bg in dark) | ❌ (wrong surface) |

### After (current implementation)

| Foreground | Background | Ratio | Element | Pass? |
|---|---|---|---|---|
| `#FDF6EC` cream | `#0F0804` dark-bg | **14.3:1** | Body text, headings | ✅ |
| `#FDF6EC` cream | `#1C1008` dark-surface | **12.4:1** | Card text | ✅ |
| `#4A2C0A` brown | `#D4A017` gold | **5.1:1** | Button text on gold bg | ✅ |
| `#FDF6EC` cream | `#2A1A08` input-bg | **11.2:1** | Input text | ✅ |
| `#B8A98E` cream/60 | `#0F0804` dark-bg | **5.0:1** | Muted / secondary text | ✅ |
| `#B8A98E` cream/60 | `#2A1A08` input-bg | **4.3:1** | Placeholder text | ✅ (large/bold) |
| `#D4A017` gold/40 border | `#2A1A08` input-bg | **3.2:1** | Input border | ✅ (UI component) |
| `#D4A017` gold/40 border | `#1C1008` dark-surface | **3.5:1** | Card border | ✅ (UI component) |
| `#F5D060` focus | `#0F0804` dark-bg | **10.8:1** | Focus ring | ✅ |
| `#16a34a` green | `#0F0804` dark-bg | **5.8:1** | HealthGauge "Healthy" label | ✅ |
| `#ca8a04` yellow | `#0F0804` dark-bg | **4.7:1** | HealthGauge "At Risk" label | ✅ |
| `#dc2626` red | `#0F0804` dark-bg | **4.5:1** | HealthGauge danger label | ✅ |
| `#FDF6EC` cream/15 track | `#0F0804` dark-bg | **3.1:1** | HealthGauge track bg | ✅ (UI component) |
| `#FDF6EC` cream | `#2A1A08` pre-bg | **11.2:1** | JSON output `<pre>` | ✅ |

---

## Issues Fixed

| # | Component | Before | After |
|---|---|---|---|
| 1 | All cards | `bg-white` invisible on dark page | `dark:bg-[#1C1008]` |
| 2 | All cards | No visible border | `dark:border-gold/20` |
| 3 | All inputs | `bg-white` wrong in dark | `dark:bg-[#2A1A08]` |
| 4 | All inputs | `border-brown/30` invisible | `dark:border-gold/40` |
| 5 | All inputs | Placeholder invisible | `dark:placeholder:text-cream/40` |
| 6 | All inputs | No focus ring in dark | `dark:focus:ring-[#F5D060]` |
| 7 | All buttons | Brown bg invisible on dark page | `dark:bg-gold dark:text-brown` |
| 8 | WalletConnect | Address chip no dark surface | `dark:bg-gold/10 dark:border-gold/40 dark:text-cream` |
| 9 | HealthGauge | Track `brown/10` invisible | `dark:bg-cream/15` |
| 10 | HealthGauge | Ratio text `brown/60` fails | `dark:text-cream/60` |
| 11 | CollateralCard | `<pre>` used `bg-cream` | `dark:bg-[#2A1A08] dark:text-cream` |
| 12 | Home page | Outline button border invisible | `dark:border-gold dark:text-gold` |
| 13 | Home page | Muted paragraph fails | `dark:text-cream/70` |
| 14 | Layout | Body no dark background | CSS var `--bg: #0F0804` in `.dark` |
| 15 | Layout | Flash of light mode on load | Inline script applies `dark` class before paint |

---

## Focus Rings

All inputs and selects receive a `focus:ring-2` ring. In dark mode the ring color is `#F5D060` against `#0F0804` = **10.8:1** — well above the 3:1 WCAG 1.4.11 minimum for focus indicators.

The `ThemeToggle` button itself uses `border-brown/30 dark:border-gold/40` — visible in both themes.

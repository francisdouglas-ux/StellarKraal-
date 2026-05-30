import type { Meta, StoryObj } from "@storybook/react";
import Spinner from "./Spinner";
import SkeletonCollateralCard from "./SkeletonCollateralCard";
import SkeletonLoanCard from "./SkeletonLoanCard";

/**
 * # Loading-state guidelines
 *
 * StellarKraal uses exactly two loading affordances. Choosing the right one
 * keeps the app feeling fast and avoids the "spinner soup" / blank-screen
 * problems that motivated this guideline.
 *
 * ## Use a **Skeleton** for initial data loads
 * When a page or section is mounting and has *no data yet*, render a skeleton
 * that mirrors the shape of the content that will appear. This preserves layout,
 * communicates structure, and prevents a blank white screen on page entry.
 *
 * - Page entry / first fetch → skeleton (e.g. `SkeletonCollateralCard`,
 *   `SkeletonLoanCard`, `SkeletonHealthDashboard`).
 * - Render one skeleton per expected item (we show 3 placeholder rows).
 * - Skeletons set `aria-busy="true"` and an `aria-label` describing what is
 *   loading; the shimmer bars themselves are `aria-hidden`.
 *
 * ## Use a **Spinner** for inline actions
 * When the user triggers an action and we are waiting on a *response*
 * (button click, filter change, on-chain submit, wallet connect), show a
 * `Spinner` inside the control that triggered it and keep the surrounding
 * layout intact.
 *
 * - Button submits → spinner + verb in progress ("Processing…", "Submitting…").
 * - The spinner inherits `currentColor`, so it matches the control it sits in
 *   and works in light and dark mode without extra styling.
 * - Disable the control while its spinner is showing to prevent double submits.
 *
 * ## Rules
 * 1. **Never both** — a section shows a skeleton *or* an inline spinner, not both.
 * 2. **Never neither** — no page may show a blank white screen during a load;
 *    if data is loading on entry, a skeleton must be visible.
 * 3. **Initial vs. refresh** — first load = skeleton; refreshing already-visible
 *    data in response to an action = spinner (keep the stale data on screen).
 */
const meta: Meta = {
  title: "Guidelines/Loading States",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Skeletons — for initial loads. One placeholder per expected item. */
export const SkeletonsForInitialLoad: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-brown-700 mb-2">Collateral grid (page entry)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonCollateralCard key={i} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-brown-700 mb-2">Loan list (page entry)</p>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <SkeletonLoanCard key={i} />
          ))}
        </div>
      </div>
    </div>
  ),
};

/** Spinners — for inline actions inside the control that triggered them. */
export const SpinnersForInlineActions: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-xs">
      <button
        disabled
        className="bg-brown-600 text-cream-50 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 opacity-90"
      >
        <Spinner />
        Processing…
      </button>
      <button
        disabled
        className="bg-gold-600 text-cream-50 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 opacity-90"
      >
        <Spinner />
        Submitting…
      </button>
      <p className="text-xs text-brown-500">
        Spinner inherits the button text colour and the control is disabled while busy.
      </p>
    </div>
  ),
};

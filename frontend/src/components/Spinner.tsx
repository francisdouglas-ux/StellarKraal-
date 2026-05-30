interface SpinnerProps {
  /** Tailwind sizing classes. Defaults to a 1rem inline glyph. */
  className?: string;
  /** Accessible label announced to assistive tech. */
  label?: string;
}

/**
 * Spinner — inline indicator for an action already in progress
 * (button clicks, filter changes, inline lookups).
 *
 * For an initial page or data load, use a Skeleton instead — see the
 * loading-state guidelines in `LoadingStates.stories.tsx`.
 *
 * Colour is inherited from the parent via `currentColor`, so it adapts
 * to whatever button/text colour it sits inside (light and dark modes).
 */
export default function Spinner({ className = "h-4 w-4", label = "Loading" }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

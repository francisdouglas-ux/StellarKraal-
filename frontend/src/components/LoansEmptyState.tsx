import EmptyState from "./EmptyState";

interface Props {
  onBorrow: () => void;
}

const LoansIllustration = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <rect x="10" y="20" width="60" height="45" rx="6" fill="currentColor" opacity="0.12" />
    <rect x="18" y="28" width="20" height="4" rx="2" fill="currentColor" opacity="0.4" />
    <rect x="18" y="36" width="44" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
    <rect x="18" y="43" width="36" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
    <circle cx="58" cy="18" r="10" fill="currentColor" opacity="0.15" />
    <path d="M54 18h8M58 14v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
  </svg>
);

export default function LoansEmptyState({ onBorrow }: Props) {
  return (
    <EmptyState
      illustration={<LoansIllustration />}
      heading="No active loans yet"
      message="Register your livestock as collateral and request your first loan to get started."
      action={{ label: "Borrow Now", onClick: onBorrow }}
    />
  );
}

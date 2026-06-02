import EmptyState from "./EmptyState";

interface Props {
  onRegister: () => void;
}

const CollateralIllustration = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <ellipse cx="40" cy="52" rx="22" ry="10" fill="currentColor" opacity="0.1" />
    <path d="M28 48 C28 36 52 36 52 48" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4" />
    <circle cx="40" cy="32" r="10" fill="currentColor" opacity="0.2" />
    <path d="M36 32 l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    <circle cx="24" cy="36" r="7" fill="currentColor" opacity="0.12" />
    <circle cx="56" cy="36" r="7" fill="currentColor" opacity="0.12" />
  </svg>
);

export default function CollateralEmptyState({ onRegister }: Props) {
  return (
    <EmptyState
      illustration={<CollateralIllustration />}
      heading="No collateral registered"
      message="Add your cattle, goats, or sheep as on-chain collateral to unlock borrowing."
      action={{ label: "Register Livestock", onClick: onRegister }}
    />
  );
}

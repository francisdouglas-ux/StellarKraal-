import EmptyState from "./EmptyState";

interface Props {
  onViewLoans: () => void;
}

const RepaymentIllustration = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <rect x="12" y="18" width="56" height="48" rx="6" fill="currentColor" opacity="0.1" />
    <rect x="20" y="28" width="16" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
    <rect x="20" y="35" width="40" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
    <rect x="20" y="42" width="32" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
    <rect x="20" y="49" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
    <path d="M56 36 A8 8 0 1 1 48 28" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" strokeLinecap="round" />
    <path d="M56 28 l0 8 -8 0" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function RepaymentEmptyState({ onViewLoans }: Props) {
  return (
    <EmptyState
      illustration={<RepaymentIllustration />}
      heading="No repayment history"
      message="Once you make a repayment, your history will appear here. Keep your health factor in check!"
      action={{ label: "View Loans", onClick: onViewLoans }}
    />
  );
}

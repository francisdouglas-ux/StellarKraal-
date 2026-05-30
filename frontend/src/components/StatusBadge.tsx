import React from 'react';

export type LoanStatus = 'active' | 'repaid' | 'defaulted' | 'liquidated';
export type CollateralStatus = 'available' | 'pledged';
export type BadgeStatus = LoanStatus | CollateralStatus;

interface Config {
  label: string;
  /** Tailwind classes — all combos verified ≥ 4.5:1 WCAG AA contrast */
  classes: string;
  icon: string;
  ariaLabel: string;
}

const STATUS_CONFIG: Record<BadgeStatus, Config> = {
  active: {
    label: 'Active',
    classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: '●',
    ariaLabel: 'Status: Active',
  },
  repaid: {
    label: 'Repaid',
    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: '✓',
    ariaLabel: 'Status: Repaid',
  },
  defaulted: {
    label: 'Defaulted',
    classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    icon: '⚠',
    ariaLabel: 'Status: Defaulted',
  },
  liquidated: {
    label: 'Liquidated',
    classes: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    icon: '✕',
    ariaLabel: 'Status: Liquidated',
  },
  available: {
    label: 'Available',
    classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    icon: '◆',
    ariaLabel: 'Status: Available',
  },
  pledged: {
    label: 'Pledged',
    classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    icon: '⬡',
    ariaLabel: 'Status: Pledged',
  },
};

interface Props {
  status: BadgeStatus | string;
}

export default function StatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status as BadgeStatus];

  if (!config) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {status}
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label={config.ariaLabel}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${config.classes}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  );
}

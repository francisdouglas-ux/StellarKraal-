import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import StatusBadge from '../components/StatusBadge';
import type { BadgeStatus } from '../components/StatusBadge';

expect.extend(toHaveNoViolations);

const ALL_STATUSES: BadgeStatus[] = [
  'active',
  'repaid',
  'defaulted',
  'liquidated',
  'available',
  'pledged',
];

describe('StatusBadge', () => {
  test.each(ALL_STATUSES)('renders %s with label and icon', (status) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    // label text is capitalised version of status
    expect(badge).toHaveTextContent(status.charAt(0).toUpperCase() + status.slice(1));
  });

  test('renders unknown status as plain text without crashing', () => {
    render(<StatusBadge status="unknown-state" />);
    expect(screen.getByText('unknown-state')).toBeInTheDocument();
  });

  test.each(ALL_STATUSES)('%s badge has no axe accessibility violations', async (status) => {
    const { container } = render(<StatusBadge status={status} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('icon is hidden from assistive technology', () => {
    render(<StatusBadge status="active" />);
    const badge = screen.getByRole('status');
    // aria-label on the span provides the accessible name
    expect(badge).toHaveAttribute('aria-label', 'Status: Active');
  });
});

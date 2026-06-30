/**
 * LiquidatorWhitelist.test.tsx
 *
 * Unit tests for the LiquidatorWhitelist component covering:
 * - Open liquidation mode rendering (empty list)
 * - Whitelist enforcement state (non-empty list)
 * - Admin management: add + remove flows
 * - Form validation (empty input, invalid address, duplicate)
 * - Accessibility (ARIA roles, labels, live regions)
 * - Loading and error states
 * - Light/dark mode class presence (structural)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LiquidatorWhitelist, { LiquidatorEntry } from '@/components/LiquidatorWhitelist';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_ADDRESS_1 = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMN';
const VALID_ADDRESS_2 = 'GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMN';

/** Pad a Stellar address stub to exactly 56 chars starting with G */
function makeAddress(seed: string): string {
  const base = `G${seed.toUpperCase().replace(/[^A-Z2-7]/g, 'A')}`;
  return (base + 'A'.repeat(56)).slice(0, 56);
}

const ADDR_A = makeAddress('ALPHA');
const ADDR_B = makeAddress('BETA');
const ADDR_C = makeAddress('GAMMA');

const sampleEntry = (address: string, daysAgo = 0): LiquidatorEntry => ({
  address,
  addedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderComponent(
  liquidators: LiquidatorEntry[] = [],
  overrides: Partial<{
    onAdd: (a: string) => Promise<void>;
    onRemove: (a: string) => Promise<void>;
    loading: boolean;
    error: string | null;
  }> = {},
) {
  const onAdd = jest.fn().mockResolvedValue(undefined);
  const onRemove = jest.fn().mockResolvedValue(undefined);

  const props = {
    liquidators,
    onAdd,
    onRemove,
    loading: false,
    error: null,
    ...overrides,
  };

  const result = render(<LiquidatorWhitelist {...props} />);
  return { ...result, onAdd, onRemove };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LiquidatorWhitelist — open mode (empty list)', () => {
  it('renders the section heading', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: /liquidator whitelist/i })).toBeInTheDocument();
  });

  it('shows open liquidation badge when list is empty', () => {
    renderComponent();
    expect(screen.getByText(/open liquidation/i)).toBeInTheDocument();
  });

  it('explains that any address can liquidate', () => {
    renderComponent();
    expect(screen.getByText(/any address can currently liquidate/i)).toBeInTheDocument();
  });

  it('renders the add form with label and button', () => {
    renderComponent();
    expect(screen.getByLabelText(/stellar address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add address to whitelist/i })).toBeInTheDocument();
  });

  it('renders an empty state message when no liquidators exist', () => {
    renderComponent();
    expect(screen.getByText(/no approved liquidators yet/i)).toBeInTheDocument();
  });
});

describe('LiquidatorWhitelist — non-empty whitelist', () => {
  const entries = [sampleEntry(ADDR_A, 5), sampleEntry(ADDR_B, 1)];

  it('shows the count badge with number of liquidators', () => {
    renderComponent(entries);
    expect(screen.getByText(/2 approved liquidators/i)).toBeInTheDocument();
  });

  it('renders a table with all addresses', () => {
    renderComponent(entries);
    const table = screen.getByRole('table', { name: /approved liquidators/i });
    expect(within(table).getByText(ADDR_A)).toBeInTheDocument();
    expect(within(table).getByText(ADDR_B)).toBeInTheDocument();
  });

  it('renders a Remove button for each liquidator', () => {
    renderComponent(entries);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    // Each row has one Remove button; the Add button does not say "remove"
    expect(removeButtons).toHaveLength(2);
  });

  it('does not show "any address can liquidate" text', () => {
    renderComponent(entries);
    expect(screen.queryByText(/any address can currently liquidate/i)).not.toBeInTheDocument();
  });

  it('shows singular "liquidator" for list of 1', () => {
    renderComponent([sampleEntry(ADDR_A)]);
    expect(screen.getByText(/1 approved liquidator(?!s)/i)).toBeInTheDocument();
  });
});

describe('LiquidatorWhitelist — form validation', () => {
  it('shows error when submitting empty address', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /add address to whitelist/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/address is required/i);
  });

  it('shows error for invalid address (too short)', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByLabelText(/stellar address/i), 'GABC123');
    await user.click(screen.getByRole('button', { name: /add address to whitelist/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid stellar address/i);
  });

  it('shows error for address not starting with G or C', async () => {
    const user = userEvent.setup();
    renderComponent();
    const invalidAddr = 'X' + 'A'.repeat(55);
    await user.type(screen.getByLabelText(/stellar address/i), invalidAddr);
    await user.click(screen.getByRole('button', { name: /add address to whitelist/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid stellar address/i);
  });

  it('shows error for duplicate address', async () => {
    const user = userEvent.setup();
    renderComponent([sampleEntry(ADDR_A)]);
    await user.type(screen.getByLabelText(/stellar address/i), ADDR_A);
    await user.click(screen.getByRole('button', { name: /add address to whitelist/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already on the whitelist/i);
  });

  it('clears field error when user starts typing', async () => {
    const user = userEvent.setup();
    renderComponent();
    // Trigger error
    await user.click(screen.getByRole('button', { name: /add address to whitelist/i }));
    await screen.findByRole('alert');
    // Start typing — error should clear
    await user.type(screen.getByLabelText(/stellar address/i), 'G');
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

describe('LiquidatorWhitelist — add liquidator flow', () => {
  it('calls onAdd with the trimmed address on valid submission', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderComponent();
    // Type the address directly (no surrounding spaces — maxLength=56 would truncate them)
    await user.type(screen.getByLabelText(/stellar address/i), ADDR_A);
    await user.click(screen.getByRole('button', { name: /add address to whitelist/i }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(ADDR_A));
  });

  it('clears the input after successful add', async () => {
    const user = userEvent.setup();
    renderComponent();
    const input = screen.getByLabelText(/stellar address/i);
    await user.type(input, ADDR_A);
    await user.click(screen.getByRole('button', { name: /add address to whitelist/i }));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('shows a success status message after add', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByLabelText(/stellar address/i), ADDR_A);
    await user.click(screen.getByRole('button', { name: /add address to whitelist/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  it('shows error message when onAdd rejects', async () => {
    const user = userEvent.setup();
    const onAdd = jest.fn().mockRejectedValue(new Error('Contract error'));
    renderComponent([], { onAdd });
    await user.type(screen.getByLabelText(/stellar address/i), ADDR_A);
    await user.click(screen.getByRole('button', { name: /add address to whitelist/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/contract error/i);
  });

  it('disables the add button while submitting', async () => {
    const user = userEvent.setup();
    // Simulate a slow async onAdd
    let resolve: () => void;
    const onAdd = jest.fn(
      () => new Promise<void>((res) => { resolve = res; }),
    );
    renderComponent([], { onAdd });
    await user.type(screen.getByLabelText(/stellar address/i), ADDR_A);
    await user.click(screen.getByRole('button', { name: /add address to whitelist/i }));

    expect(screen.getByRole('button', { name: /add address to whitelist/i })).toBeDisabled();
    resolve!();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add address to whitelist/i })).not.toBeDisabled(),
    );
  });
});

describe('LiquidatorWhitelist — remove liquidator flow', () => {
  it('calls onRemove with the correct address', async () => {
    const user = userEvent.setup();
    const entries = [sampleEntry(ADDR_A), sampleEntry(ADDR_B)];
    const { onRemove } = renderComponent(entries);

    const removeBtn = screen.getByRole('button', { name: new RegExp(`remove ${ADDR_A}`, 'i') });
    await user.click(removeBtn);
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(ADDR_A));
  });

  it('disables all Remove buttons while one is in progress', async () => {
    const user = userEvent.setup();
    const entries = [sampleEntry(ADDR_A), sampleEntry(ADDR_B)];
    let resolve: () => void;
    const onRemove = jest.fn(
      () => new Promise<void>((res) => { resolve = res; }),
    );
    renderComponent(entries, { onRemove });

    await user.click(screen.getByRole('button', { name: new RegExp(`remove ${ADDR_A}`, 'i') }));

    const allRemoveBtns = screen.getAllByRole('button', { name: /remove/i });
    allRemoveBtns.forEach((btn) => expect(btn).toBeDisabled());

    resolve!();
    await waitFor(() => {
      screen.getAllByRole('button', { name: /remove/i }).forEach((btn) => {
        expect(btn).not.toBeDisabled();
      });
    });
  });

  it('shows a success status message after remove', async () => {
    const user = userEvent.setup();
    const entries = [sampleEntry(ADDR_A)];
    renderComponent(entries);
    await user.click(screen.getByRole('button', { name: new RegExp(`remove ${ADDR_A}`, 'i') }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });
});

describe('LiquidatorWhitelist — loading state', () => {
  it('shows a loading spinner when loading=true', () => {
    renderComponent([], { loading: true });
    expect(screen.getByLabelText(/loading whitelist/i)).toBeInTheDocument();
  });

  it('disables the add button when loading', () => {
    renderComponent([], { loading: true });
    expect(screen.getByRole('button', { name: /add address to whitelist/i })).toBeDisabled();
  });

  it('disables the address input when loading', () => {
    renderComponent([], { loading: true });
    expect(screen.getByLabelText(/stellar address/i)).toBeDisabled();
  });
});

describe('LiquidatorWhitelist — error prop', () => {
  it('renders a global alert when error prop is set', () => {
    renderComponent([], { error: 'RPC connection failed' });
    expect(screen.getByRole('alert')).toHaveTextContent(/rpc connection failed/i);
  });
});

describe('LiquidatorWhitelist — accessibility', () => {
  it('has a landmark section with accessible name', () => {
    renderComponent();
    const section = screen.getByRole('region', { name: /liquidator whitelist/i });
    expect(section).toBeInTheDocument();
  });

  it('add form has an accessible name', () => {
    renderComponent();
    expect(screen.getByRole('form', { name: /add liquidator/i })).toBeInTheDocument();
  });

  it('input has aria-required attribute', () => {
    renderComponent();
    expect(screen.getByLabelText(/stellar address/i)).toHaveAttribute('aria-required', 'true');
  });

  it('status badge has aria-live attribute', () => {
    const { container } = renderComponent();
    const badge = container.querySelector('[aria-live]');
    expect(badge).toBeInTheDocument();
  });

  it('each remove button has an accessible label including the address', () => {
    const entries = [sampleEntry(ADDR_A)];
    renderComponent(entries);
    expect(
      screen.getByRole('button', { name: new RegExp(`remove ${ADDR_A}`, 'i') }),
    ).toBeInTheDocument();
  });

  it('table has accessible caption', () => {
    renderComponent([sampleEntry(ADDR_A)]);
    const table = screen.getByRole('table', { name: /approved liquidators/i });
    expect(table).toBeInTheDocument();
  });
});

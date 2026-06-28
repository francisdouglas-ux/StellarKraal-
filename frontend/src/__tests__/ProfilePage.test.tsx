import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfilePage, { buildReferralUrl } from '../app/profile/page';

jest.mock('../hooks/useWallet', () => ({
  useWallet: () => ({ address: 'GBTEST123WALLETADDRESS' }),
}));

Object.assign(navigator, {
  clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
});

describe('ProfilePage (#571 – referral section)', () => {
  it('builds referral URL containing wallet address', () => {
    expect(buildReferralUrl('GABC')).toContain('/register?ref=GABC');
  });

  it('shows Copy Invite Link button when wallet connected', () => {
    render(<ProfilePage />);
    expect(screen.getByRole('button', { name: /copy invite link/i })).toBeTruthy();
  });

  it('shows the referral URL in the page', () => {
    render(<ProfilePage />);
    expect(screen.getByText(/\/register\?ref=GBTEST123WALLETADDRESS/)).toBeTruthy();
  });

  it('shows Copied! feedback after clicking', async () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: /copy invite link/i }));
    await waitFor(() => expect(screen.getByText('Copied!')).toBeTruthy());
  });

  it('copies URL to clipboard', async () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: /copy invite link/i }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/register?ref=GBTEST123WALLETADDRESS')
      )
    );
  });
});

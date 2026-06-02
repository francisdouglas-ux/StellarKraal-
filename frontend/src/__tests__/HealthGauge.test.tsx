import React from 'react';
import { render, screen } from '@testing-library/react';
import HealthGauge from '../components/HealthGauge';

jest.mock('../lib/design-tokens', () => ({
  healthColor: (bps: number) => (bps >= 15_000 ? '#16A34A' : bps >= 10_000 ? '#D97706' : '#DC2626'),
  colors: { text: { secondary: 'text-brown-600' } },
}));

describe('HealthGauge', () => {
  it('shows Safe label when hf >= 15_000', () => {
    render(<HealthGauge value={15_000} />);
    expect(screen.getByText('Safe')).toBeTruthy();
  });

  it('shows Warning label when 10_000 <= hf < 15_000', () => {
    render(<HealthGauge value={13_333} />);
    expect(screen.getByText('Warning')).toBeTruthy();
  });

  it('shows Danger label when hf < 10_000', () => {
    render(<HealthGauge value={8_000} />);
    expect(screen.getByText('Danger')).toBeTruthy();
  });

  it('displays numeric ratio', () => {
    render(<HealthGauge value={10_000} />);
    expect(screen.getByText('1.00x')).toBeTruthy();
  });

  it('renders an SVG element', () => {
    const { container } = render(<HealthGauge value={13_333} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('has accessible role and aria-label', () => {
    render(<HealthGauge value={13_333} />);
    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-label')).toMatch(/1\.33x/);
  });
});

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

  it('allows keyboard navigation between chart points and shows tooltip', () => {
    render(
      <HealthGauge
        value={10000}
        history={[
          { date: '2026-01-01', value: 8000 },
          { date: '2026-02-01', value: 11000 },
        ]}
      />,
    );

    const points = screen.getAllByRole('button');
    expect(points).toHaveLength(2);

    act(() => {
      points[0].focus();
    });
    expect(points[0]).toHaveFocus();

    act(() => {
      fireEvent.keyDown(points[0], { key: 'ArrowRight', code: 'ArrowRight' });
    });
    expect(points[1]).toHaveFocus();

    act(() => {
      fireEvent.keyDown(points[1], { key: 'Enter', code: 'Enter' });
    });
    expect(screen.getByText('Health:')).toBeTruthy();
    expect(screen.getByText('1.10x')).toBeTruthy();

    act(() => {
      fireEvent.keyDown(points[1], { key: 'Escape', code: 'Escape' });
    });
    expect(screen.queryByText('Health:')).toBeNull();
  });
});

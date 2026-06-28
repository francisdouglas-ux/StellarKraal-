import React from 'react';
import { render, screen } from '@testing-library/react';
import ThemeProvider, { ThemeScript } from '../components/ThemeProvider';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }),
});

describe('ThemeProvider (#572 – hydration)', () => {
  it('renders children without crashing', () => {
    render(
      <ThemeProvider>
        <span>content</span>
      </ThemeProvider>
    );
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('ThemeScript renders a <script> that manipulates classList, not textContent', () => {
    const { container } = render(<ThemeScript />);
    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    expect(script!.innerHTML).toContain('classList');
    expect(script!.innerHTML).not.toContain('textContent');
  });
});

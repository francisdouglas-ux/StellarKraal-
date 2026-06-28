import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useFetchWithRateLimit } from '../hooks/useFetchWithRateLimit';
import { ToastProvider } from '../components/toast';

jest.useFakeTimers();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

function mockResponse(status: number, retryAfter?: string) {
  return {
    status,
    headers: { get: (key: string) => (key === 'Retry-After' ? (retryAfter ?? null) : null) },
  };
}

describe('useFetchWithRateLimit (#573)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('sets isRateLimited and countdown on 429 with Retry-After header', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(429, '5'));
    const { result } = renderHook(() => useFetchWithRateLimit(), { wrapper });

    await act(async () => {
      await result.current.fetchWithLimit('/api/test');
    });

    expect(result.current.isRateLimited).toBe(true);
    expect(result.current.retryCountdown).toBe(5);
  });

  it('counts down to zero after the retry window', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(429, '3'));
    const { result } = renderHook(() => useFetchWithRateLimit(), { wrapper });

    await act(async () => {
      await result.current.fetchWithLimit('/api/test');
    });
    act(() => jest.advanceTimersByTime(3000));

    expect(result.current.isRateLimited).toBe(false);
    expect(result.current.retryCountdown).toBe(0);
  });

  it('does not rate-limit on 200 response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200));
    const { result } = renderHook(() => useFetchWithRateLimit(), { wrapper });

    await act(async () => {
      await result.current.fetchWithLimit('/api/test');
    });

    expect(result.current.isRateLimited).toBe(false);
  });
});

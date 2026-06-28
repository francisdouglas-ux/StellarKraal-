'use client';
import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/toast';

export type RateLimitedFetch = {
  /** Seconds remaining in the retry window, or 0 when ready */
  retryCountdown: number;
  /** True while the countdown is active */
  isRateLimited: boolean;
  /** Drop-in replacement for fetch that handles 429 automatically */
  fetchWithLimit: typeof fetch;
};

export function useFetchWithRateLimit(): RateLimitedFetch {
  const [retryCountdown, setRetryCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toast = useToast();

  const startCountdown = useCallback(
    (seconds: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setRetryCountdown(seconds);
      toast.warning(`Too many requests – try again in ${seconds} seconds`);

      let remaining = seconds;
      timerRef.current = setInterval(() => {
        remaining -= 1;
        setRetryCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
        }
      }, 1000);
    },
    [toast]
  );

  const fetchWithLimit: typeof fetch = useCallback(
    async (input, init?) => {
      const response = await fetch(input, init);
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const seconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
        startCountdown(Number.isFinite(seconds) ? seconds : 60);
      }
      return response;
    },
    [startCountdown]
  );

  return { retryCountdown, isRateLimited: retryCountdown > 0, fetchWithLimit };
}

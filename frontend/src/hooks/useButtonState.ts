import { useState, useCallback } from 'react';

export type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface UseButtonStateOptions {
  successDuration?: number;
  errorDuration?: number;
}

export function useButtonState(options: UseButtonStateOptions = {}) {
  const { successDuration = 2000, errorDuration = 3000 } = options;
  const [state, setState] = useState<ButtonState>('idle');

  const setLoading = useCallback(() => setState('loading'), []);

  const setSuccess = useCallback(() => {
    setState('success');
    const timer = setTimeout(() => setState('idle'), successDuration);
    return () => clearTimeout(timer);
  }, [successDuration]);

  const setError = useCallback(() => {
    setState('error');
    const timer = setTimeout(() => setState('idle'), errorDuration);
    return () => clearTimeout(timer);
  }, [errorDuration]);

  const reset = useCallback(() => setState('idle'), []);

  return { state, setLoading, setSuccess, setError, reset };
}

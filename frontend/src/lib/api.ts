import { mutate } from 'swr';

export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Shared SWR fetcher. Throws an {@link ApiError} on non-2xx responses so callers
 * can surface a meaningful message and SWR can revalidate on retry.
 */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(`Server error: ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

/**
 * Drop every cached loan query and revalidate it in the background.
 * Call after any loan mutation (request, repay) so lists reflect the change.
 */
export function invalidateLoans() {
  return mutate((key) => typeof key === 'string' && key.includes('/loan'), undefined, {
    revalidate: true,
  });
}

/**
 * Drop every cached collateral query and revalidate it in the background.
 * Call after registering collateral so owner and public lists stay fresh.
 */
export function invalidateCollateral() {
  return mutate((key) => typeof key === 'string' && key.includes('/collateral'), undefined, {
    revalidate: true,
  });
}

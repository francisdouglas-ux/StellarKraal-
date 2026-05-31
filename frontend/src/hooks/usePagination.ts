import { useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface PaginationState {
  page: number;
  limit: PageSize;
  totalPages: number;
  setPage: (page: number) => void;
  setLimit: (limit: PageSize) => void;
  slice: <T>(items: T[]) => T[];
}

export function usePagination(totalItems: number): PaginationState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
  const rawLimit = parseInt(searchParams.get('limit') ?? '10', 10);

  const limit: PageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(rawLimit)
    ? (rawLimit as PageSize)
    : 10;

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const page = Math.min(Math.max(1, isNaN(rawPage) ? 1 : rawPage), totalPages);

  const navigate = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        params.set(k, v);
      }
      router.push(`${pathname}?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [router, pathname, searchParams]
  );

  const setPage = useCallback((p: number) => navigate({ page: String(p) }), [navigate]);

  const setLimit = useCallback(
    (l: PageSize) => navigate({ limit: String(l), page: '1' }),
    [navigate]
  );

  const slice = useCallback(
    <T>(items: T[]): T[] => {
      const start = (page - 1) * limit;
      return items.slice(start, start + limit);
    },
    [page, limit]
  );

  return { page, limit, totalPages, setPage, setLimit, slice };
}

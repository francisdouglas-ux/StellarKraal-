import { PAGE_SIZE_OPTIONS, PageSize } from '@/hooks/usePagination';

interface Props {
  page: number;
  totalPages: number;
  limit: PageSize;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: PageSize) => void;
}

export default function Pagination({
  page,
  totalPages,
  limit,
  onPageChange,
  onLimitChange,
}: Props) {
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 mt-6">
      <div className="flex items-center gap-2 text-sm text-brown-600">
        <label htmlFor="page-size" className="sr-only">
          Items per page
        </label>
        <span>Show</span>
        <select
          id="page-size"
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value) as PageSize)}
          className="border border-brown-200 rounded-md px-2 py-1 text-sm bg-white dark:bg-brown-800 dark:border-brown-600 dark:text-cream-50 focus:outline-none focus:ring-2 focus:ring-brown-500"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span>per page</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="px-3 py-1 rounded-md border border-brown-200 text-sm text-brown-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brown-50 dark:border-brown-600 dark:text-cream-50 dark:hover:bg-brown-700 transition-colors"
        >
          ← Prev
        </button>

        <span className="text-sm text-brown-600 dark:text-cream-200" aria-current="page">
          Page {page} of {totalPages}
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="px-3 py-1 rounded-md border border-brown-200 text-sm text-brown-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brown-50 dark:border-brown-600 dark:text-cream-50 dark:hover:bg-brown-700 transition-colors"
        >
          Next →
        </button>
      </div>
    </nav>
  );
}

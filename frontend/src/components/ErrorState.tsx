interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export default function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
    >
      <span className="text-4xl mb-3" aria-hidden="true">
        ⚠️
      </span>
      <p className="text-sm text-red-700 dark:text-red-400 mb-4 max-w-sm">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        Retry
      </button>
    </div>
  );
}

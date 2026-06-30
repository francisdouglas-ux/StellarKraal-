'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

function createReferenceId(error: Error & { digest?: string }) {
  const source = [error.digest, error.name, error.message, error.stack].filter(Boolean).join(':');
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return `SK-${hash.toString(16).toUpperCase().padStart(8, '0').slice(-8)}`;
}

export function reloadPage(reloader: Pick<Location, 'reload'> = window.location) {
  reloader.reload();
}

export const globalErrorActions = {
  reloadPage,
};

export default function GlobalError({ error }: Props) {
  const isProduction = process.env.NODE_ENV === 'production';
  const referenceId = createReferenceId(error);
  const errorCode = error.digest ?? error.name ?? 'UNHANDLED_ERROR';
  const stackTrace = error.stack ?? error.message;
  const issueTitle = isProduction
    ? `500 Error Reference: ${referenceId}`
    : `500 Error: ${error.message || 'Unknown error'}`;
  const issueBody = isProduction
    ? `**Reference ID:** ${referenceId}\n\n**Steps to reproduce:**\n\n`
    : `**Error code:** ${errorCode}\n\n**Stack trace:**\n\n\`\`\`\n${stackTrace}\n\`\`\`\n\n**Steps to reproduce:**\n\n`;
  const issueUrl = `https://github.com/teslims2/StellarKraal-/issues/new?title=${encodeURIComponent(
    issueTitle
  )}&body=${encodeURIComponent(issueBody)}`;

  useEffect(() => {
    if (isProduction) {
      console.error('[GlobalError]', error, { referenceId });
    }
  }, [error, isProduction, referenceId]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-color-surface px-4 text-color-text">
        <main
          aria-describedby="global-error-description"
          aria-labelledby="global-error-title"
          aria-live="assertive"
          className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center py-12 text-center"
          role="main"
        >
          <p className="text-label mb-3 font-semibold uppercase tracking-normal text-color-danger">
            Error 500
          </p>
          <h1 id="global-error-title" className="text-h1 mb-3">
            Something went wrong
          </h1>
          <p id="global-error-description" className="text-body mb-6 max-w-xl">
            An unexpected error interrupted this page. Reload the page or share the reference
            details with support.
          </p>

          {isProduction ? (
            <section
              aria-label="Support reference"
              className="mb-8 w-full rounded-lg border border-color-border bg-color-surface-raised p-4 text-left"
            >
              <p className="text-label mb-1">Support reference</p>
              <p className="font-mono text-body text-color-text">{referenceId}</p>
            </section>
          ) : (
            <section
              aria-label="Development error details"
              className="mb-8 w-full rounded-lg border border-color-border bg-color-surface-raised p-4 text-left"
            >
              <dl className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-label">Error code</dt>
                  <dd className="break-words font-mono text-body-sm">{errorCode}</dd>
                </div>
                <div>
                  <dt className="text-label">Message</dt>
                  <dd className="break-words font-mono text-body-sm">{error.message}</dd>
                </div>
              </dl>
              <p className="text-label mb-2">Stack trace</p>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-color-surface p-4 text-left font-mono text-caption text-color-text-subtle">
                {stackTrace}
              </pre>
            </section>
          )}

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              className="rounded-lg bg-color-primary px-6 py-3 font-semibold text-color-on-primary transition hover:bg-color-primary-hover focus:outline-none focus:ring-2 focus:ring-color-accent focus:ring-offset-2 focus:ring-offset-color-surface"
              onClick={() => globalErrorActions.reloadPage()}
              type="button"
            >
              Reload Page
            </button>
            <a
              className="rounded-lg border border-color-border-strong px-6 py-3 font-semibold text-color-text transition hover:bg-color-surface-raised focus:outline-none focus:ring-2 focus:ring-color-accent focus:ring-offset-2 focus:ring-offset-color-surface"
              href={issueUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Report issue
            </a>
            <a
              className="rounded-lg border border-color-border-strong px-6 py-3 font-semibold text-color-text transition hover:bg-color-surface-raised focus:outline-none focus:ring-2 focus:ring-color-accent focus:ring-offset-2 focus:ring-offset-color-surface"
              href="/"
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

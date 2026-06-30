import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GlobalError, { globalErrorActions, reloadPage } from '../app/global-error';

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string) {
  process.env.NODE_ENV = value;
}

function createError() {
  const error = new Error('Database connection failed') as Error & { digest?: string };
  error.digest = 'digest-1234567890';
  error.stack = 'Error: Database connection failed\n    at DashboardPage';

  return error;
}

describe('GlobalError', () => {
  afterEach(() => {
    setNodeEnv(originalNodeEnv);
    jest.restoreAllMocks();
  });

  it('shows the full stack trace in development', () => {
    setNodeEnv('development');
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<GlobalError error={createError()} reset={jest.fn()} />);

    expect(screen.getByRole('main', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText('digest-1234567890')).toBeInTheDocument();
    expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    expect(screen.getByText(/at DashboardPage/)).toBeInTheDocument();
    expect(screen.queryByText(/support reference/i)).not.toBeInTheDocument();
  });

  it('shows a masked support reference and reports the error in production', async () => {
    setNodeEnv('production');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<GlobalError error={createError()} reset={jest.fn()} />);

    expect(screen.getByText(/support reference/i)).toBeInTheDocument();
    expect(screen.getByText(/^SK-[A-F0-9]{8}$/)).toBeInTheDocument();
    expect(screen.queryByText('Database connection failed')).not.toBeInTheDocument();
    expect(screen.queryByText(/at DashboardPage/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[GlobalError]',
        expect.any(Error),
        expect.objectContaining({ referenceId: expect.stringMatching(/^SK-[A-F0-9]{8}$/) })
      );
    });
  });

  it('reloads the page from the reload button', async () => {
    setNodeEnv('production');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = jest.spyOn(globalErrorActions, 'reloadPage').mockImplementation(() => {});

    render(<GlobalError error={createError()} reset={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /reload page/i }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('uses window.location.reload for reloads', () => {
    const reload = jest.fn();

    reloadPage({ reload });

    expect(reload).toHaveBeenCalledTimes(1);
  });
});

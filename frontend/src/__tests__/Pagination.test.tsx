/**
 * Tests for the Pagination component and usePagination hook.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import Pagination from '../components/Pagination';
import { usePagination, PAGE_SIZE_OPTIONS } from '../hooks/usePagination';

// ─── next/navigation mock ────────────────────────────────────────────────────
const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/test',
  useSearchParams: () => mockSearchParams,
}));

// ─── window.scrollTo mock ────────────────────────────────────────────────────
Object.defineProperty(window, 'scrollTo', { value: jest.fn(), writable: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function setParams(params: Record<string, string>) {
  mockSearchParams = new URLSearchParams(params);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

// ─── Pagination component ─────────────────────────────────────────────────────
describe('Pagination component', () => {
  const defaultProps = {
    page: 1,
    totalPages: 5,
    limit: 10 as const,
    onPageChange: jest.fn(),
    onLimitChange: jest.fn(),
  };

  it('renders page info', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText('Page 1 of 5')).toBeTruthy();
  });

  it('disables Prev button on first page', () => {
    render(<Pagination {...defaultProps} page={1} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('disables Next button on last page', () => {
    render(<Pagination {...defaultProps} page={5} totalPages={5} />);
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('enables both buttons on a middle page', () => {
    render(<Pagination {...defaultProps} page={3} totalPages={5} />);
    expect(screen.getByRole('button', { name: /previous page/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();
  });

  it('calls onPageChange with page-1 when Prev is clicked', () => {
    const onPageChange = jest.fn();
    render(<Pagination {...defaultProps} page={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /previous page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with page+1 when Next is clicked', () => {
    const onPageChange = jest.fn();
    render(<Pagination {...defaultProps} page={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('renders all page size options', () => {
    render(<Pagination {...defaultProps} />);
    const select = screen.getByRole('combobox');
    PAGE_SIZE_OPTIONS.forEach((n) => {
      expect(select.querySelector(`option[value="${n}"]`)).toBeTruthy();
    });
  });

  it('calls onLimitChange when page size is changed', () => {
    const onLimitChange = jest.fn();
    render(<Pagination {...defaultProps} onLimitChange={onLimitChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '25' } });
    expect(onLimitChange).toHaveBeenCalledWith(25);
  });

  it('has accessible nav landmark', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeTruthy();
  });
});

// ─── usePagination hook ───────────────────────────────────────────────────────
describe('usePagination hook', () => {
  it('defaults to page 1 and limit 10', () => {
    const { result } = renderHook(() => usePagination(100));
    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(10);
  });

  it('reads page and limit from URL params', () => {
    setParams({ page: '3', limit: '25' });
    const { result } = renderHook(() => usePagination(100));
    expect(result.current.page).toBe(3);
    expect(result.current.limit).toBe(25);
  });

  it('clamps page to totalPages when URL page exceeds total', () => {
    setParams({ page: '99' });
    const { result } = renderHook(() => usePagination(15)); // 15 items / 10 per page = 2 pages
    expect(result.current.page).toBe(2);
  });

  it('clamps page to 1 when URL page is 0 or negative', () => {
    setParams({ page: '0' });
    const { result } = renderHook(() => usePagination(50));
    expect(result.current.page).toBe(1);
  });

  it('falls back to limit 10 for invalid limit values', () => {
    setParams({ limit: '99' });
    const { result } = renderHook(() => usePagination(100));
    expect(result.current.limit).toBe(10);
  });

  it('computes totalPages correctly', () => {
    const { result } = renderHook(() => usePagination(25));
    expect(result.current.totalPages).toBe(3); // ceil(25/10)
  });

  it('totalPages is at least 1 for empty list', () => {
    const { result } = renderHook(() => usePagination(0));
    expect(result.current.totalPages).toBe(1);
  });

  it('slice returns the correct window of items', () => {
    setParams({ page: '2', limit: '10' });
    const { result } = renderHook(() => usePagination(30));
    const items = Array.from({ length: 30 }, (_, i) => i);
    expect(result.current.slice(items)).toEqual(items.slice(10, 20));
  });

  it('setPage navigates to the new page URL', () => {
    const { result } = renderHook(() => usePagination(100));
    act(() => {
      result.current.setPage(3);
    });
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('page=3'));
  });

  it('setLimit navigates with new limit and resets to page 1', () => {
    setParams({ page: '4' });
    const { result } = renderHook(() => usePagination(100));
    act(() => {
      result.current.setLimit(25);
    });
    const url = mockPush.mock.calls[0][0] as string;
    expect(url).toContain('limit=25');
    expect(url).toContain('page=1');
  });

  it('setPage calls window.scrollTo', () => {
    const { result } = renderHook(() => usePagination(100));
    act(() => {
      result.current.setPage(2);
    });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});

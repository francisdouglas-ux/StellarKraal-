import { renderHook, act } from '@testing-library/react';
import { useSearchFilter } from '@/hooks/useSearchFilter';

// Mock next/navigation
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/loans',
  useSearchParams: () => mockSearchParams,
}));

describe('useSearchFilter', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockSearchParams = new URLSearchParams();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initialises with empty filters', () => {
    const { result } = renderHook(() => useSearchFilter());
    expect(result.current.filters).toEqual({
      query: '',
      statuses: [],
      types: [],
      dateFrom: '',
      dateTo: '',
    });
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('initialises from URL params', () => {
    mockSearchParams = new URLSearchParams(
      'q=abc&status=active&dateFrom=2026-01-01&dateTo=2026-06-01'
    );
    const { result } = renderHook(() => useSearchFilter());
    expect(result.current.filters.query).toBe('abc');
    expect(result.current.filters.statuses).toEqual(['active']);
    expect(result.current.filters.dateFrom).toBe('2026-01-01');
    expect(result.current.filters.dateTo).toBe('2026-06-01');
  });

  it('setQuery debounces URL update', () => {
    const { result } = renderHook(() => useSearchFilter());
    act(() => {
      result.current.setQuery('hello');
    });
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockReplace).toHaveBeenCalledWith('/loans?q=hello', { scroll: false });
  });

  it('toggleStatus adds and removes status, updates URL immediately', () => {
    const { result } = renderHook(() => useSearchFilter());

    act(() => {
      result.current.toggleStatus('active');
    });
    expect(result.current.filters.statuses).toEqual(['active']);
    expect(mockReplace).toHaveBeenCalledWith('/loans?status=active', { scroll: false });

    act(() => {
      result.current.toggleStatus('active');
    });
    expect(result.current.filters.statuses).toEqual([]);
    expect(mockReplace).toHaveBeenCalledWith('/loans', { scroll: false });
  });

  it('toggleStatus supports multi-select', () => {
    const { result } = renderHook(() => useSearchFilter());
    act(() => {
      result.current.toggleStatus('active');
    });
    act(() => {
      result.current.toggleStatus('repaid');
    });
    expect(result.current.filters.statuses).toEqual(['active', 'repaid']);
  });

  it('removeStatus removes a specific status', () => {
    const { result } = renderHook(() => useSearchFilter());
    act(() => {
      result.current.toggleStatus('active');
    });
    act(() => {
      result.current.toggleStatus('repaid');
    });
    act(() => {
      result.current.removeStatus('active');
    });
    expect(result.current.filters.statuses).toEqual(['repaid']);
  });

  it('setDateFrom updates dateFrom and URL immediately', () => {
    const { result } = renderHook(() => useSearchFilter());
    act(() => {
      result.current.setDateFrom('2026-01-01');
    });
    expect(result.current.filters.dateFrom).toBe('2026-01-01');
    expect(mockReplace).toHaveBeenCalledWith('/loans?dateFrom=2026-01-01', { scroll: false });
  });

  it('setDateTo updates dateTo and URL immediately', () => {
    const { result } = renderHook(() => useSearchFilter());
    act(() => {
      result.current.setDateTo('2026-12-31');
    });
    expect(result.current.filters.dateTo).toBe('2026-12-31');
    expect(mockReplace).toHaveBeenCalledWith('/loans?dateTo=2026-12-31', { scroll: false });
  });

  it('hasActiveFilters is true when dateFrom is set', () => {
    const { result } = renderHook(() => useSearchFilter());
    act(() => {
      result.current.setDateFrom('2026-01-01');
    });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('hasActiveFilters is true when dateTo is set', () => {
    const { result } = renderHook(() => useSearchFilter());
    act(() => {
      result.current.setDateTo('2026-12-31');
    });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('clearAll resets all filters and clears URL', () => {
    const { result } = renderHook(() => useSearchFilter());
    act(() => {
      result.current.setQuery('test');
    });
    act(() => {
      result.current.toggleStatus('active');
    });
    act(() => {
      result.current.setDateFrom('2026-01-01');
    });
    act(() => {
      result.current.setDateTo('2026-12-31');
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.filters).toEqual({
      query: '',
      statuses: [],
      types: [],
      dateFrom: '',
      dateTo: '',
    });
    expect(result.current.hasActiveFilters).toBe(false);
    expect(mockReplace).toHaveBeenLastCalledWith('/loans', { scroll: false });
  });

  it('URL includes all active filters', () => {
    const { result } = renderHook(() => useSearchFilter());
    act(() => {
      result.current.toggleStatus('active');
    });
    act(() => {
      result.current.setDateFrom('2026-01-01');
    });
    act(() => {
      result.current.setDateTo('2026-06-30');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    const params = new URLSearchParams(lastCall.split('?')[1]);
    expect(params.get('status')).toBe('active');
    expect(params.get('dateFrom')).toBe('2026-01-01');
    expect(params.get('dateTo')).toBe('2026-06-30');
  });
});

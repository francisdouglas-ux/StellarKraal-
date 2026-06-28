'use client';
import useSWR from 'swr';
import { API, fetcher } from '@/lib/api';

export interface Collateral {
  id: string;
  owner: string;
  animal_type: string;
  count: number;
  appraised_value: number;
  status?: string;
  createdAt?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CollateralListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  types?: string[];
}

interface CollateralListResponse {
  data: Collateral[];
  meta?: PaginationMeta;
}

interface OwnerCollateralResponse {
  collaterals?: Collateral[];
}

const DEFAULT_META: PaginationMeta = { total: 0, page: 1, limit: 10, pages: 1 };

function buildCollateralKey(params: CollateralListParams): string {
  const sp = new URLSearchParams();
  sp.set('page', String(params.page ?? 1));
  sp.set('limit', String(params.limit ?? 10));
  if (params.search) sp.set('search', params.search);
  if (params.sort) sp.set('sort', params.sort);
  (params.types ?? []).forEach((t) => sp.append('type', t));
  return `${API}/api/collateral?${sp.toString()}`;
}

/**
 * Cached, paginated collateral list for the public browse page. The query
 * string is the SWR key, so identical searches dedupe and revalidate instead of
 * re-fetching on every mount.
 */
export function useCollateral(params: CollateralListParams) {
  const { data, error, isLoading, mutate } = useSWR<CollateralListResponse>(
    buildCollateralKey(params),
    fetcher
  );

  return {
    items: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta ?? DEFAULT_META,
    isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => mutate(),
  };
}

/**
 * Cached collateral list scoped to a single owner (the dashboard view). Skips
 * the request until a wallet address is connected.
 */
export function useOwnerCollateral(owner: string | null) {
  const key = owner ? `${API}/api/collateral/list?owner=${owner}` : null;
  const { data, error, isLoading, mutate } = useSWR<OwnerCollateralResponse>(key, fetcher);

  return {
    collaterals: data?.collaterals ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
    refresh: () => mutate(),
  };
}

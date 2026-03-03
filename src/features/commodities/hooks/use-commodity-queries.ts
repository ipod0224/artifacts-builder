import { useQuery, useQueries } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  COMMODITIES,
  type LatestPrice,
  type PriceChange,
  type HistoryResponse
} from '../constants';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new Error('API returned success: false');
  return json.data;
}

export function useCommodityLatest() {
  return useQuery({
    queryKey: queryKeys.commodities.latest(),
    queryFn: () => fetchJson<LatestPrice[]>('/api/commodities/latest'),
    staleTime: 30 * 60 * 1000 // commodity: 30 min
  });
}

export function useCommodityChanges() {
  return useQuery({
    queryKey: queryKeys.commodities.changes(),
    queryFn: () => fetchJson<PriceChange[]>('/api/commodities/changes'),
    staleTime: 30 * 60 * 1000
  });
}

export function useCommodityHistories(period: string) {
  const startDate = getStartDate(period);

  const queries = useQueries({
    queries: COMMODITIES.map((c) => ({
      queryKey: queryKeys.commodities.history(c.symbol, startDate),
      queryFn: () =>
        fetchJson<HistoryResponse>(
          `/api/commodities/history?symbol=${encodeURIComponent(c.symbol)}&start_date=${startDate}&limit=2000`
        ),
      staleTime: 30 * 60 * 1000
    }))
  });

  const histories = queries
    .map((q) => q.data)
    .filter((d): d is HistoryResponse => d != null);

  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.error)?.error ?? null;

  return { histories, isLoading, error };
}

function getStartDate(days: string): string {
  const start = new Date();
  start.setDate(start.getDate() - parseInt(days));
  return start.toISOString().slice(0, 10);
}

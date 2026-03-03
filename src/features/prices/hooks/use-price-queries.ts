import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchJson } from '@/lib/api-client';
import type {
  PriceSummaryData,
  PriceCompareData,
  PriceTrendData
} from '../types';

export function usePriceSummary() {
  return useQuery({
    queryKey: queryKeys.prices.summary(),
    queryFn: () => fetchJson<PriceSummaryData>('/api/prices/summary'),
    staleTime: 60 * 60 * 1000 // SQLite: 1 hour
  });
}

export function usePriceCompare(category: string) {
  return useQuery({
    queryKey: queryKeys.prices.compare(category),
    queryFn: () =>
      fetchJson<PriceCompareData>(
        `/api/prices/compare?category=${encodeURIComponent(category)}`
      ),
    enabled: !!category,
    staleTime: 60 * 60 * 1000
  });
}

export function usePriceTrend(category: string) {
  return useQuery({
    queryKey: queryKeys.prices.trend(category),
    queryFn: () =>
      fetchJson<PriceTrendData>(
        `/api/prices/trend?category=${encodeURIComponent(category)}`
      ),
    enabled: !!category,
    staleTime: 60 * 60 * 1000
  });
}

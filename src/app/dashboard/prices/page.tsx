'use client';

import { useCallback, useEffect, useState } from 'react';
import { PriceSummaryCards } from '@/features/prices/components/price-summary-cards';
import { SourceCompareChart } from '@/features/prices/components/source-compare-chart';
import { PriceSpecChart } from '@/features/prices/components/price-spec-chart';
import { CoverageMatrix } from '@/features/prices/components/coverage-matrix';
import { CategorySelect } from '@/features/prices/components/category-select';
import { Separator } from '@/components/ui/separator';
import {
  ALLOWED_CATEGORIES,
  type SourceTypeStat
} from '@/features/prices/constants';
import { IOSInstallPrompt } from '@/features/prices/components/ios-install-prompt';
import { SourceTypeOverview } from '@/features/prices/components/source-type-overview';

interface SummaryResponse {
  success: boolean;
  data: {
    totals: {
      total_items: number;
      total_categories: number;
      total_sources: number;
      last_updated: string;
    };
    categories: {
      category: string;
      count: number;
      avg_price: number;
      min_price: number;
      max_price: number;
    }[];
    sources: { source: string; count: number; categories: string[] }[];
    sourceTypes: SourceTypeStat[];
    recentUpdates: {
      category: string;
      source: string;
      count: number;
      updated_at: string;
    }[];
  };
}

interface CompareResponse {
  success: boolean;
  data: {
    category: string;
    sourceComparison: {
      source: string;
      item_count: number;
      avg_sell_price: number;
      avg_list_price: number;
      avg_discount: string;
      min_price: number;
      max_price: number;
      stddev_price: number;
    }[];
    specOverlap: {
      spec_label: string;
      ampere: string;
      poles: string;
      prices: {
        source: string;
        sell_price: number;
        list_price: number;
        discount: number;
      }[];
    }[];
  };
}

interface TrendResponse {
  success: boolean;
  data: {
    category: string;
    specCurve: {
      source: string;
      sell_price: number;
      ampere: string | null;
      size: string | null;
      spec_value: string | null;
      model: string | null;
      nominal_size: string | null;
    }[];
    distribution: { source: string; price_range: string; count: number }[];
    coverage: {
      source: string;
      total: number;
      unique_models: number;
      unique_amperes: number;
      unique_sizes: number;
    }[];
  };
}

export default function PricesPage() {
  const [summary, setSummary] = useState<SummaryResponse['data'] | null>(null);
  const [compare, setCompare] = useState<CompareResponse['data'] | null>(null);
  const [trend, setTrend] = useState<TrendResponse['data'] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    ALLOWED_CATEGORIES[1]
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/prices/summary')
      .then((r) => r.json())
      .then((r: SummaryResponse) => {
        if (r.success) setSummary(r.data);
        else setError('無法載入價格摘要');
      })
      .catch(() => setError('無法連線到價格 API'))
      .finally(() => setLoading(false));
  }, []);

  const fetchCategoryData = useCallback((category: string) => {
    setError(null);
    Promise.all([
      fetch(
        `/api/prices/compare?category=${encodeURIComponent(category)}`
      ).then((r) => r.json()),
      fetch(`/api/prices/trend?category=${encodeURIComponent(category)}`).then(
        (r) => r.json()
      )
    ])
      .then(([cmp, trd]: [CompareResponse, TrendResponse]) => {
        if (cmp.success) setCompare(cmp.data);
        if (trd.success) setTrend(trd.data);
      })
      .catch(() => setError('載入品類資料失敗'));
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchCategoryData(selectedCategory);
    }
  }, [selectedCategory, fetchCategoryData]);

  if (loading) {
    return (
      <div className='flex h-[50vh] items-center justify-center'>
        <div className='text-muted-foreground text-sm'>載入價格數據...</div>
      </div>
    );
  }

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      {/* Header */}
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          價格情報
        </h2>
        <p className='text-muted-foreground text-xs sm:text-sm'>
          跨源價格趨勢合理性 & 一致性分析
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400'>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <PriceSummaryCards data={summary?.totals ?? null} />

      {/* Source Type Overview */}
      <SourceTypeOverview data={summary?.sourceTypes ?? []} />

      <Separator />

      {/* Category Selector */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <span className='text-sm font-medium'>品類篩選</span>
        <CategorySelect
          value={selectedCategory}
          onValueChange={setSelectedCategory}
          categories={summary?.categories ?? []}
        />
      </div>

      {/* Charts Grid */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <SourceCompareChart
          data={compare?.sourceComparison ?? []}
          category={selectedCategory}
        />
        <PriceSpecChart
          data={trend?.specCurve ?? []}
          category={selectedCategory}
        />
      </div>

      {/* Spec Overlap Table */}
      {compare?.specOverlap && compare.specOverlap.length > 0 && (
        <SpecOverlapTable data={compare.specOverlap} />
      )}

      {/* Coverage Matrix */}
      <CoverageMatrix
        categories={summary?.categories ?? []}
        sources={summary?.sources ?? []}
      />

      {/* iOS Install Prompt */}
      <IOSInstallPrompt />
    </div>
  );
}

function SpecOverlapTable({
  data
}: {
  data: {
    spec_label: string;
    ampere: string;
    poles: string;
    prices: {
      source: string;
      sell_price: number;
      list_price: number;
      discount: number;
    }[];
  }[];
}) {
  return (
    <div className='rounded-lg border'>
      <div className='px-4 py-3 sm:px-6'>
        <h3 className='text-base font-semibold sm:text-lg'>
          跨源直接比較（重疊規格）
        </h3>
        <p className='text-muted-foreground text-xs'>
          同規格在不同通路的售價對照
        </p>
      </div>
      <div className='overflow-x-auto'>
        <table className='w-full text-xs sm:text-sm'>
          <thead>
            <tr className='border-t'>
              <th className='px-3 py-2 text-left font-medium'>規格</th>
              <th className='px-3 py-2 text-left font-medium'>極數</th>
              <th className='px-3 py-2 text-left font-medium'>安培</th>
              <th className='px-3 py-2 text-left font-medium'>通路比較</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 20).map((row, i) => (
              <tr key={i} className='border-t'>
                <td className='px-3 py-2 font-mono'>{row.spec_label}</td>
                <td className='px-3 py-2'>{row.poles || '—'}</td>
                <td className='px-3 py-2'>{row.ampere || '—'}</td>
                <td className='px-3 py-2'>
                  <div className='flex flex-wrap gap-2'>
                    {row.prices.map((p, j) => {
                      const prices = row.prices.map((x) => x.sell_price);
                      const min = Math.min(...prices);
                      const max = Math.max(...prices);
                      const isMin = p.sell_price === min && min !== max;
                      const isMax = p.sell_price === max && min !== max;
                      return (
                        <span
                          key={j}
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                            isMin
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : isMax
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-muted'
                          }`}
                        >
                          <span className='text-muted-foreground text-[10px]'>
                            {p.source}
                          </span>
                          <span className='font-mono font-medium tabular-nums'>
                            ${p.sell_price.toLocaleString()}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { PriceSummaryCards } from '@/features/prices/components/price-summary-cards';
import { SourceCompareChart } from '@/features/prices/components/source-compare-chart';
import { PriceSpecChart } from '@/features/prices/components/price-spec-chart';
import { CoverageMatrix } from '@/features/prices/components/coverage-matrix';
import { CategorySelect } from '@/features/prices/components/category-select';
import { Separator } from '@/components/ui/separator';
import { IOSInstallPrompt } from '@/features/prices/components/ios-install-prompt';
import { SourceTypeOverview } from '@/features/prices/components/source-type-overview';
import {
  usePriceSummary,
  usePriceCompare,
  usePriceTrend
} from '@/features/prices/hooks/use-price-queries';

export default function PricesPage() {
  const [selectedCategory, setSelectedCategory] = useState('');

  const { data: summary, isLoading, error: summaryError } = usePriceSummary();

  // Auto-select first category when summary loads
  const effectiveCategory =
    selectedCategory ||
    (summary?.categories.length ? summary.categories[0].category : '');

  const { data: compare, error: compareError } =
    usePriceCompare(effectiveCategory);
  const { data: trend, error: trendError } = usePriceTrend(effectiveCategory);

  const error = summaryError || compareError || trendError;

  if (isLoading) {
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
          {error instanceof Error ? error.message : '載入資料失敗'}
        </div>
      )}

      {/* Summary Cards */}
      <PriceSummaryCards data={summary?.totals ?? null} />

      {/* Source Type Overview */}
      <div id='section-sources'>
        <SourceTypeOverview data={summary?.sourceTypes ?? []} />
      </div>

      <Separator />

      {/* Category Selector */}
      <div
        id='section-categories'
        className='flex flex-col gap-3 sm:flex-row sm:items-center'
      >
        <span className='text-sm font-medium'>品類篩選</span>
        <CategorySelect
          value={effectiveCategory}
          onValueChange={setSelectedCategory}
          categories={summary?.categories ?? []}
        />
      </div>

      {/* Charts Grid */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <SourceCompareChart
          data={compare?.sourceComparison ?? []}
          category={effectiveCategory}
        />
        <PriceSpecChart
          data={trend?.specCurve ?? []}
          category={effectiveCategory}
        />
      </div>

      {/* Spec Overlap Table */}
      {compare?.specOverlap && compare.specOverlap.length > 0 && (
        <SpecOverlapTable data={compare.specOverlap} />
      )}

      {/* Coverage Matrix */}
      <div id='section-items'>
        <CoverageMatrix
          categories={summary?.categories ?? []}
          sources={summary?.sources ?? []}
        />
      </div>

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
            {data.slice(0, 20).map((row, i) => {
              const sellPrices = row.prices.map((x) => x.sell_price);
              const min = Math.min(...sellPrices);
              const max = Math.max(...sellPrices);
              return (
                <tr
                  key={`${row.spec_label}-${row.ampere}-${row.poles}`}
                  className='border-t'
                >
                  <td className='px-3 py-2 font-mono'>{row.spec_label}</td>
                  <td className='px-3 py-2'>{row.poles || '—'}</td>
                  <td className='px-3 py-2'>{row.ampere || '—'}</td>
                  <td className='px-3 py-2'>
                    <div className='flex flex-wrap gap-2'>
                      {row.prices.map((p) => {
                        const isMin = p.sell_price === min && min !== max;
                        const isMax = p.sell_price === max && min !== max;
                        return (
                          <span
                            key={p.source}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

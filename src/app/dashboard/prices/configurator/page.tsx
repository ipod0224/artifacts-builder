'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ALLOWED_CATEGORIES,
  CATEGORY_LABELS,
  SPEC_DIMENSIONS,
  type PriceCategory
} from '@/features/prices/constants';
import {
  DimensionRow,
  type DimensionOption
} from './_components/dimension-row';
import { FilterChip } from './_components/filter-chip';
import { ProductTable, type ProductRow } from './_components/product-table';
import { ResultSummary } from './_components/result-summary';

interface Summary {
  sourceCount: number;
  totalProducts: number;
  lowestPrice: number;
  priceRange: [number, number];
}

interface SpecOptionsResponse {
  success: boolean;
  data: {
    category: string;
    dimensions: DimensionOption[];
    products: ProductRow[];
    filterCount: number;
    totalDimensions: number;
    summary: Summary | null;
  };
}

const CONFIGURABLE_CATEGORIES = ALLOWED_CATEGORIES.filter(
  (c) => (SPEC_DIMENSIONS[c]?.length ?? 0) > 0
);

export default function ConfiguratorPage() {
  const [category, setCategory] = useState<PriceCategory | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(
    async (
      cat: PriceCategory,
      currentFilters: Record<string, string>,
      signal: AbortSignal
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ category: cat });
        for (const [k, v] of Object.entries(currentFilters)) {
          params.set(k, v);
        }
        const res = await fetch(`/api/prices/spec-options?${params}`, {
          signal
        });
        if (!res.ok) {
          setError(`API 錯誤 (${res.status})`);
          return;
        }
        const json: SpecOptionsResponse = await res.json();
        if (json.success) {
          setDimensions(json.data.dimensions);
          setProducts(json.data.products);
          setSummary(json.data.summary);
        } else {
          setError('無法載入規格選項');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('無法連線到 API');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!category) return;
    const controller = new AbortController();
    fetchOptions(category, filters, controller.signal);
    return () => controller.abort();
  }, [category, filters, fetchOptions]);

  const handleCategorySelect = (cat: PriceCategory) => {
    setCategory(cat);
    setFilters({});
    setDimensions([]);
    setProducts([]);
    setSummary(null);
    setError(null);
  };

  const handleDimensionSelect = (key: string, value: string) => {
    const { [key]: existing, ...rest } = filters;
    setFilters(existing === value ? rest : { ...filters, [key]: value });
  };

  const handleClearAll = () => {
    setFilters({});
  };

  const filterCount = Object.keys(filters).length;
  const hasUnknownAf = products.some((p) => p.match_type === 'unknown_af');

  /** Category-aware label for the unknown section footnote */
  const unknownLabel =
    category === 'nfb' || category === 'leakagebreaker'
      ? '框架(AF)'
      : category === 'transformer'
        ? '型式'
        : category === 'cable'
          ? '種類'
          : '部分規格';

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      {/* Header */}
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          互動配置器
        </h2>
        <p className='text-muted-foreground text-xs sm:text-sm'>
          逐步選取規格，即時比較各通路價格
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400'>
          {error}
        </div>
      )}

      {/* Step 1: Category Selection */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>Step 1：選擇品類</CardTitle>
          <CardDescription>點選要比價的材料品類</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-2'>
            {CONFIGURABLE_CATEGORIES.map((cat) => (
              <FilterChip
                key={cat}
                label={CATEGORY_LABELS[cat]}
                selected={category === cat}
                onClick={() => handleCategorySelect(cat)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Progressive Spec Selection */}
      {category && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Step 2：篩選規格</CardTitle>
            <CardDescription>
              點選規格值逐步收窄，再次點選可取消
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Active filters summary */}
            {filterCount > 0 && (
              <div className='bg-muted/50 flex flex-wrap items-center gap-1.5 rounded-lg px-3 py-2'>
                <span className='text-muted-foreground mr-1 text-xs'>
                  已選：
                </span>
                {Object.entries(filters).map(([key, value]) => {
                  const dim = dimensions.find((d) => d.key === key);
                  return (
                    <FilterChip
                      key={key}
                      label={`${dim?.label ?? key}: ${value}`}
                      selected
                      showRemove
                      onClick={() => handleDimensionSelect(key, value)}
                    />
                  );
                })}
                <button
                  type='button'
                  onClick={handleClearAll}
                  className='text-muted-foreground hover:text-foreground ml-1 text-xs underline-offset-2 hover:underline'
                >
                  清除全部
                </button>
              </div>
            )}
            {loading && dimensions.length === 0 ? (
              <div className='space-y-3'>
                <Skeleton className='h-8 w-48' />
                <Skeleton className='h-8 w-full' />
              </div>
            ) : (
              dimensions.map((dim) => (
                <DimensionRow
                  key={dim.key}
                  dimension={dim}
                  onSelect={(val) => handleDimensionSelect(dim.key, val)}
                  loading={loading}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Results */}
      {category && filterCount > 0 && (
        <>
          <Separator />
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>比價結果</CardTitle>
              <CardDescription>
                同規格在各通路的售價對照（最低價綠色標記）
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='space-y-2'>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className='h-10 w-full' />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <p className='text-muted-foreground py-8 text-center text-sm'>
                  目前條件無符合的價格資料
                </p>
              ) : (
                <>
                  {summary && (
                    <ResultSummary
                      summary={summary}
                      hasUnknownAf={hasUnknownAf}
                      unknownLabel={unknownLabel}
                    />
                  )}
                  <ProductTable products={products} category={category} />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface DimensionOption {
  key: string;
  label: string;
  values: string[];
  selected: string | null;
}

interface ProductRow {
  source: string;
  brand: string | null;
  model: string | null;
  sell_price: number;
  list_price: number | null;
  discount: number | null;
  specs: { model?: string; spec?: string; name?: string };
}

interface SpecOptionsResponse {
  success: boolean;
  data: {
    category: string;
    dimensions: DimensionOption[];
    products: ProductRow[];
    filterCount: number;
    totalDimensions: number;
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
  const groupedProducts = useMemo(() => groupBySpec(products), [products]);

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            互動配置器
          </h2>
          <p className='text-muted-foreground text-xs sm:text-sm'>
            逐步選取規格，即時比較各通路價格
          </p>
        </div>
        {filterCount > 0 && (
          <Button variant='outline' size='sm' onClick={handleClearAll}>
            清除篩選 ({filterCount})
          </Button>
        )}
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
              <Button
                key={cat}
                variant={category === cat ? 'default' : 'outline'}
                size='sm'
                onClick={() => handleCategorySelect(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </Button>
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
              <CardTitle className='text-base'>
                比價結果
                <Badge variant='secondary' className='ml-2'>
                  {products.length} 筆
                </Badge>
              </CardTitle>
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
              ) : groupedProducts.length > 0 ? (
                <ComparisonTable groups={groupedProducts} />
              ) : (
                <ProductTable products={products} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DimensionRow({
  dimension,
  onSelect,
  loading
}: {
  dimension: DimensionOption;
  onSelect: (val: string) => void;
  loading: boolean;
}) {
  const sortedValues = sortSpecValues(dimension.values);

  return (
    <div>
      <div className='mb-1.5 flex items-center gap-2'>
        <span className='text-sm font-medium'>{dimension.label}</span>
        <Badge variant='outline' className='text-[10px]'>
          {dimension.values.length}
        </Badge>
      </div>
      <div className='flex flex-wrap gap-1.5'>
        {sortedValues.map((val) => {
          const isSelected = dimension.selected === val;
          return (
            <Button
              key={val}
              variant={isSelected ? 'default' : 'outline'}
              size='sm'
              className='h-7 px-2.5 text-xs'
              disabled={loading}
              onClick={() => onSelect(val)}
            >
              {val}
            </Button>
          );
        })}
        {dimension.values.length === 0 && (
          <span className='text-muted-foreground text-xs'>
            （目前條件下無可用值）
          </span>
        )}
      </div>
    </div>
  );
}

/** Sort spec values — strict numeric check with Number() */
function sortSpecValues(values: string[]): string[] {
  const allNumeric = values.every((v) => v.trim() !== '' && !isNaN(Number(v)));
  if (allNumeric) {
    return [...values].sort((a, b) => Number(a) - Number(b));
  }
  return [...values].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

interface SpecGroup {
  specLabel: string;
  entries: ProductRow[];
  minPrice: number;
  maxPrice: number;
}

function groupBySpec(products: ProductRow[]): SpecGroup[] {
  const map = new Map<string, ProductRow[]>();
  for (const p of products) {
    const label = p.specs?.model || p.specs?.spec || p.specs?.name || 'unknown';
    if (!map.has(label)) {
      map.set(label, []);
    }
    map.get(label)!.push(p);
  }

  return Array.from(map.entries())
    .filter(([, entries]) => entries.length >= 2)
    .map(([specLabel, entries]) => {
      const prices = entries.map((e) => e.sell_price);
      return {
        specLabel,
        entries,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices)
      };
    })
    .sort((a, b) => a.specLabel.localeCompare(b.specLabel, 'zh-Hant'));
}

function ComparisonTable({ groups }: { groups: SpecGroup[] }) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs sm:text-sm'>
        <thead>
          <tr className='border-b'>
            <th className='px-3 py-2 text-left font-medium'>規格/型號</th>
            <th className='px-3 py-2 text-left font-medium'>通路比較</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.specLabel} className='border-b'>
              <td className='px-3 py-2 font-mono'>{group.specLabel}</td>
              <td className='px-3 py-2'>
                <div className='flex flex-wrap gap-2'>
                  {group.entries.map((p) => {
                    const isMin =
                      p.sell_price === group.minPrice &&
                      group.minPrice !== group.maxPrice;
                    const isMax =
                      p.sell_price === group.maxPrice &&
                      group.minPrice !== group.maxPrice;
                    return (
                      <span
                        key={`${p.source}-${p.model ?? ''}-${p.sell_price}`}
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
  );
}

function ProductTable({ products }: { products: ProductRow[] }) {
  const minPrice = Math.min(...products.map((p) => p.sell_price));

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs sm:text-sm'>
        <thead>
          <tr className='border-b'>
            <th className='px-3 py-2 text-left font-medium'>通路</th>
            <th className='px-3 py-2 text-left font-medium'>品牌</th>
            <th className='px-3 py-2 text-left font-medium'>型號</th>
            <th className='px-3 py-2 text-right font-medium'>售價</th>
            <th className='px-3 py-2 text-right font-medium'>牌價</th>
            <th className='px-3 py-2 text-right font-medium'>折數</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr
              key={`${p.source}-${p.model ?? ''}-${p.sell_price}`}
              className='border-b'
            >
              <td className='px-3 py-2'>{p.source}</td>
              <td className='px-3 py-2'>{p.brand ?? '—'}</td>
              <td className='px-3 py-2 font-mono'>{p.model ?? '—'}</td>
              <td className='px-3 py-2 text-right'>
                <span
                  className={`font-mono tabular-nums ${
                    p.sell_price === minPrice
                      ? 'font-bold text-green-600 dark:text-green-400'
                      : ''
                  }`}
                >
                  ${p.sell_price.toLocaleString()}
                </span>
              </td>
              <td className='text-muted-foreground px-3 py-2 text-right font-mono tabular-nums'>
                {p.list_price ? `$${p.list_price.toLocaleString()}` : '—'}
              </td>
              <td className='text-muted-foreground px-3 py-2 text-right font-mono tabular-nums'>
                {p.discount ? `${(Number(p.discount) * 100).toFixed(1)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

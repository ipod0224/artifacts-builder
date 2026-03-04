'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import type { PriceCategory } from '@/features/prices/constants';

export interface ProductRow {
  id: string;
  source: string;
  brand: string | null;
  model: string | null;
  sell_price: number;
  list_price: number | null;
  discount: number | null;
  frame_af: string | null;
  ampere: string | null;
  series: string | null;
  match_type: 'exact' | 'unknown_af';
  specs: {
    model?: string;
    spec?: string;
    name?: string;
    price_north?: number | null;
    price_central?: number | null;
    price_south?: number | null;
    price_east?: number | null;
  };
  labor_cost_per_m?: number | null;
}

/** Max unknown_af rows shown before "show more" */
const UNKNOWN_AF_PREVIEW = 5;

/** Format source + brand into a single display string */
function formatSource(source: string, brand: string | null): string {
  if (!brand || brand === source) return source;
  return `${source}·${brand}`;
}

/** Source display labels */
const SOURCE_LABELS: Record<string, string> = {
  PCIC: 'PCIC 公共工程價格資料庫',
  TCRI: 'TCRI 營建物價',
  銘宣: '銘宣實售價',
  鍾榮: '牌價-電纜',
  朝立: '牌價 (無熔絲開關)',
  東元電機: '牌價 (無熔絲開關)',
  三菱電機: '牌價 (無熔絲開關)',
  萬蕙昇: '牌價 (管件)',
  茂忠: '茂忠商品頁',
  信佳電機: '牌價 (變壓器)',
  樺晟: '樺晟官網'
};

/** All sources go through proxy route for unified handling */
function getSourceRef(
  source: string,
  id: string
): { url: string; label: string } | null {
  const label = SOURCE_LABELS[source];
  if (!label) return null;
  const params = new URLSearchParams({ source, id });
  return {
    url: `/api/prices/source-proxy?${params.toString()}`,
    label
  };
}

/** Category-aware label for the "unknown" section */
function getUnknownLabel(category: PriceCategory): string {
  switch (category) {
    case 'nfb':
    case 'leakagebreaker':
      return 'AF 未標示';
    case 'transformer':
      return '型式未標示';
    case 'cable':
      return '種類未標示';
    default:
      return '未標示';
  }
}

export function ProductTable({
  products,
  category
}: {
  products: ProductRow[];
  category: PriceCategory;
}) {
  const rawExact = products.filter((p) => p.match_type === 'exact');
  const rawUnknown = products.filter((p) => p.match_type === 'unknown_af');

  // If no exact products exist, promote unknown to regular display
  // (unknown section only meaningful when there's something to compare against)
  const exactProducts = rawExact.length > 0 ? rawExact : rawUnknown;
  const unknownAfProducts = rawExact.length > 0 ? rawUnknown : [];
  const minPrice = Math.min(...products.map((p) => p.sell_price));
  const showSeries =
    (category === 'nfb' || category === 'leakagebreaker') &&
    products.some((p) => p.series);
  const showLabor =
    category === 'cable' && products.some((p) => p.labor_cost_per_m != null);
  const colCount = 5 + (showSeries ? 1 : 0) + (showLabor ? 1 : 0);
  const unknownLabel = getUnknownLabel(category);

  const [showAllUnknown, setShowAllUnknown] = useState(false);
  const visibleUnknown = showAllUnknown
    ? unknownAfProducts
    : unknownAfProducts.slice(0, UNKNOWN_AF_PREVIEW);
  const hiddenCount = unknownAfProducts.length - UNKNOWN_AF_PREVIEW;

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs sm:text-sm'>
        <thead>
          <tr className='border-b'>
            <th className='px-2 py-2 text-left font-medium'>通路</th>
            <th className='px-2 py-2 text-left font-medium'>型號</th>
            {showSeries && (
              <th className='px-2 py-2 text-left font-medium'>產品線</th>
            )}
            <th className='px-2 py-2 text-right font-medium'>售價</th>
            <th className='px-2 py-2 text-right font-medium'>牌價</th>
            <th className='px-2 py-2 text-right font-medium'>折數</th>
            {showLabor && (
              <th className='px-2 py-2 text-right font-medium'>工資/M</th>
            )}
          </tr>
        </thead>
        <tbody>
          {exactProducts.map((p) => (
            <Row
              key={p.id}
              p={p}
              minPrice={minPrice}
              showSeries={showSeries}
              showLabor={showLabor}
            />
          ))}
          {unknownAfProducts.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={colCount}
                  className='text-muted-foreground border-t-2 border-dashed px-2 py-1.5 text-xs font-medium'
                >
                  {unknownLabel}（{unknownAfProducts.length} 筆）
                </td>
              </tr>
              {visibleUnknown.map((p) => (
                <Row
                  key={p.id}
                  p={p}
                  minPrice={minPrice}
                  showSeries={showSeries}
                  showLabor={showLabor}
                  dimmed
                />
              ))}
              {hiddenCount > 0 && !showAllUnknown && (
                <tr>
                  <td colSpan={colCount} className='px-2 py-1.5'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-muted-foreground h-auto p-0 text-xs'
                      onClick={() => setShowAllUnknown(true)}
                    >
                      展開其餘 {hiddenCount} 筆 ▾
                    </Button>
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  p,
  minPrice,
  showSeries,
  showLabor = false,
  dimmed = false
}: {
  p: ProductRow;
  minPrice: number;
  showSeries: boolean;
  showLabor?: boolean;
  dimmed?: boolean;
}) {
  return (
    <tr className={`border-b ${dimmed ? 'bg-muted/30' : ''}`}>
      <td className='px-2 py-2 whitespace-nowrap'>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type='button'
              className='min-h-[44px] cursor-pointer text-left underline decoration-dotted underline-offset-2 hover:decoration-solid'
            >
              {formatSource(p.source, p.brand)}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align='start'
            collisionPadding={12}
            className='w-auto max-w-xs space-y-1 p-2.5'
          >
            <p className='text-xs leading-relaxed'>
              {p.specs?.name || '（無原始品名）'}
            </p>
            <p className='text-muted-foreground font-mono text-[11px]'>
              {p.id}
            </p>
            <SourceRefLink source={p.source} id={p.id} />
          </PopoverContent>
        </Popover>
      </td>
      <td className='max-w-[220px] truncate px-2 py-2 font-mono'>
        {p.model ?? '—'}
      </td>
      {showSeries && (
        <td className='text-muted-foreground px-2 py-2 font-mono'>
          {p.series ?? ''}
        </td>
      )}
      <td className='px-2 py-2 text-right'>
        <span
          className={`font-mono tabular-nums ${
            p.sell_price === minPrice
              ? 'font-bold text-green-600 dark:text-green-400'
              : ''
          }`}
        >
          ${p.sell_price.toLocaleString()}
        </span>
        {p.source === 'PCIC' && (
          <span className='text-muted-foreground block text-[10px] leading-tight'>
            最高決標價
          </span>
        )}
        {p.source === 'TCRI' && p.specs?.price_north != null && (
          <span className='text-muted-foreground block text-[10px] leading-tight'>
            北{p.specs.price_north} 中{p.specs.price_central} 南
            {p.specs.price_south} 東{p.specs.price_east}
          </span>
        )}
      </td>
      <td className='text-muted-foreground px-2 py-2 text-right font-mono tabular-nums'>
        {p.list_price ? `$${p.list_price.toLocaleString()}` : ''}
      </td>
      <td className='text-muted-foreground px-2 py-2 text-right font-mono tabular-nums'>
        {p.discount ? `${(Number(p.discount) * 100).toFixed(1)}%` : ''}
      </td>
      {showLabor && (
        <td className='text-muted-foreground px-2 py-2 text-right font-mono tabular-nums'>
          {p.labor_cost_per_m != null
            ? `$${p.labor_cost_per_m.toLocaleString()}`
            : ''}
        </td>
      )}
    </tr>
  );
}

function SourceRefLink({ source, id }: { source: string; id: string }) {
  const ref = getSourceRef(source, id);
  if (!ref) return null;
  return (
    <a
      href={ref.url}
      target='_blank'
      rel='noopener noreferrer'
      className='inline-block pt-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400'
    >
      {ref.label} ↗
    </a>
  );
}

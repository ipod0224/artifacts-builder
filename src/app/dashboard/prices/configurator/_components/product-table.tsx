'use client';

import { SPEC_DIMENSIONS } from '@/features/prices/constants';
import type { PriceCategory } from '@/features/prices/constants';
import { formatAmpere } from './utils';

export interface ProductRow {
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
  specs: { model?: string; spec?: string; name?: string };
}

/** Determine which extra columns to show based on category */
function getCategoryColumns(category: PriceCategory) {
  const cols: { key: string; label: string; align: 'left' | 'right' }[] = [];
  const dims = SPEC_DIMENSIONS[category];
  if (!dims) return cols;

  if (category === 'nfb' || category === 'leakagebreaker') {
    cols.push({ key: 'frame_af', label: 'AF', align: 'right' });
    cols.push({ key: 'ampere', label: 'AT 範圍', align: 'left' });
    cols.push({ key: 'series', label: '產品線', align: 'left' });
  }

  return cols;
}

export function ProductTable({
  products,
  category
}: {
  products: ProductRow[];
  category: PriceCategory;
}) {
  const exactProducts = products.filter((p) => p.match_type === 'exact');
  const unknownAfProducts = products.filter(
    (p) => p.match_type === 'unknown_af'
  );
  const allProducts = products;
  const minPrice = Math.min(...allProducts.map((p) => p.sell_price));
  const extraCols = getCategoryColumns(category);

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs sm:text-sm'>
        <thead>
          <tr className='border-b'>
            <th className='px-2 py-2 text-left font-medium'>通路</th>
            <th className='px-2 py-2 text-left font-medium'>品牌</th>
            <th className='px-2 py-2 text-left font-medium'>型號</th>
            {extraCols.map((col) => (
              <th
                key={col.key}
                className={`px-2 py-2 font-medium ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.label}
              </th>
            ))}
            <th className='px-2 py-2 text-right font-medium'>售價</th>
            <th className='px-2 py-2 text-right font-medium'>牌價</th>
            <th className='px-2 py-2 text-right font-medium'>折數</th>
          </tr>
        </thead>
        <tbody>
          {exactProducts.map((p, idx) => (
            <ProductRowCells
              key={`exact-${p.source}-${p.model ?? ''}-${p.sell_price}-${idx}`}
              product={p}
              minPrice={minPrice}
              extraCols={extraCols}
            />
          ))}
          {unknownAfProducts.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={3 + extraCols.length + 3}
                  className='text-muted-foreground border-t-2 border-dashed px-2 py-1.5 text-xs font-medium'
                >
                  AF 未標示
                </td>
              </tr>
              {unknownAfProducts.map((p, idx) => (
                <ProductRowCells
                  key={`unknown-${p.source}-${p.model ?? ''}-${p.sell_price}-${idx}`}
                  product={p}
                  minPrice={minPrice}
                  extraCols={extraCols}
                  dimmed
                />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProductRowCells({
  product: p,
  minPrice,
  extraCols,
  dimmed = false
}: {
  product: ProductRow;
  minPrice: number;
  extraCols: { key: string; label: string; align: 'left' | 'right' }[];
  dimmed?: boolean;
}) {
  return (
    <tr className={`border-b ${dimmed ? 'bg-muted/30' : ''}`}>
      <td className='px-2 py-2'>{p.source}</td>
      <td className='px-2 py-2'>{p.brand ?? '—'}</td>
      <td className='max-w-[200px] truncate px-2 py-2 font-mono'>
        {p.model ?? '—'}
      </td>
      {extraCols.map((col) => {
        const raw = (p as unknown as Record<string, unknown>)[col.key] as
          | string
          | null;
        const display = col.key === 'ampere' ? formatAmpere(raw) : (raw ?? '—');
        return (
          <td
            key={col.key}
            className={`px-2 py-2 font-mono ${col.align === 'right' ? 'text-right' : ''}`}
          >
            {display}
          </td>
        );
      })}
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
      </td>
      <td className='text-muted-foreground px-2 py-2 text-right font-mono tabular-nums'>
        {p.list_price ? `$${p.list_price.toLocaleString()}` : '—'}
      </td>
      <td className='text-muted-foreground px-2 py-2 text-right font-mono tabular-nums'>
        {p.discount ? `${(Number(p.discount) * 100).toFixed(1)}%` : '—'}
      </td>
    </tr>
  );
}

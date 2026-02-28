'use client';

import { Database, TrendingUp, Shield, ShoppingCart, Zap } from 'lucide-react';
import type { SourceTypeStat } from '@/features/prices/constants';

const SOURCE_TYPE_META: Record<
  string,
  { label: string; desc: string; icon: typeof Database; color: string }
> = {
  m8b: {
    label: 'M8b 供應商定價',
    desc: '8 通路 OCR + PDF 萃取',
    icon: Database,
    color: 'text-blue-500'
  },
  tcri: {
    label: 'TCRI 營建物價',
    desc: '台灣營建物價四區報價',
    icon: TrendingUp,
    color: 'text-green-500'
  },
  pcic: {
    label: 'PCIC 決標價',
    desc: '公共工程實際成交價',
    icon: Shield,
    color: 'text-amber-500'
  },
  m5: {
    label: '茂忠通路售價',
    desc: '電商零售參考價',
    icon: ShoppingCart,
    color: 'text-purple-500'
  },
  winsen: {
    label: '銘宣即時查價',
    desc: 'HTTP 即時爬蟲',
    icon: Zap,
    color: 'text-cyan-500'
  }
};

export function SourceTypeOverview({ data }: { data: SourceTypeStat[] }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className='rounded-lg border'>
      <div className='px-4 py-3 sm:px-6'>
        <h3 className='text-base font-semibold sm:text-lg'>數據來源總覽</h3>
        <p className='text-muted-foreground text-xs'>
          統一 prices 表 — {total.toLocaleString()} 筆跨{data.length}源
        </p>
      </div>
      <div className='bg-border grid grid-cols-1 gap-px border-t sm:grid-cols-2 lg:grid-cols-4'>
        {data.map((st) => {
          const meta = SOURCE_TYPE_META[st.source_type];
          const Icon = meta?.icon ?? Database;
          const pct = total > 0 ? ((st.count / total) * 100).toFixed(1) : '0';

          return (
            <div
              key={st.source_type}
              className='bg-background flex items-start gap-3 px-4 py-3'
            >
              <Icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${meta?.color ?? 'text-muted-foreground'}`}
              />
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>
                  {meta?.label ?? st.source_type}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {meta?.desc ?? ''}
                </p>
                <div className='mt-1 flex items-baseline gap-2'>
                  <span className='font-mono text-lg font-bold tabular-nums'>
                    {st.count.toLocaleString()}
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    筆（{pct}%）
                  </span>
                </div>
                <p className='text-muted-foreground text-[10px]'>
                  {st.sources} 源 · {st.categories} 品類
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

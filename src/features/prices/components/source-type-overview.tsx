'use client';

import {
  Database,
  TrendingUp,
  Shield,
  ShoppingCart,
  Zap,
  Store,
  FileText,
  type LucideIcon
} from 'lucide-react';
import type { SourceTypeStat } from '@/features/prices/constants';

/** Known source → icon/label mapping (best-effort) */
const SOURCE_HINTS: Record<
  string,
  { label: string; icon: LucideIcon; color: string }
> = {
  m5: { label: '茂忠', icon: ShoppingCart, color: 'text-purple-500' },
  tcri: { label: 'TCRI 營建物價', icon: TrendingUp, color: 'text-green-500' },
  pcic: { label: 'PCIC 決標價', icon: Shield, color: 'text-amber-500' },
  winsen: { label: '銘宣電纜', icon: Zap, color: 'text-cyan-500' },
  whs: { label: '萬蕙昇', icon: Store, color: 'text-orange-500' },
  teco: { label: '東元電機', icon: FileText, color: 'text-blue-500' },
  shihlin: {
    label: '士林電機',
    icon: FileText,
    color: 'text-indigo-500'
  },
  cleswitch: { label: '朝立', icon: Store, color: 'text-teal-500' },
  mitsubishi: { label: '三菱電機', icon: Database, color: 'text-red-500' },
  chunglung: { label: '鍾榮', icon: Store, color: 'text-yellow-500' },
  hinjia: { label: '信佳電機', icon: Store, color: 'text-pink-500' },
  fc1980: { label: '樺晟', icon: Store, color: 'text-lime-500' },
  commodity: {
    label: '大宗商品',
    icon: TrendingUp,
    color: 'text-emerald-500'
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
          price-hub 聚合 — {total.toLocaleString()} 筆跨 {data.length} 源
        </p>
      </div>
      <div className='bg-border grid grid-cols-1 gap-px border-t sm:grid-cols-2 lg:grid-cols-4'>
        {data.map((st) => {
          const hint = SOURCE_HINTS[st.source_type];
          const Icon = hint?.icon ?? Database;
          const pct = total > 0 ? ((st.count / total) * 100).toFixed(1) : '0';

          return (
            <div
              key={st.source_type}
              className='bg-background flex items-start gap-3 px-4 py-3'
            >
              <Icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${hint?.color ?? 'text-muted-foreground'}`}
              />
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>
                  {hint?.label ?? st.source_type}
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
                  {st.categories} 品類
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

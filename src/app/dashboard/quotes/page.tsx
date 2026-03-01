'use client';

import { useEffect, useState } from 'react';
import { QuoteTimeline } from '@/features/quotes/components/quote-timeline';
import type { QuoteData } from '@/features/quotes/types';

export default function QuotesPage() {
  const [data, setData] = useState<QuoteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/quotes.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: QuoteData) => setData(d))
      .catch(() => setError('無法載入語錄資料'));
  }, []);

  if (error) {
    return (
      <div className='flex h-[50vh] items-center justify-center'>
        <div className='text-sm text-red-500'>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className='flex h-[50vh] items-center justify-center'>
        <div className='text-muted-foreground text-sm'>載入語錄...</div>
      </div>
    );
  }

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>語錄</h2>
        <p className='text-muted-foreground text-[13px] sm:text-sm'>
          每日三餐經典 + Naval 金句 — 共 {data.count} 則
        </p>
      </div>

      <QuoteTimeline quotes={data.quotes} />
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { QuoteCard } from './quote-card';
import type { Quote } from '../types';

const FILTERS = [
  { label: '全部', value: 'all' },
  { label: '晨讀', value: '晨讀' },
  { label: '午學', value: '午學' },
  { label: '夕省', value: '夕省' },
  { label: 'Naval', value: 'naval' }
] as const;

export function QuoteTimeline({ quotes }: { quotes: Quote[] }) {
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return quotes;
    if (filter === 'naval') return quotes.filter((q) => q.category === 'naval');
    return quotes.filter((q) => q.meal === filter);
  }, [quotes, filter]);

  // Group by date (daily) or theme (naval)
  const groups = useMemo(() => {
    const map = new Map<string, Quote[]>();

    for (const q of filtered) {
      const key =
        q.category === 'naval'
          ? `Naval — ${q.theme || '未分類'}`
          : q.date || '未知日期';

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }

    // Sort: daily dates descending, naval at the end
    return Array.from(map.entries()).sort(([a], [b]) => {
      const aIsNaval = a.startsWith('Naval');
      const bIsNaval = b.startsWith('Naval');
      if (aIsNaval && !bIsNaval) return 1;
      if (!aIsNaval && bIsNaval) return -1;
      return b.localeCompare(a); // descending for dates
    });
  }, [filtered]);

  return (
    <div className='space-y-6'>
      {/* Filter bar */}
      <div className='flex gap-1.5'>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-md px-3 py-1 text-[13px] font-medium transition-colors ${
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className='ml-auto self-center text-[13px] text-slate-500'>
          {filtered.length} 則語錄
        </span>
      </div>

      {/* Timeline groups */}
      {groups.map(([groupKey, groupQuotes]) => (
        <div key={groupKey}>
          <h3 className='mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300'>
            {groupKey}
          </h3>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {groupQuotes.map((q) => (
              <QuoteCard key={q.id} quote={q} />
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className='py-12 text-center text-sm text-slate-500'>
          沒有符合條件的語錄
        </div>
      )}
    </div>
  );
}

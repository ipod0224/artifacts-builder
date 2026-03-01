'use client';

import { useState, useMemo } from 'react';
import { QuoteCard } from './quote-card';
import type { Quote, BookInfo } from '../types';

const BASE_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '每日三餐', value: 'daily' },
  { label: '書籍金句', value: 'book' }
] as const;

export function QuoteTimeline({
  quotes,
  books
}: {
  quotes: Quote[];
  books: BookInfo[];
}) {
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return quotes;
    if (filter === 'daily') return quotes.filter((q) => q.category === 'daily');
    if (filter === 'book') return quotes.filter((q) => q.category === 'book');
    // Filter by specific book key
    return quotes.filter((q) => q.bookKey === filter);
  }, [quotes, filter]);

  // Build book filter options from actual data
  const bookFilters = useMemo(() => {
    const bookKeys = new Set(
      quotes.filter((q) => q.bookKey).map((q) => q.bookKey!)
    );
    return books
      .filter((b) => bookKeys.has(b.key))
      .map((b) => ({
        label: b.titleZh,
        value: b.key
      }));
  }, [quotes, books]);

  // Group by date (daily) or book (book quotes)
  const groups = useMemo(() => {
    const map = new Map<string, Quote[]>();

    for (const q of filtered) {
      let key: string;
      if (q.category === 'daily') {
        key = q.date || '未知日期';
      } else {
        const book = books.find((b) => b.key === q.bookKey);
        const bookTitle = book ? book.titleZh : '未分類';
        key = q.theme ? `${bookTitle} — ${q.theme}` : bookTitle;
      }

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }

    // Sort: daily dates descending, book titles alphabetically at the end
    return Array.from(map.entries()).sort(([a, aq], [b, bq]) => {
      const aIsDaily = aq[0]?.category === 'daily';
      const bIsDaily = bq[0]?.category === 'daily';
      if (aIsDaily && !bIsDaily) return -1;
      if (!aIsDaily && bIsDaily) return 1;
      if (aIsDaily && bIsDaily) return b.localeCompare(a); // descending dates
      return a.localeCompare(b); // ascending book titles
    });
  }, [filtered, books]);

  return (
    <div className='space-y-6'>
      {/* Filter bar */}
      <div className='flex flex-wrap gap-1.5'>
        {BASE_FILTERS.map((f) => (
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
        <span className='text-muted-foreground self-center px-1 text-[13px]'>
          |
        </span>
        {bookFilters.map((f) => (
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

      {/* Book description (when filtering by specific book) */}
      {filter !== 'all' && filter !== 'daily' && filter !== 'book' && (
        <BookDescription books={books} bookKey={filter} />
      )}

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

function BookDescription({
  books,
  bookKey
}: {
  books: BookInfo[];
  bookKey: string;
}) {
  const book = books.find((b) => b.key === bookKey);
  if (!book) return null;

  return (
    <div className='rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50'>
      <p className='text-sm font-medium text-slate-700 dark:text-slate-300'>
        {book.titleZh}
        <span className='ml-2 font-normal text-slate-500'>
          {book.title} — {book.author}
        </span>
      </p>
      <p className='mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400'>
        {book.description}
      </p>
    </div>
  );
}

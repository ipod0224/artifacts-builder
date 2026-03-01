'use client';

import { useState, useMemo } from 'react';
import { IconChevronDown, IconBook, IconFilter } from '@tabler/icons-react';
import { QuoteCard } from './quote-card';
import type { Quote, BookInfo } from '../types';

const CATEGORY_ORDER = [
  '談判策略',
  '溝通與調解',
  '說服與行為',
  '定價與銷售',
  '創業與經營',
  '人生智慧'
];

const CATEGORY_COLORS: Record<string, string> = {
  談判策略:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
  溝通與調解:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
  說服與行為:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800',
  定價與銷售:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
  創業與經營:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
  人生智慧:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800'
};

type FilterMode = 'all' | 'daily' | 'book' | string;

export function QuoteTimeline({
  quotes,
  books
}: {
  quotes: Quote[];
  books: BookInfo[];
}) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORY_ORDER)
  );

  const toggleBook = (key: string) => {
    setExpandedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Filtered quotes
  const filtered = useMemo(() => {
    if (filter === 'all') return quotes;
    if (filter === 'daily') return quotes.filter((q) => q.category === 'daily');
    if (filter === 'book') return quotes.filter((q) => q.category === 'book');
    // Filter by specific book key
    return quotes.filter((q) => q.bookKey === filter);
  }, [quotes, filter]);

  // Build category → books → quotes structure
  const categoryGroups = useMemo(() => {
    const bookQuotes = filtered.filter((q) => q.category === 'book');
    const dailyQuotes = filtered.filter((q) => q.category === 'daily');

    // Group book quotes by bookKey
    const bookMap = new Map<string, Quote[]>();
    for (const q of bookQuotes) {
      if (!q.bookKey) continue;
      if (!bookMap.has(q.bookKey)) bookMap.set(q.bookKey, []);
      bookMap.get(q.bookKey)!.push(q);
    }

    // Group books by category
    const catMap = new Map<string, { book: BookInfo; quotes: Quote[] }[]>();
    for (const book of books) {
      const bq = bookMap.get(book.key);
      if (!bq || bq.length === 0) continue;
      const cat = book.category || '未分類';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push({ book, quotes: bq });
    }

    // Sort categories by predefined order
    const sortedCategories = Array.from(catMap.entries()).sort(
      ([a], [b]) =>
        (CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a)) -
        (CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b))
    );

    return { dailyQuotes, sortedCategories };
  }, [filtered, books]);

  // Daily quote groups by date
  const dailyGroups = useMemo(() => {
    const map = new Map<string, Quote[]>();
    for (const q of categoryGroups.dailyQuotes) {
      const key = q.date || '未知日期';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [categoryGroups.dailyQuotes]);

  // Category filter options
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const b of books) {
      if (b.category) cats.add(b.category);
    }
    return CATEGORY_ORDER.filter((c) => cats.has(c));
  }, [books]);

  return (
    <div className='space-y-6'>
      {/* Filter bar */}
      <div className='flex flex-wrap items-center gap-1.5'>
        <IconFilter className='h-4 w-4 text-slate-400' />
        {[
          { label: '全部', value: 'all' },
          { label: '每日三餐', value: 'daily' },
          { label: '書籍金句', value: 'book' }
        ].map((f) => (
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
          {filter === 'book' || filter === 'all'
            ? ` · ${books.filter((b) => filtered.some((q) => q.bookKey === b.key)).length} 本書`
            : ''}
        </span>
      </div>

      {/* Daily quotes section */}
      {(filter === 'all' || filter === 'daily') && dailyGroups.length > 0 && (
        <div>
          <h3 className='mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300'>
            每日三餐語錄
          </h3>
          {dailyGroups.map(([date, dqs]) => (
            <div key={date} className='mb-4'>
              <p className='mb-2 text-[13px] font-medium text-slate-500'>
                {date}
              </p>
              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {dqs.map((q) => (
                  <QuoteCard key={q.id} quote={q} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Book quotes by category (accordion) */}
      {(filter === 'all' ||
        filter === 'book' ||
        !['all', 'daily'].includes(filter)) &&
        categoryGroups.sortedCategories.map(([catName, catBooks]) => (
          <div key={catName}>
            {/* Category header */}
            <button
              onClick={() => toggleCategory(catName)}
              className={`mb-3 flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-left transition-colors ${
                CATEGORY_COLORS[catName] ||
                'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <span className='text-sm font-semibold'>{catName}</span>
              <span className='text-[12px] opacity-70'>
                {catBooks.length} 本 ·{' '}
                {catBooks.reduce((sum, b) => sum + b.quotes.length, 0)} 句
              </span>
              <IconChevronDown
                className={`ml-auto h-4 w-4 transition-transform ${
                  expandedCategories.has(catName) ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Category content */}
            {expandedCategories.has(catName) && (
              <div className='space-y-4 pl-1'>
                {catBooks.map(({ book, quotes: bqs }) => (
                  <div
                    key={book.key}
                    className='rounded-lg border border-slate-200 dark:border-slate-700'
                  >
                    {/* Book header (collapsible) */}
                    <button
                      onClick={() => toggleBook(book.key)}
                      className='flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30'
                    >
                      <IconBook className='mt-0.5 h-4 w-4 shrink-0 text-slate-400' />
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-semibold text-slate-800 dark:text-slate-200'>
                          {book.titleZh}
                          <span className='ml-2 font-normal text-slate-400'>
                            {book.title}
                          </span>
                        </p>
                        <p className='mt-0.5 text-[12px] text-slate-500'>
                          {book.author} · {bqs.length} 則金句
                        </p>
                      </div>
                      <IconChevronDown
                        className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                          expandedBooks.has(book.key) ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Book description + quotes (expanded) */}
                    {expandedBooks.has(book.key) && (
                      <div className='border-t border-slate-100 px-4 pb-4 dark:border-slate-800'>
                        {/* Book description */}
                        <p className='mt-3 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400'>
                          {book.description}
                        </p>

                        {/* Quotes grid */}
                        <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                          {bqs.map((q) => (
                            <QuoteCard key={q.id} quote={q} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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

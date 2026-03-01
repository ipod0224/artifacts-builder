'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Quote, QuoteData } from '../types';

const MEAL_COLORS: Record<string, string> = {
  晨讀: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  午學: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  夕省: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
};

// 每位思想家只在固定的一天出現，避免同一人連日重複
// 0=Sun, 1=Mon, ..., 6=Sat
const WEEKLY_SCHEDULE: Record<number, string[]> = {
  1: ['莊子'],
  2: ['論語'],
  3: ['老子'],
  4: ['王陽明'],
  5: ['荀子', '菜根譚', '禮記'],
  6: ['Naval'],
  0: ['Naval']
};

function getSourceFamily(source: string): string {
  if (source.includes('莊子')) return '莊子';
  if (source.includes('論語')) return '論語';
  if (source.includes('道德經') || source.includes('老子')) return '老子';
  if (source.includes('荀子')) return '荀子';
  if (source.includes('菜根譚')) return '菜根譚';
  if (source.includes('禮記') || source.includes('大學')) return '禮記';
  if (source.includes('王陽明') || source.includes('傳習錄')) return '王陽明';
  if (source.includes('Naval') || source.includes('Almanack')) return 'Naval';
  return 'other';
}

// 日期種子：同一天固定同一則，隔天自動換
function pickByDate(arr: Quote[]): Quote {
  const today = new Date();
  const seed =
    today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 +
    today.getDate();
  return arr[seed % arr.length];
}

function filterBySchedule(quotes: Quote[]): Quote[] {
  const dow = new Date().getDay();
  const allowed = WEEKLY_SCHEDULE[dow];
  if (!allowed) return quotes;
  return quotes.filter((q) => allowed.includes(getSourceFamily(q.source)));
}

export function RandomQuote() {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    fetch('/data/quotes.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: QuoteData) => {
        if (d.quotes.length > 0) {
          const pool = filterBySchedule(d.quotes);
          setQuote(pickByDate(pool.length > 0 ? pool : d.quotes));
        }
      })
      .catch(() => {});
  }, []);

  if (!quote) return null;

  const mealColor = quote.meal ? MEAL_COLORS[quote.meal] : null;

  return (
    <Link href='/dashboard/quotes' className='block'>
      <Card className='overflow-hidden transition-shadow hover:shadow-md'>
        <CardHeader className='pb-2'>
          <div className='flex items-center gap-2'>
            {quote.meal && mealColor && (
              <Badge variant='outline' className={mealColor}>
                {quote.meal}
              </Badge>
            )}
            {quote.category === 'book' && quote.theme && (
              <Badge
                variant='outline'
                className='bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              >
                {quote.theme}
              </Badge>
            )}
            <span className='ml-auto text-[13px] text-slate-400'>每日語錄</span>
          </div>
          <CardTitle className='mt-2 text-base leading-relaxed font-normal'>
            <blockquote className='border-l-3 border-slate-300 pl-3 text-slate-800 dark:border-slate-600 dark:text-slate-200'>
              {quote.original}
            </blockquote>
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-0'>
          {quote.translation && (
            <p className='mb-2 text-[13px] leading-relaxed text-slate-500 italic dark:text-slate-400'>
              {quote.translation}
            </p>
          )}
          <p className='text-[13px] font-medium text-slate-600 dark:text-slate-400'>
            —— {quote.source}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

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

function pickRandom(arr: Quote[]): Quote {
  return arr[Math.floor(Math.random() * arr.length)];
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
        if (d.quotes.length > 0) setQuote(pickRandom(d.quotes));
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
            {quote.category === 'naval' && quote.theme && (
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

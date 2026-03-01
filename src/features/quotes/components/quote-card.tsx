'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Quote } from '../types';

const MEAL_LABELS: Record<string, { label: string; color: string }> = {
  晨讀: {
    label: '晨讀',
    color:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  },
  午學: {
    label: '午學',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  },
  夕省: {
    label: '夕省',
    color:
      'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
  }
};

export function QuoteCard({ quote }: { quote: Quote }) {
  const [expanded, setExpanded] = useState(false);
  const mealInfo = quote.meal ? MEAL_LABELS[quote.meal] : null;

  return (
    <Card className='overflow-hidden transition-shadow hover:shadow-md'>
      <CardHeader className='pb-2'>
        <div className='flex items-center gap-2'>
          {mealInfo && (
            <Badge variant='outline' className={mealInfo.color}>
              {mealInfo.label}
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
          {quote.date && (
            <span className='ml-auto text-[13px] text-slate-500'>
              {quote.date}
            </span>
          )}
        </div>
        <CardTitle className='mt-2 text-base leading-relaxed font-normal'>
          <blockquote className='border-l-3 border-slate-300 pl-3 text-slate-800 dark:border-slate-600 dark:text-slate-200'>
            {quote.original}
          </blockquote>
        </CardTitle>
      </CardHeader>

      <CardContent className='pt-0'>
        {/* Translation */}
        {quote.translation && (
          <p className='mb-2 text-[13px] leading-relaxed text-slate-500 italic dark:text-slate-400'>
            {quote.translation}
          </p>
        )}

        {/* Source */}
        <p className='text-[13px] font-medium text-slate-600 dark:text-slate-400'>
          —— {quote.source}
        </p>

        {/* Commentary (collapsible) */}
        {quote.commentary && (
          <div className='mt-3 border-t border-slate-100 pt-2 dark:border-slate-800'>
            <button
              onClick={() => setExpanded(!expanded)}
              className='text-[13px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            >
              {expanded ? '收起解讀 ▲' : '白話解讀 ▼'}
            </button>
            {expanded && (
              <p className='mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400'>
                {quote.commentary}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

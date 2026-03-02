'use client';

import { Badge } from '@/components/ui/badge';

interface Summary {
  sourceCount: number;
  totalProducts: number;
  lowestPrice: number;
  priceRange: [number, number];
}

export function ResultSummary({
  summary,
  hasUnknownAf,
  unknownLabel = '部分規格'
}: {
  summary: Summary;
  hasUnknownAf: boolean;
  unknownLabel?: string;
}) {
  return (
    <div className='mb-3 space-y-1'>
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <Badge variant='secondary'>{summary.sourceCount} 家通路</Badge>
        <Badge variant='outline'>{summary.totalProducts} 筆產品</Badge>
        <span className='font-medium text-green-600 dark:text-green-400'>
          最低 ${summary.lowestPrice.toLocaleString()}
        </span>
        {summary.priceRange[0] !== summary.priceRange[1] && (
          <span className='text-muted-foreground text-xs'>
            （${summary.priceRange[0].toLocaleString()} ~ $
            {summary.priceRange[1].toLocaleString()}）
          </span>
        )}
      </div>
      {hasUnknownAf && (
        <p className='text-muted-foreground text-xs'>
          ※ 部分通路{unknownLabel}未標示，歸入下方獨立區段
        </p>
      )}
    </div>
  );
}

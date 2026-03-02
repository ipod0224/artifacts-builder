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
  hasUnknownAf
}: {
  summary: Summary;
  hasUnknownAf: boolean;
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
          ※ 部分通路未標示框架(AF)，歸入「AF 未標示」區段
        </p>
      )}
    </div>
  );
}

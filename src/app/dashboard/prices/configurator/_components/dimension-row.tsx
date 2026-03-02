'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { sortSpecValues } from './utils';

export interface DimensionOption {
  key: string;
  label: string;
  values: string[];
  selected: string | null;
}

export function DimensionRow({
  dimension,
  onSelect,
  loading
}: {
  dimension: DimensionOption;
  onSelect: (val: string) => void;
  loading: boolean;
}) {
  const sortedValues = sortSpecValues(dimension.values);

  return (
    <div>
      <div className='mb-1.5 flex items-center gap-2'>
        <span className='text-sm font-medium'>{dimension.label}</span>
        <Badge variant='outline' className='text-[10px]'>
          {dimension.values.length}
        </Badge>
      </div>
      <div className='flex flex-wrap gap-1.5'>
        {sortedValues.map((val) => {
          const isSelected = dimension.selected === val;
          return (
            <Button
              key={val}
              variant={isSelected ? 'default' : 'outline'}
              size='sm'
              className='h-7 px-2.5 text-xs'
              disabled={loading}
              onClick={() => onSelect(val)}
            >
              {val}
            </Button>
          );
        })}
        {dimension.values.length === 0 && (
          <span className='text-muted-foreground text-xs'>
            （目前條件下無可用值）
          </span>
        )}
      </div>
    </div>
  );
}

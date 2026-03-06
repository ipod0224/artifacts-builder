'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { FilterChip } from './filter-chip';
import { sortSpecValues } from './utils';

export interface DimensionOption {
  key: string;
  label: string;
  values: string[];
  selected: string | null;
}

/** Baymard Institute: 10 values is the sweet spot before truncation */
const TRUNCATE_THRESHOLD = 10;

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
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = sortedValues.length > TRUNCATE_THRESHOLD;

  // Always show selected value even when collapsed
  const visibleValues =
    needsTruncation && !expanded
      ? sortedValues.filter(
          (val, i) => i < TRUNCATE_THRESHOLD || val === dimension.selected
        )
      : sortedValues;

  const hiddenCount = sortedValues.length - TRUNCATE_THRESHOLD;

  // If this dimension already has a selection, show it collapsed (progressive disclosure)
  const isCollapsed = dimension.selected !== null;

  return (
    <div>
      <div className='mb-1.5 flex items-center gap-2'>
        <span className='text-sm font-medium'>{dimension.label}</span>
        <Badge variant='outline' className='text-[10px]'>
          {dimension.values.length}
        </Badge>
      </div>

      {isCollapsed ? (
        /* Selected: show only the selected chip inline */
        <div className='flex flex-wrap gap-1.5'>
          <FilterChip
            label={dimension.selected!}
            selected
            disabled={loading}
            onClick={() => onSelect(dimension.selected!)}
          />
          <button
            type='button'
            onClick={() => onSelect(dimension.selected!)}
            className='text-muted-foreground hover:text-foreground min-h-11 text-xs underline-offset-2 hover:underline sm:min-h-0'
          >
            變更
          </button>
        </div>
      ) : (
        /* Unselected: show chips with optional truncation */
        <div className='flex flex-wrap gap-1.5'>
          {visibleValues.map((val) => (
            <FilterChip
              key={val}
              label={val}
              selected={dimension.selected === val}
              disabled={loading}
              onClick={() => onSelect(val)}
            />
          ))}
          {needsTruncation && !expanded && (
            <button
              type='button'
              onClick={() => setExpanded(true)}
              className='border-border text-muted-foreground hover:border-foreground hover:text-foreground inline-flex min-h-11 items-center rounded-full border border-dashed px-3 py-1 text-xs transition-colors sm:min-h-0'
            >
              +{hiddenCount} 更多
            </button>
          )}
          {dimension.values.length === 0 && (
            <span className='text-muted-foreground text-xs'>
              （目前條件下無可用值）
            </span>
          )}
        </div>
      )}
    </div>
  );
}

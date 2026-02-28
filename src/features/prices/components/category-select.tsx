'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  CATEGORY_LABELS,
  type PriceCategory
} from '@/features/prices/constants';

interface CategorySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  categories: { category: string; count: number }[];
}

export function CategorySelect({
  value,
  onValueChange,
  categories
}: CategorySelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className='w-full sm:w-[280px]'>
        <SelectValue placeholder='選擇品類' />
      </SelectTrigger>
      <SelectContent>
        {categories.map((cat) => (
          <SelectItem key={cat.category} value={cat.category}>
            {CATEGORY_LABELS[cat.category as PriceCategory] || cat.category}
            <span className='text-muted-foreground ml-2 text-xs'>
              ({cat.count})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

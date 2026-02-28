'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const CATEGORY_LABELS: Record<string, string> = {
  cable: '電纜',
  nfb: 'NFB 無熔線斷路器',
  leakagebreaker: '漏電斷路器',
  contactor: '電磁接觸器',
  transformer: '變壓器',
  'emt-conduit': 'EMT 導管',
  'emt-fitting': 'EMT 另件',
  'pvc-pipe': 'PVC 管',
  'pvc-fitting': 'PVC 另件',
  'rsg-conduit': 'RSG 導管',
  stainlesspipe: '不鏽鋼管',
  stainlessfitting: '不鏽鋼另件',
  acb: 'ACB 氣體斷路器',
  'motor-starter': '電磁開關',
  'thermal-relay': '熱動過載電驛'
};

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
            {CATEGORY_LABELS[cat.category] || cat.category}
            <span className='text-muted-foreground ml-2 text-xs'>
              ({cat.count})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

'use client';

import { Card, CardContent } from '@/components/ui/card';

interface TccInfoCardsProps {
  totalGroups: number;
  totalModels: number;
  totalPoints: number;
}

const cards = [
  {
    key: 'groups',
    label: '曲線組數',
    getValue: (p: TccInfoCardsProps) => p.totalGroups,
    sub: 'MCCB + MCB'
  },
  {
    key: 'models',
    label: '涵蓋型號',
    getValue: (p: TccInfoCardsProps) => p.totalModels,
    sub: 'BM / BL / BH / BHA 系列'
  },
  {
    key: 'points',
    label: '數據點數',
    getValue: (p: TccInfoCardsProps) => p.totalPoints.toLocaleString(),
    sub: 'Min + Max 曲線'
  },
  {
    key: 'source',
    label: '數據來源',
    getValue: () => '士林電機',
    sub: 'global.seec.com.tw'
  }
] as const;

export function TccInfoCards(props: TccInfoCardsProps) {
  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
      {cards.map((c) => (
        <Card key={c.key}>
          <CardContent className='px-4 py-3'>
            <div className='text-muted-foreground text-xs'>{c.label}</div>
            <div className='mt-1 text-xl font-bold tabular-nums'>
              {c.getValue(props)}
            </div>
            <div className='text-muted-foreground text-[10px]'>{c.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

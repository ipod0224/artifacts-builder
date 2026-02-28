'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

interface CategoryStat {
  category: string;
  count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
}

interface SourceStat {
  source: string;
  count: number;
  categories: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  cable: '電纜',
  nfb: 'NFB',
  leakagebreaker: '漏電斷路器',
  contactor: '接觸器',
  transformer: '變壓器',
  'emt-conduit': 'EMT 導管',
  'emt-fitting': 'EMT 另件',
  'pvc-pipe': 'PVC 管',
  'pvc-fitting': 'PVC 另件',
  'rsg-conduit': 'RSG 導管',
  stainlesspipe: '不鏽鋼管',
  stainlessfitting: '不鏽鋼另件',
  acb: 'ACB',
  'motor-starter': '電磁開關',
  'thermal-relay': '熱動電驛'
};

export function CoverageMatrix({
  categories,
  sources
}: {
  categories: CategoryStat[];
  sources: SourceStat[];
}) {
  if (!categories?.length || !sources?.length) {
    return null;
  }

  const allCategories = categories.map((c) => c.category);

  return (
    <Card>
      <CardHeader className='px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
        <CardTitle className='text-base sm:text-lg'>覆蓋矩陣</CardTitle>
        <CardDescription>品類 × 供應通路</CardDescription>
      </CardHeader>
      <CardContent className='px-2 pb-4 sm:px-6'>
        <div className='overflow-x-auto'>
          <table className='w-full text-xs'>
            <thead>
              <tr>
                <th className='text-muted-foreground bg-background sticky left-0 px-2 py-1.5 text-left font-medium'>
                  通路
                </th>
                {allCategories.map((cat) => (
                  <th
                    key={cat}
                    className='text-muted-foreground px-1.5 py-1.5 text-center font-medium'
                  >
                    <span className='block max-w-[4rem] truncate'>
                      {CATEGORY_LABELS[cat] || cat}
                    </span>
                  </th>
                ))}
                <th className='text-muted-foreground px-2 py-1.5 text-right font-medium'>
                  合計
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src) => (
                <tr key={src.source} className='border-t'>
                  <td className='bg-background sticky left-0 px-2 py-1.5 font-medium'>
                    {src.source}
                  </td>
                  {allCategories.map((cat) => {
                    const has = src.categories.includes(cat);
                    return (
                      <td key={cat} className='px-1.5 py-1.5 text-center'>
                        {has ? (
                          <span className='bg-primary/80 inline-block h-3 w-3 rounded-sm' />
                        ) : (
                          <span className='text-muted-foreground/30'>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className='px-2 py-1.5 text-right tabular-nums'>
                    {src.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

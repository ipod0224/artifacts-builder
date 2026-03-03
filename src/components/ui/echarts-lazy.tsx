'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { EChartContainerProps } from './echarts';

const EChartContainer = dynamic(
  () => import('./echarts').then((mod) => mod.EChartContainer),
  {
    ssr: false,
    loading: () => <Skeleton className='h-full min-h-[200px] w-full' />
  }
);

export { EChartContainer };
export type { EChartContainerProps };

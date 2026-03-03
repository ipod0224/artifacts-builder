'use client';

import { IconTrendingUp } from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { EChartContainer } from '@/components/ui/echarts-lazy';
import type { EChartsOption } from 'echarts';

const chartData = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 }
];

const option: EChartsOption = {
  grid: { left: 12, right: 12, top: 8, bottom: 24, containLabel: false },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: chartData.map((d) => d.month.slice(0, 3)),
    axisTick: { show: false },
    axisLine: { show: false }
  },
  yAxis: { type: 'value', show: false },
  tooltip: {
    trigger: 'axis',
    formatter: (params: unknown) => {
      const items = params as Array<{
        seriesName: string;
        value: number;
        marker: string;
        dataIndex: number;
      }>;
      const header = chartData[items[0]?.dataIndex ?? 0]?.month ?? '';
      const lines = items.map(
        (i) => `${i.marker} ${i.seriesName}: <b>${i.value.toLocaleString()}</b>`
      );
      return `${header}<br/>${lines.join('<br/>')}`;
    }
  },
  series: [
    {
      name: 'Mobile',
      type: 'line',
      stack: 'total',
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.4 },
      data: chartData.map((d) => d.mobile)
    },
    {
      name: 'Desktop',
      type: 'line',
      stack: 'total',
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.6 },
      data: chartData.map((d) => d.desktop)
    }
  ]
};

export function AreaGraph() {
  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Area Chart - Stacked</CardTitle>
        <CardDescription>
          Showing total visitors for the last 6 months
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <EChartContainer option={option} className='h-[250px]' />
      </CardContent>
      <CardFooter>
        <div className='flex w-full items-start gap-2 text-sm'>
          <div className='grid gap-2'>
            <div className='flex items-center gap-2 leading-none font-medium'>
              Trending up by 5.2% this month{' '}
              <IconTrendingUp className='h-4 w-4' />
            </div>
            <div className='text-muted-foreground flex items-center gap-2 leading-none'>
              January - June 2024
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

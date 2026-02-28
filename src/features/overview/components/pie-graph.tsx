'use client';

import * as React from 'react';
import { IconTrendingUp } from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { EChartContainer } from '@/components/ui/echarts';
import type { EChartsOption } from 'echarts';

const PIE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#9333ea'];

const chartData = [
  { browser: 'Chrome', visitors: 275 },
  { browser: 'Safari', visitors: 200 },
  { browser: 'Firefox', visitors: 287 },
  { browser: 'Edge', visitors: 173 },
  { browser: 'Other', visitors: 190 }
];

const totalVisitors = chartData.reduce((acc, curr) => acc + curr.visitors, 0);

export function PieGraph() {
  const option = React.useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: '{b}: <b>{c}</b> ({d}%)'
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '80%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderWidth: 2,
            borderColor: 'var(--background)'
          },
          label: {
            show: true,
            position: 'center',
            formatter: () =>
              `{total|${totalVisitors.toLocaleString()}}\n{sub|Total Visitors}`,
            rich: {
              total: { fontSize: 28, fontWeight: 'bold', lineHeight: 36 },
              sub: { fontSize: 12, lineHeight: 20 }
            }
          },
          emphasis: {
            label: { show: true }
          },
          data: chartData.map((d, i) => ({
            name: d.browser,
            value: d.visitors,
            itemStyle: { color: PIE_COLORS[i] }
          }))
        }
      ]
    }),
    []
  );

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Pie Chart - Donut with Text</CardTitle>
        <CardDescription>
          <span className='hidden @[540px]/card:block'>
            Total visitors by browser for the last 6 months
          </span>
          <span className='@[540px]/card:hidden'>Browser distribution</span>
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <EChartContainer
          option={option}
          className='mx-auto aspect-square h-[250px]'
        />
      </CardContent>
      <CardFooter className='flex-col gap-2 text-sm'>
        <div className='flex items-center gap-2 leading-none font-medium'>
          Chrome leads with{' '}
          {((chartData[0].visitors / totalVisitors) * 100).toFixed(1)}%{' '}
          <IconTrendingUp className='h-4 w-4' />
        </div>
        <div className='text-muted-foreground leading-none'>
          Based on data from January - June 2024
        </div>
      </CardFooter>
    </Card>
  );
}

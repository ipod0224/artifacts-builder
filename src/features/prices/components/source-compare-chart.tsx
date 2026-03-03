'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { EChartContainer } from '@/components/ui/echarts-lazy';
import type { EChartsOption } from 'echarts';

interface SourceData {
  source: string;
  item_count: number;
  avg_sell_price: number;
  avg_list_price: number;
  avg_discount: string;
  min_price: number;
  max_price: number;
  stddev_price: number;
}

export function SourceCompareChart({
  data,
  category
}: {
  data: SourceData[];
  category: string;
}) {
  if (!data?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-base sm:text-lg'>跨源比較</CardTitle>
          <CardDescription>選擇品類以查看比較</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const option: EChartsOption = {
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    legend: { show: true, top: 0, right: 0, textStyle: { fontSize: 11 } },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.source),
      axisTick: { alignWithLabel: true },
      axisLine: { show: false },
      axisLabel: { fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        fontSize: 10,
        formatter: (v: number) =>
          v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
      },
      splitLine: { lineStyle: { type: 'dashed' } }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string;
          value: number;
          marker: string;
          axisValue: string;
        }>;
        const header = items[0]?.axisValue ?? '';
        const lines = items.map(
          (i) =>
            `${i.marker} ${i.seriesName}: <b>$${i.value.toLocaleString()}</b>`
        );
        return `${header}<br/>${lines.join('<br/>')}`;
      }
    },
    series: [
      {
        name: '平均牌價',
        type: 'bar',
        barGap: '20%',
        barMaxWidth: 32,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#94a3b8' }, // slate-400 (牌價，較淡)
        data: data.map((d) => d.avg_list_price)
      },
      {
        name: '平均售價',
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#2563eb' }, // blue-600 (售價，主色)

        data: data.map((d) => d.avg_sell_price)
      }
    ]
  };

  return (
    <Card>
      <CardHeader className='px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
        <CardTitle className='text-base sm:text-lg'>
          跨源價格比較 — {category.toUpperCase()}
        </CardTitle>
        <CardDescription>
          {data.length} 個通路，共 {data.reduce((s, d) => s + d.item_count, 0)}{' '}
          筆
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-2 sm:px-6'>
        <EChartContainer option={option} className='h-[220px] sm:h-[280px]' />
      </CardContent>
    </Card>
  );
}

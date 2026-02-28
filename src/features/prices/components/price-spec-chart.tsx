'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { EChartContainer } from '@/components/ui/echarts';
import type { EChartsOption } from 'echarts';

const FALLBACK_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ea580c',
  '#9333ea',
  '#0891b2',
  '#ca8a04',
  '#db2777'
];

interface SpecItem {
  source: string;
  sell_price: number;
  ampere: string | null;
  size: string | null;
  spec_value: string | null;
  model: string | null;
  nominal_size: string | null;
}

/** High-contrast palette — distinguishable on white background */
const SOURCE_COLORS: Record<string, string> = {
  朝立: '#2563eb', // blue-600
  東元電機: '#dc2626', // red-600
  三菱電機: '#16a34a', // green-600
  鍾榮: '#ea580c', // orange-600
  萬蕙昇: '#9333ea', // purple-600
  銘宣: '#0891b2', // cyan-600
  信佳電機: '#ca8a04', // yellow-600
  樺晟: '#db2777', // pink-600
  茂忠: '#4f46e5', // indigo-600
  TCRI: '#64748b' // slate-500
};

function parseAmpere(ampere: string | null): number {
  if (!ampere) return 0;
  if (ampere.startsWith('[')) {
    try {
      const arr = JSON.parse(ampere) as number[];
      return arr.length > 0 ? Math.max(...arr) : 0;
    } catch {
      return 0;
    }
  }
  const num = parseFloat(ampere);
  return isNaN(num) ? 0 : num;
}

function getSpecNumeric(item: SpecItem): number {
  if (item.ampere) return parseAmpere(item.ampere);
  const key = item.size || item.spec_value || item.nominal_size || '';
  const num = parseFloat(key);
  return isNaN(num) ? 0 : num;
}

export function PriceSpecChart({
  data,
  category
}: {
  data: SpecItem[];
  category: string;
}) {
  if (!data?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-base sm:text-lg'>價格-規格曲線</CardTitle>
          <CardDescription>選擇品類以查看趨勢</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sources = Array.from(new Set(data.map((d) => d.source)));
  const sortedData = [...data]
    .filter((d) => getSpecNumeric(d) > 0)
    .sort((a, b) => getSpecNumeric(a) - getSpecNumeric(b));

  const specValues = Array.from(new Set(sortedData.map(getSpecNumeric))).sort(
    (a, b) => a - b
  );

  const specLabel =
    data[0]?.ampere != null
      ? '安培 (A)'
      : data[0]?.size != null
        ? '線徑 (mm²)'
        : '規格';

  const fallbackColors = FALLBACK_COLORS;

  const series: EChartsOption['series'] = sources.map((source, idx) => {
    const seriesData = specValues.map((spec) => {
      const items = sortedData.filter(
        (d) => d.source === source && getSpecNumeric(d) === spec
      );
      if (items.length === 0) return null;
      return Math.round(
        items.reduce((s, i) => s + i.sell_price, 0) / items.length
      );
    });

    const color =
      SOURCE_COLORS[source] || fallbackColors[idx % fallbackColors.length];

    return {
      name: source,
      type: 'line' as const,
      smooth: true,
      showSymbol: false,
      connectNulls: true,
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.12 },
      itemStyle: { color },
      data: seriesData
    };
  });

  const option: EChartsOption = {
    grid: {
      left: 8,
      right: 8,
      top: 24,
      bottom: sources.length > 1 ? 32 : 8,
      containLabel: true
    },
    legend: {
      show: sources.length > 1,
      bottom: 0,
      type: 'scroll',
      textStyle: { fontSize: 11 }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: specValues.map(String),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { fontSize: 10 }
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
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string;
          value: number | null;
          marker: string;
          axisValue: string;
        }>;
        const header = `${specLabel}: ${items[0]?.axisValue ?? ''}`;
        const lines = items
          .filter((i) => i.value != null)
          .map(
            (i) =>
              `${i.marker} ${i.seriesName}: <b>$${Number(i.value).toLocaleString()}</b>`
          );
        return `${header}<br/>${lines.join('<br/>')}`;
      }
    },
    dataZoom: undefined,
    series
  };

  return (
    <Card>
      <CardHeader className='px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
        <CardTitle className='text-base sm:text-lg'>
          價格-規格曲線 — {category.toUpperCase()}
        </CardTitle>
        <CardDescription>
          {specLabel} vs 售價，{sources.length} 個通路
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-2 sm:px-6'>
        <EChartContainer option={option} className='h-[220px] sm:h-[280px]' />
      </CardContent>
    </Card>
  );
}

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { EChartContainer } from '@/components/ui/echarts-lazy';
import type { EChartsOption } from 'echarts';
import { COMMODITIES, type HistoryResponse } from '../constants';

/** Normalize series to % change from first value (base = 0%) */
function normalizeToPercent(
  rows: { date: string; close: number }[]
): { date: string; value: number; price: number }[] {
  if (rows.length === 0) return [];
  const base = rows[0].close;
  if (base === 0)
    return rows.map((r) => ({ date: r.date, value: 0, price: r.close }));
  return rows.map((r) => ({
    date: r.date,
    value: ((r.close - base) / base) * 100,
    price: r.close
  }));
}

export function CommodityTrendChart({
  histories
}: {
  histories: HistoryResponse[];
}) {
  if (histories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-base sm:text-lg'>價格走勢</CardTitle>
          <CardDescription>載入中...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Collect all unique dates
  const allDates = Array.from(
    new Set(histories.flatMap((h) => h.rows.map((r) => r.date)))
  ).sort();

  // Build lookup: symbol → date → { value, price }
  const symbolLookup = new Map<
    string,
    Map<string, { value: number; price: number }>
  >();
  for (const h of histories) {
    const normalized = normalizeToPercent(h.rows);
    const dateMap = new Map(
      normalized.map((r) => [r.date, { value: r.value, price: r.price }])
    );
    symbolLookup.set(h.symbol, dateMap);
  }

  const series: EChartsOption['series'] = histories.map((h) => {
    const meta = COMMODITIES.find((c) => c.symbol === h.symbol);
    const dateMap = symbolLookup.get(h.symbol);

    // Use [date, value] tuple pairs — only include dates that have data
    // This prevents null gaps from causing broken lines
    const data = allDates
      .map((d) => {
        const entry = dateMap?.get(d);
        return entry ? [d, entry.value] : null;
      })
      .filter((item): item is [string, number] => item !== null);

    return {
      name: meta?.name || h.symbol,
      type: 'line' as const,
      smooth: true,
      showSymbol: false,
      connectNulls: true,
      lineStyle: {
        width: h.symbol === 'WPU066' ? 2.5 : 1.8,
        type: h.symbol === 'WPU066' ? 'dashed' : 'solid'
      },
      itemStyle: { color: meta?.color || '#888' },
      emphasis: {
        lineStyle: { width: 3 }
      },
      data
    };
  });

  const isLongRange = allDates.length > 365;

  const option: EChartsOption = {
    grid: {
      left: 8,
      right: 8,
      top: 40,
      bottom: 64,
      containLabel: true
    },
    legend: {
      bottom: 28,
      type: 'scroll',
      textStyle: { fontSize: 11 },
      pageIconSize: 10
    },
    xAxis: {
      type: 'time',
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        fontSize: 10,
        formatter: isLongRange ? '{yyyy}-{MM}' : '{MM}-{dd}'
      }
    },
    yAxis: {
      type: 'value',
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        fontSize: 10,
        formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`
      },
      splitLine: { lineStyle: { type: 'dashed', opacity: 0.5 } }
    },
    tooltip: {
      trigger: 'axis',
      order: 'valueDesc',
      confine: true,
      textStyle: { fontSize: 12 },
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string;
          value: [string, number];
          marker: string;
        }>;
        if (!items?.length) return '';
        const date = items[0]?.value?.[0] ?? '';
        const lines = items
          .filter((i) => i.value?.[1] != null)
          .map((i) => {
            const pct = i.value[1];
            // Find the actual price from lookup
            const symbol = histories.find((h) => {
              const meta = COMMODITIES.find((c) => c.symbol === h.symbol);
              return (meta?.name || h.symbol) === i.seriesName;
            })?.symbol;
            const dateMap = symbol ? symbolLookup.get(symbol) : undefined;
            const priceData = dateMap?.get(date);
            const priceStr = priceData
              ? ` <span style="color:#555;font-size:11px">(${priceData.price >= 100 ? priceData.price.toLocaleString(undefined, { maximumFractionDigits: 0 }) : priceData.price.toFixed(2)})</span>`
              : '';
            return `${i.marker} ${i.seriesName}: <b>${pct > 0 ? '+' : ''}${pct.toFixed(2)}%</b>${priceStr}`;
          });
        return `<b>${date}</b><br/>${lines.join('<br/>')}`;
      }
    },
    dataZoom: [
      {
        type: 'slider',
        bottom: 0,
        height: 22,
        borderColor: 'transparent',
        fillerColor: 'rgba(100,100,100,0.08)',
        handleSize: '60%'
      },
      {
        type: 'inside',
        zoomOnMouseWheel: true,
        moveOnMouseMove: true
      }
    ],
    series
  };

  return (
    <Card>
      <CardHeader className='px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
        <CardTitle className='text-base sm:text-lg'>
          價格走勢（相對變化 %）
        </CardTitle>
        <CardDescription>
          以期間首日為基準，tooltip 顯示漲跌% + 實際價格。滑鼠滾輪可縮放
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-2 sm:px-6'>
        <EChartContainer option={option} className='h-[300px] sm:h-[400px]' />
      </CardContent>
    </Card>
  );
}

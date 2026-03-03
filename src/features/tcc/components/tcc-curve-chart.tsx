'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { EChartContainer } from '@/components/ui/echarts';
import type { EChartsOption } from 'echarts';
import { type TccGroup, GROUP_COLORS, GROUP_LABELS } from '../constants';

function formatTime(s: number): string {
  if (s >= 3600) return `${(s / 3600).toFixed(1)}h`;
  if (s >= 60) return `${(s / 60).toFixed(1)}min`;
  if (s >= 1) return `${s.toFixed(1)}s`;
  return `${(s * 1000).toFixed(0)}ms`;
}

interface TccCurveChartProps {
  selectedGroups: { key: string; group: TccGroup }[];
}

export function TccCurveChart({ selectedGroups }: TccCurveChartProps) {
  if (selectedGroups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-base sm:text-lg'>
            TCC 曲線（Log-Log）
          </CardTitle>
          <CardDescription>選擇左側斷路器型號以顯示曲線</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const series: NonNullable<EChartsOption['series']> = selectedGroups.flatMap(
    ({ key, group }, idx) => {
      const color = GROUP_COLORS[idx % GROUP_COLORS.length];
      const label = GROUP_LABELS[key] || key;

      return [
        {
          name: `${label} Max`,
          type: 'line' as const,
          data: group.max_curve.map((p) => [p.current_pct, p.time_s]),
          lineStyle: { width: 1.5, type: 'dashed' as const, color },
          itemStyle: { color },
          areaStyle: { color, opacity: 0.1 },
          showSymbol: false,
          smooth: false,
          z: idx * 2
        },
        {
          name: `${label} Min`,
          type: 'line' as const,
          data: group.min_curve.map((p) => [p.current_pct, p.time_s]),
          lineStyle: { width: 2, color },
          itemStyle: { color },
          showSymbol: false,
          smooth: false,
          z: idx * 2 + 1
        }
      ];
    }
  );

  const option: EChartsOption = {
    grid: {
      left: 60,
      right: 20,
      top: 40,
      bottom: selectedGroups.length > 1 ? 60 : 40,
      containLabel: false
    },
    legend: {
      show: selectedGroups.length > 1,
      bottom: 0,
      type: 'scroll',
      textStyle: { fontSize: 11 }
    },
    xAxis: {
      type: 'log',
      name: '電流 (% In)',
      nameLocation: 'middle',
      nameGap: 25,
      min: 100,
      max: 5000,
      axisLabel: {
        formatter: (v: number) => `${v}%`
      },
      splitLine: { lineStyle: { type: 'dashed' as const } }
    },
    yAxis: {
      type: 'log',
      name: '時間',
      nameLocation: 'middle',
      nameGap: 45,
      min: 0.008,
      max: 20000,
      inverse: true,
      axisLabel: {
        formatter: (v: number) => formatTime(v)
      },
      splitLine: { lineStyle: { type: 'dashed' as const } }
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'inside', yAxisIndex: 0 }
    ],
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as {
          seriesName?: string;
          value?: [number, number];
          marker?: string;
        };
        if (!p?.value) return '';
        return `${p.marker ?? ''} ${p.seriesName ?? ''}<br/>${p.value[0].toFixed(0)}% In → ${formatTime(p.value[1])}`;
      }
    },
    series
  };

  return (
    <Card>
      <CardHeader className='px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
        <CardTitle className='text-base sm:text-lg'>
          TCC 曲線（Log-Log）
        </CardTitle>
        <CardDescription>
          {selectedGroups.length} 組 — Min/Max 帶狀區域，滾輪縮放
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-2 sm:px-6'>
        <EChartContainer option={option} className='h-[400px] sm:h-[500px]' />
      </CardContent>
    </Card>
  );
}

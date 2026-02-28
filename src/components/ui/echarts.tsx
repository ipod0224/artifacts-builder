'use client';

import * as React from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import {
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  GaugeChart,
  HeatmapChart
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption, SetOptionOpts } from 'echarts';

import { cn } from '@/lib/utils';
import { buildEChartsTheme } from '@/lib/echarts-theme';

// Register only the components we use (tree-shaking)
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  GaugeChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapComponent,
  CanvasRenderer
]);

// ------------------------------------------------------------------
// EChartContainer
// ------------------------------------------------------------------

interface EChartContainerProps {
  option: EChartsOption;
  className?: string;
  style?: React.CSSProperties;
  loading?: boolean;
  opts?: SetOptionOpts;
  onEvents?: Record<string, (params: unknown) => void>;
}

/**
 * Themed ECharts container that auto-syncs with Shadcn CSS variables.
 *
 * Usage:
 * ```tsx
 * <EChartContainer option={myOption} className="h-[400px]" />
 * ```
 */
function EChartContainer({
  option,
  className,
  style,
  loading = false,
  opts,
  onEvents
}: EChartContainerProps) {
  const chartRef = React.useRef<ReactEChartsCore>(null);

  // Rebuild theme when dark mode or data-theme changes
  const mergedOption = React.useMemo<EChartsOption>(() => {
    const theme = buildEChartsTheme();
    return {
      ...theme,
      ...option,
      tooltip: { ...theme.tooltip, ...(option.tooltip as object) }
    };
  }, [option]);

  // Observe theme changes (data-theme attribute + dark class)
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      chartRef.current?.getEchartsInstance()?.setOption(mergedOption, true);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class']
    });
    return () => observer.disconnect();
  }, [mergedOption]);

  return (
    <div className={cn('w-full', className)} style={style}>
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={mergedOption}
        notMerge
        lazyUpdate
        showLoading={loading}
        opts={{ renderer: 'canvas' }}
        style={{ height: '100%', width: '100%' }}
        onEvents={onEvents}
        {...(opts ? { setOptionOpts: opts } : {})}
      />
    </div>
  );
}

export { EChartContainer, echarts };
export type { EChartContainerProps, EChartsOption };

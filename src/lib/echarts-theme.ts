/**
 * ECharts theme adapter
 * Reads CSS variables (--chart-1~5, --background, --foreground, etc.)
 * and builds an ECharts theme object that stays in sync with the active Shadcn theme.
 */

/** Read a CSS variable from the document root (falls back to empty string on SSR). */
function getCSSVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** Build a fresh ECharts theme object from current CSS variables. */
export function buildEChartsTheme() {
  const chart1 = getCSSVar('--chart-1');
  const chart2 = getCSSVar('--chart-2');
  const chart3 = getCSSVar('--chart-3');
  const chart4 = getCSSVar('--chart-4');
  const chart5 = getCSSVar('--chart-5');
  const fg = getCSSVar('--foreground');
  const mutedFg = getCSSVar('--muted-foreground');
  const border = getCSSVar('--border');
  const bg = getCSSVar('--background');

  return {
    color: [chart1, chart2, chart3, chart4, chart5],

    backgroundColor: 'transparent',

    textStyle: {
      color: fg,
      fontFamily: getCSSVar('--font-sans') || 'system-ui, sans-serif',
      fontSize: 12
    },

    title: {
      textStyle: { color: fg },
      subtextStyle: { color: mutedFg }
    },

    legend: {
      textStyle: { color: mutedFg }
    },

    tooltip: {
      backgroundColor: bg,
      borderColor: border,
      textStyle: { color: fg, fontSize: 12 },
      extraCssText: 'border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.12);'
    },

    axisPointer: {
      lineStyle: { color: border },
      crossStyle: { color: border }
    },

    categoryAxis: {
      axisLine: { lineStyle: { color: border } },
      axisTick: { lineStyle: { color: border } },
      axisLabel: { color: mutedFg },
      splitLine: { lineStyle: { color: border, type: 'dashed' as const } }
    },

    valueAxis: {
      axisLine: { lineStyle: { color: border } },
      axisTick: { lineStyle: { color: border } },
      axisLabel: { color: mutedFg },
      splitLine: { lineStyle: { color: border, type: 'dashed' as const } }
    }

    /** dataZoom is NOT included by default to avoid capturing scroll events.
     *  Use `buildDataZoomOption()` when a chart explicitly needs zoom. */
  };
}

/** Build dataZoom config. Call this only when a chart explicitly needs zoom. */
export function buildDataZoomOption() {
  const chart1 = getCSSVar('--chart-1');
  const mutedFg = getCSSVar('--muted-foreground');
  const border = getCSSVar('--border');

  return [
    { type: 'inside' as const, textStyle: { color: mutedFg } },
    {
      type: 'slider' as const,
      textStyle: { color: mutedFg },
      borderColor: border,
      fillerColor: `${chart1}33`,
      handleStyle: { color: chart1, borderColor: chart1 },
      dataBackground: {
        lineStyle: { color: border },
        areaStyle: { color: `${chart1}1a` }
      }
    }
  ];
}

/** ECharts-ready colour palette extracted from CSS variables. */
export function getChartColors(): string[] {
  return [
    getCSSVar('--chart-1'),
    getCSSVar('--chart-2'),
    getCSSVar('--chart-3'),
    getCSSVar('--chart-4'),
    getCSSVar('--chart-5')
  ];
}

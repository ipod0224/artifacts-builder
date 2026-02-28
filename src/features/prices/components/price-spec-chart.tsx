'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

interface SpecItem {
  source: string;
  sell_price: number;
  ampere: string | null;
  size: string | null;
  spec_value: string | null;
  model: string | null;
  nominal_size: string | null;
}

const SOURCE_COLORS: Record<string, string> = {
  朝立: 'hsl(var(--chart-1))',
  東元電機: 'hsl(var(--chart-2))',
  三菱電機: 'hsl(var(--chart-3))',
  鍾榮: 'hsl(var(--chart-4))',
  萬蕙昇: 'hsl(var(--chart-5))',
  銘宣: 'hsl(220, 70%, 55%)',
  信佳電機: 'hsl(30, 80%, 55%)',
  樺晟: 'hsl(160, 60%, 45%)'
};

function parseAmpere(ampere: string | null): number {
  if (!ampere) return 0;
  // Handle JSON arrays like "[3, 5, 10, 15, 20, 30]" — use max value (frame AF)
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

function getSpecKey(item: SpecItem): string {
  if (item.ampere) return String(parseAmpere(item.ampere));
  return item.size || item.spec_value || item.nominal_size || '';
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

  // Group by source, sort by spec numeric value
  const sources = Array.from(new Set(data.map((d) => d.source)));
  const sortedData = [...data]
    .filter((d) => getSpecNumeric(d) > 0)
    .sort((a, b) => getSpecNumeric(a) - getSpecNumeric(b));

  // Build chart data: each point has spec as x-axis, price per source as y-axis
  const specValues = Array.from(new Set(sortedData.map(getSpecNumeric))).sort(
    (a, b) => a - b
  );
  const chartData = specValues.map((spec) => {
    const point: Record<string, number | string> = {
      spec: spec.toString()
    };
    for (const source of sources) {
      const items = sortedData.filter(
        (d) => d.source === source && getSpecNumeric(d) === spec
      );
      if (items.length > 0) {
        const avg = Math.round(
          items.reduce((s, i) => s + i.sell_price, 0) / items.length
        );
        point[source] = avg;
      }
    }
    return point;
  });

  const specLabel =
    data[0]?.ampere != null
      ? '安培 (A)'
      : data[0]?.size != null
        ? '線徑 (mm²)'
        : '規格';

  const chartConfig = sources.reduce(
    (acc, source) => {
      acc[source] = {
        label: source,
        color: SOURCE_COLORS[source] || 'hsl(var(--primary))'
      };
      return acc;
    },
    {} as Record<string, { label: string; color: string }>
  ) satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className='px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
        <CardTitle className='text-base sm:text-lg'>
          價格-規格曲線 — {category}
        </CardTitle>
        <CardDescription>
          {specLabel} vs 售價，{sources.length} 個通路
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-2 sm:px-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[220px] w-full sm:h-[280px]'
        >
          <AreaChart
            data={chartData}
            margin={{ left: 4, right: 4, top: 8, bottom: 4 }}
          >
            <defs>
              {sources.map((source) => (
                <linearGradient
                  key={source}
                  id={`fill-${source}`}
                  x1='0'
                  y1='0'
                  x2='0'
                  y2='1'
                >
                  <stop
                    offset='5%'
                    stopColor={`var(--color-${source})`}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset='95%'
                    stopColor={`var(--color-${source})`}
                    stopOpacity={0.05}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='spec'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              fontSize={10}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              fontSize={10}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
              }
              width={40}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name) =>
                    `${name}: $${Number(value).toLocaleString()}`
                  }
                />
              }
            />
            {sources.map((source) => (
              <Area
                key={source}
                dataKey={source}
                type='monotone'
                fill={`url(#fill-${source})`}
                stroke={`var(--color-${source})`}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

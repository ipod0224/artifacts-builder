'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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

const chartConfig = {
  avg_sell_price: {
    label: '平均售價',
    color: 'var(--primary)'
  },
  avg_list_price: {
    label: '平均牌價',
    color: 'hsl(var(--chart-2))'
  }
} satisfies ChartConfig;

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

  const chartData = data.map((d) => ({
    source: d.source,
    avg_sell_price: d.avg_sell_price,
    avg_list_price: d.avg_list_price,
    item_count: d.item_count,
    discount: d.avg_discount
  }));

  return (
    <Card>
      <CardHeader className='px-4 pt-4 pb-2 sm:px-6 sm:pt-6'>
        <CardTitle className='text-base sm:text-lg'>
          跨源價格比較 — {category}
        </CardTitle>
        <CardDescription>
          {data.length} 個通路，共 {data.reduce((s, d) => s + d.item_count, 0)}{' '}
          筆
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-2 sm:px-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[220px] w-full sm:h-[280px]'
        >
          <BarChart
            data={chartData}
            margin={{ left: 4, right: 4, top: 8, bottom: 4 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='source'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
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
                  formatter={(value, name) => {
                    const label =
                      name === 'avg_sell_price' ? '平均售價' : '平均牌價';
                    return `${label}: $${Number(value).toLocaleString()}`;
                  }}
                />
              }
            />
            <Bar
              dataKey='avg_list_price'
              fill='var(--color-avg_list_price)'
              radius={[4, 4, 0, 0]}
              barSize={24}
            />
            <Bar
              dataKey='avg_sell_price'
              fill='var(--color-avg_sell_price)'
              radius={[4, 4, 0, 0]}
              barSize={24}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

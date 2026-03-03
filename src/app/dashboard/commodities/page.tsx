'use client';

import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { CommodityKpiCards } from '@/features/commodities/components/commodity-kpi-cards';
import { CommodityTrendChart } from '@/features/commodities/components/commodity-trend-chart';
import { CommodityChangeTable } from '@/features/commodities/components/commodity-change-table';
import { PERIOD_OPTIONS } from '@/features/commodities/constants';
import {
  useCommodityLatest,
  useCommodityChanges,
  useCommodityHistories
} from '@/features/commodities/hooks/use-commodity-queries';

export default function CommoditiesPage() {
  const [period, setPeriod] = useState('180');

  const {
    data: latest = [],
    isLoading,
    error: latestError
  } = useCommodityLatest();
  const { data: changes = [], error: changesError } = useCommodityChanges();
  const { histories, error: historyError } = useCommodityHistories(period);

  const error = latestError || changesError || historyError;

  if (isLoading) {
    return (
      <div className='flex h-[50vh] items-center justify-center'>
        <div className='text-muted-foreground text-sm'>載入大宗商品數據...</div>
      </div>
    );
  }

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      {/* Header */}
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          原物料指數
        </h2>
        <p className='text-muted-foreground text-xs sm:text-sm'>
          銅 / 鋁 / 鋼期貨 + PVC 樹脂 PPI — 電纜材料成本追蹤
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400'>
          {error instanceof Error ? error.message : '載入資料失敗'}
        </div>
      )}

      {/* KPI Cards */}
      <CommodityKpiCards latest={latest} changes={changes} />

      <Separator />

      {/* Period Selector + Chart */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <span className='text-sm font-medium'>時間區間</span>
        <div className='flex gap-1.5'>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                period === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <CommodityTrendChart histories={histories} />

      {/* Change Table */}
      <CommodityChangeTable changes={changes} />
    </div>
  );
}

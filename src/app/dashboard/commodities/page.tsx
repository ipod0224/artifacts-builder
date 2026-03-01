'use client';

import { useCallback, useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { CommodityKpiCards } from '@/features/commodities/components/commodity-kpi-cards';
import { CommodityTrendChart } from '@/features/commodities/components/commodity-trend-chart';
import { CommodityChangeTable } from '@/features/commodities/components/commodity-change-table';
import {
  COMMODITIES,
  PERIOD_OPTIONS,
  type LatestPrice,
  type PriceChange,
  type HistoryResponse
} from '@/features/commodities/constants';

export default function CommoditiesPage() {
  const [latest, setLatest] = useState<LatestPrice[]>([]);
  const [changes, setChanges] = useState<PriceChange[]>([]);
  const [histories, setHistories] = useState<HistoryResponse[]>([]);
  const [period, setPeriod] = useState('180');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch latest + changes on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/commodities/latest').then((r) => r.json()),
      fetch('/api/commodities/changes').then((r) => r.json())
    ])
      .then(([latestRes, changesRes]) => {
        if (latestRes.success) setLatest(latestRes.data);
        if (changesRes.success) setChanges(changesRes.data);
      })
      .catch(() => setError('無法連線到大宗商品 API'))
      .finally(() => setLoading(false));
  }, []);

  // Fetch history when period changes
  const fetchHistory = useCallback((days: string) => {
    // Use start_date instead of limit — ensures all commodities
    // (daily + monthly) share the same calendar time range
    const start = new Date();
    start.setDate(start.getDate() - parseInt(days));
    const startDate = start.toISOString().slice(0, 10);

    const promises = COMMODITIES.map((c) =>
      fetch(
        `/api/commodities/history?symbol=${encodeURIComponent(c.symbol)}&start_date=${startDate}&limit=2000`
      )
        .then((r) => r.json())
        .then((r) => (r.success ? r.data : null))
    );
    Promise.all(promises)
      .then((results) =>
        setHistories(results.filter((r): r is HistoryResponse => r !== null))
      )
      .catch(() => setError('載入歷史資料失敗'));
  }, []);

  useEffect(() => {
    fetchHistory(period);
  }, [period, fetchHistory]);

  if (loading) {
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
          {error}
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

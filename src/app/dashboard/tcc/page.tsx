'use client';

import { useCallback, useEffect, useState } from 'react';
import { TccCurveChart } from '@/features/tcc/components/tcc-curve-chart';
import { TccModelSelector } from '@/features/tcc/components/tcc-model-selector';
import { TccInfoCards } from '@/features/tcc/components/tcc-info-cards';
import {
  type TccData,
  type TccApiResponse,
  MAX_OVERLAY
} from '@/features/tcc/constants';

export default function TccPage() {
  const [groups, setGroups] = useState<TccData>({});
  const [meta, setMeta] = useState({
    totalGroups: 0,
    totalModels: 0,
    totalPoints: 0
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tcc')
      .then((r) => r.json())
      .then((r: TccApiResponse) => {
        if (r.success && r.data) {
          setGroups(r.data.groups);
          setMeta(r.data.meta);
          // Default: select first MCCB group
          const firstKey = Object.keys(r.data.groups)[0];
          if (firstKey) setSelected([firstKey]);
        } else {
          setError('無法載入 TCC 數據');
        }
      })
      .catch(() => setError('無法連線到 TCC API'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = useCallback((key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      if (prev.length >= MAX_OVERLAY) return prev;
      return [...prev, key];
    });
  }, []);

  const selectedGroups = selected
    .map((key) => {
      const group = groups[key];
      return group ? { key, group } : null;
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  if (loading) {
    return (
      <div className='flex h-[50vh] items-center justify-center'>
        <div className='text-muted-foreground text-sm'>載入 TCC 數據...</div>
      </div>
    );
  }

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      {/* Header */}
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          TCC 曲線
        </h2>
        <p className='text-muted-foreground text-xs sm:text-sm'>
          士林電機 MCCB/MCB 時間-電流特性曲線（取代 ETAP 簡易保護協調）
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400'>
          {error}
        </div>
      )}

      {/* Info Cards */}
      <TccInfoCards
        totalGroups={meta.totalGroups}
        totalModels={meta.totalModels}
        totalPoints={meta.totalPoints}
      />

      {/* Main Content: Selector + Chart */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]'>
        <TccModelSelector
          groups={groups}
          selected={selected}
          onToggle={handleToggle}
        />
        <TccCurveChart selectedGroups={selectedGroups} />
      </div>
    </div>
  );
}

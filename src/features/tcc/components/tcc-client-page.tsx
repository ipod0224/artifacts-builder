'use client';

import { useCallback, useState } from 'react';
import { TccCurveChart } from './tcc-curve-chart';
import { TccModelSelector } from './tcc-model-selector';
import { TccInfoCards } from './tcc-info-cards';
import { type TccData, MAX_OVERLAY } from '../constants';

interface TccClientPageProps {
  groups: TccData;
  meta: {
    totalGroups: number;
    totalModels: number;
    totalPoints: number;
  };
}

export function TccClientPage({ groups, meta }: TccClientPageProps) {
  const [selected, setSelected] = useState<string[]>(() => {
    const firstKey = Object.keys(groups)[0];
    return firstKey ? [firstKey] : [];
  });

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

  return (
    <>
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
    </>
  );
}

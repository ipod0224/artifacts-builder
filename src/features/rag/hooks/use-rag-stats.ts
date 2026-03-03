'use client';

import { useState, useEffect } from 'react';
import type { Material, RagStats } from '../types';

interface RagStatsState {
  stats: RagStats;
  materials: Material[];
  isConnected: boolean;
  error: string | null;
}

export function useRagStats() {
  const [state, setState] = useState<RagStatsState>({
    stats: { documents: 0, materials: 0, qaRules: 0 },
    materials: [],
    isConnected: false,
    error: null
  });

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/rag/stats');
        if (!response.ok) throw new Error('無法取得統計資料');

        const result = await response.json();
        setState({
          stats: {
            documents: result.stats.documents || 0,
            materials: result.stats.materials || 0,
            qaRules: result.stats.qaRules || 0
          },
          materials: result.materials || [],
          isConnected: true,
          error: null
        });
      } catch {
        setState((prev) => ({
          ...prev,
          error: '無法連接資料庫，請確認 PostgreSQL 服務已啟動',
          isConnected: false
        }));
      }
    }
    loadData();
  }, []);

  return state;
}

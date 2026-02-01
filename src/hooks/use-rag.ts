'use client';

/**
 * RAG Hook - 封裝 Zustand store 的便利 Hook
 */

import { useEffect } from 'react';
import { useRagStore } from '@/stores/rag-store';

/**
 * 使用 RAG 資料並自動訂閱 Realtime
 * @param category 可選的分類過濾（regulations/technical/knowledge/business/communication/data/general）
 */
export function useRag(category?: string) {
  const store = useRagStore();

  // 自動訂閱 Realtime
  useEffect(() => {
    const unsubscribe = store.subscribe();

    // 初始載入資料
    store.fetchDocuments(category);

    return () => {
      unsubscribe();
    };
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // 狀態
    documents: store.documents,
    searchResults: store.searchResults,
    isLoading: store.isLoading,
    isSubscribed: store.isSubscribed,
    error: store.error,
    lastQuery: store.lastQuery,

    // Actions
    search: store.searchDocuments,
    refresh: (cat?: string) => store.fetchDocuments(cat || category),
    reset: store.reset
  };
}

/**
 * 僅使用搜尋功能（不訂閱 Realtime）
 */
export function useRagSearch() {
  const { searchDocuments, searchResults, isLoading, error, lastQuery } =
    useRagStore();

  return {
    search: searchDocuments,
    results: searchResults,
    isLoading,
    error,
    lastQuery
  };
}

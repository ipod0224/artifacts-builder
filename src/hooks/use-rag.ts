'use client';

/**
 * RAG Hook - 封裝 Zustand store 的便利 Hook
 */

import { useEffect } from 'react';
import { useRagStore } from '@/stores/rag-store';

/**
 * 使用 RAG 資料並自動訂閱 Realtime
 */
export function useRag() {
  const store = useRagStore();

  // 自動訂閱 Realtime
  useEffect(() => {
    const unsubscribe = store.subscribe();

    // 初始載入資料
    store.fetchDocuments();
    store.fetchRegulations();

    return () => {
      unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // 狀態
    documents: store.documents,
    regulations: store.regulations,
    searchResults: store.searchResults,
    isLoading: store.isLoading,
    isSubscribed: store.isSubscribed,
    error: store.error,
    lastQuery: store.lastQuery,

    // Actions
    search: store.searchDocuments,
    refresh: () => {
      store.fetchDocuments();
      store.fetchRegulations();
    },
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

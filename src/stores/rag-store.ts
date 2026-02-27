/**
 * RAG Store - Zustand + API Routes
 *
 * 直連 PostgreSQL（透過 Next.js API routes）
 */

import { create } from 'zustand';
import type { Document } from '@/lib/db';

interface RagState {
  // 狀態
  documents: Document[];
  isLoading: boolean;
  error: string | null;

  // 查詢結果
  searchResults: Document[];
  lastQuery: string | null;

  // Actions
  fetchDocuments: (category?: string) => Promise<void>;
  searchDocuments: (query: string, limit?: number) => Promise<void>;
  reset: () => void;
}

export const useRagStore = create<RagState>((set) => ({
  // 初始狀態
  documents: [],
  isLoading: false,
  error: null,
  searchResults: [],
  lastQuery: null,

  // 載入文件（可選 category 過濾）
  fetchDocuments: async (category?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);

      const response = await fetch(`/api/rag/documents?${params}`);
      if (!response.ok) throw new Error('載入文件失敗');

      const { data } = await response.json();
      set({ documents: data || [], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // 向量搜尋
  searchDocuments: async (query: string, limit = 5) => {
    set({ isLoading: true, error: null, lastQuery: query });
    try {
      const response = await fetch('/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, match_count: limit })
      });

      if (!response.ok) throw new Error('搜尋失敗');

      const { data } = await response.json();
      set({ searchResults: data || [], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // 重置狀態
  reset: () => {
    set({
      documents: [],
      searchResults: [],
      isLoading: false,
      error: null,
      lastQuery: null
    });
  }
}));

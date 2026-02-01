/**
 * RAG Store - Zustand + Supabase Realtime
 *
 * 解決 React 狀態閉包問題的正確模式
 * 參考: https://medium.com/@ozergklp/how-to-use-zustand-with-supabase-and-next-js-app-router
 */

import { create } from 'zustand';
import { supabase, Document } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RagState {
  // 狀態
  documents: Document[];
  isLoading: boolean;
  isSubscribed: boolean;
  error: string | null;

  // 查詢結果
  searchResults: Document[];
  lastQuery: string | null;

  // Actions
  fetchDocuments: (category?: string) => Promise<void>;
  searchDocuments: (query: string, limit?: number) => Promise<void>;
  subscribe: () => () => void;
  reset: () => void;
}

// 保存 channel 引用，避免重複訂閱
let documentChannel: RealtimeChannel | null = null;

export const useRagStore = create<RagState>((set, get) => ({
  // 初始狀態
  documents: [],
  isLoading: false,
  isSubscribed: false,
  error: null,
  searchResults: [],
  lastQuery: null,

  // 載入文件（可選 category 過濾）
  fetchDocuments: async (category?: string) => {
    set({ isLoading: true, error: null });
    try {
      let query = supabase
        .from('documents')
        .select('id, content, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      // 如果有指定 category，用 metadata 過濾
      if (category) {
        query = query.filter('metadata->>category', 'eq', category);
      }

      const { data, error } = await query;

      if (error) throw error;
      set({ documents: data || [], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // 向量搜尋
  searchDocuments: async (query: string, limit = 5) => {
    set({ isLoading: true, error: null, lastQuery: query });
    try {
      // 呼叫後端 API 進行向量搜尋
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

  // Realtime 訂閱
  subscribe: () => {
    const state = get();
    if (state.isSubscribed) {
      return () => {}; // 已訂閱，返回空 cleanup
    }

    // 訂閱 documents 表
    documentChannel = supabase
      .channel('documents-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        (payload) => {
          // ✅ 使用 set() 直接更新，避免閉包問題
          set((state) => {
            switch (payload.eventType) {
              case 'INSERT':
                return {
                  documents: [payload.new as Document, ...state.documents]
                };
              case 'UPDATE':
                return {
                  documents: state.documents.map((doc) =>
                    doc.id === (payload.new as Document).id
                      ? (payload.new as Document)
                      : doc
                  )
                };
              case 'DELETE':
                return {
                  documents: state.documents.filter(
                    (doc) => doc.id !== (payload.old as Document).id
                  )
                };
              default:
                return state;
            }
          });
        }
      )
      .subscribe();

    set({ isSubscribed: true });

    // 返回 cleanup 函數
    return () => {
      documentChannel?.unsubscribe();
      documentChannel = null;
      set({ isSubscribed: false });
    };
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

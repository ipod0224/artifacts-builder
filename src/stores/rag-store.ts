/**
 * RAG Store - Zustand + Supabase Realtime
 *
 * 解決 React 狀態閉包問題的正確模式
 * 參考: https://medium.com/@ozergklp/how-to-use-zustand-with-supabase-and-next-js-app-router
 */

import { create } from 'zustand';
import { supabase, Document, Regulation } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RagState {
  // 狀態
  documents: Document[];
  regulations: Regulation[];
  isLoading: boolean;
  isSubscribed: boolean;
  error: string | null;

  // 查詢結果
  searchResults: Document[];
  lastQuery: string | null;

  // Actions
  fetchDocuments: () => Promise<void>;
  fetchRegulations: () => Promise<void>;
  searchDocuments: (query: string, limit?: number) => Promise<void>;
  subscribe: () => () => void;
  reset: () => void;
}

// 保存 channel 引用，避免重複訂閱
let documentChannel: RealtimeChannel | null = null;
let regulationChannel: RealtimeChannel | null = null;

export const useRagStore = create<RagState>((set, get) => ({
  // 初始狀態
  documents: [],
  regulations: [],
  isLoading: false,
  isSubscribed: false,
  error: null,
  searchResults: [],
  lastQuery: null,

  // 載入文件
  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, content, source, chunk_idx, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      set({ documents: data || [], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // 載入法規
  fetchRegulations: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('regulations')
        .select('id, content, source, article_no, chunk_idx, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      set({ regulations: data || [], isLoading: false });
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
        body: JSON.stringify({ query, limit })
      });

      if (!response.ok) throw new Error('搜尋失敗');

      const { results } = await response.json();
      set({ searchResults: results, isLoading: false });
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

    // 訂閱 regulations 表
    regulationChannel = supabase
      .channel('regulations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'regulations' },
        (payload) => {
          set((state) => {
            switch (payload.eventType) {
              case 'INSERT':
                return {
                  regulations: [payload.new as Regulation, ...state.regulations]
                };
              case 'UPDATE':
                return {
                  regulations: state.regulations.map((reg) =>
                    reg.id === (payload.new as Regulation).id
                      ? (payload.new as Regulation)
                      : reg
                  )
                };
              case 'DELETE':
                return {
                  regulations: state.regulations.filter(
                    (reg) => reg.id !== (payload.old as Regulation).id
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
      regulationChannel?.unsubscribe();
      documentChannel = null;
      regulationChannel = null;
      set({ isSubscribed: false });
    };
  },

  // 重置狀態
  reset: () => {
    set({
      documents: [],
      regulations: [],
      searchResults: [],
      isLoading: false,
      error: null,
      lastQuery: null
    });
  }
}));

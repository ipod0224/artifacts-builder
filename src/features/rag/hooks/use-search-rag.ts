'use client';

import { useState, useCallback, useRef } from 'react';
import type {
  SearchResult,
  MaterialMatch,
  AnswerSource,
  MatchedRule
} from '../types';

interface SearchState {
  query: string;
  isSearching: boolean;
  results: SearchResult[];
  answer: string;
  answerSource: AnswerSource;
  answerConfidence: number;
  matchedRule: MatchedRule | null;
  materialMatches: MaterialMatch[];
  error: string | null;
}

const INITIAL_STATE: SearchState = {
  query: '',
  isSearching: false,
  results: [],
  answer: '',
  answerSource: null,
  answerConfidence: 0,
  matchedRule: null,
  materialMatches: [],
  error: null
};

export function useSearchRag() {
  const [state, setState] = useState<SearchState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const setQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, query }));
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmed = state.query.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({
      ...prev,
      isSearching: true,
      error: null,
      results: [],
      materialMatches: [],
      answer: '',
      answerSource: null,
      answerConfidence: 0,
      matchedRule: null
    }));

    try {
      const response = await fetch('/api/rag/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
        signal: controller.signal
      });

      const result = await response.json();

      // Stale response guard: ignore if a newer request has been issued
      if (controller !== abortRef.current) return;

      if (!response.ok) {
        throw new Error(result.error || '搜尋失敗');
      }

      setState((prev) => ({
        ...prev,
        answer: result.answer || '未找到相關結果，請嘗試其他關鍵字。',
        answerSource: result.source || null,
        answerConfidence: result.confidence || 0,
        matchedRule: result.matchedRule || null,
        materialMatches:
          result.materials && result.materials.length > 0
            ? result.materials
            : [],
        isSearching: false
      }));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : '搜尋失敗';
      setState((prev) => ({
        ...prev,
        error: `搜尋失敗：${message}`,
        isSearching: false
      }));
    }
  }, [state.query]);

  return { ...state, setQuery, handleSearch };
}

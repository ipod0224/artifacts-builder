'use client';

import { useState, useCallback } from 'react';
import type { SearchResult, SaveMessage } from '../types';

interface EditState {
  editingItem: SearchResult | null;
  editContent: string;
  isSaving: boolean;
  saveMessage: SaveMessage | null;
}

const INITIAL_STATE: EditState = {
  editingItem: null,
  editContent: '',
  isSaving: false,
  saveMessage: null
};

export function useEditDocument(
  onUpdateResult: (id: string, content: string) => void
) {
  const [state, setState] = useState<EditState>(INITIAL_STATE);

  const handleEdit = useCallback((item: SearchResult) => {
    setState({
      editingItem: item,
      editContent: item.content,
      isSaving: false,
      saveMessage: null
    });
  }, []);

  const handleCloseEdit = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const setEditContent = useCallback((content: string) => {
    setState((prev) => ({ ...prev, editContent: content }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!state.editingItem || !state.editContent.trim()) return;

    setState((prev) => ({ ...prev, isSaving: true, saveMessage: null }));

    try {
      const response = await fetch('/api/rag/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: state.editingItem.id,
          content: state.editContent,
          regenerate_embedding: true
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '儲存失敗');
      }

      onUpdateResult(state.editingItem.id, state.editContent);

      setState((prev) => ({
        ...prev,
        isSaving: false,
        saveMessage: {
          type: 'success',
          text: '儲存成功！已重新生成 embedding 向量。'
        }
      }));

      setTimeout(() => {
        setState(INITIAL_STATE);
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : '儲存失敗';
      setState((prev) => ({
        ...prev,
        isSaving: false,
        saveMessage: { type: 'error', text: message }
      }));
    }
  }, [state.editingItem, state.editContent, onUpdateResult]);

  return {
    ...state,
    handleEdit,
    handleCloseEdit,
    setEditContent,
    handleSave
  };
}

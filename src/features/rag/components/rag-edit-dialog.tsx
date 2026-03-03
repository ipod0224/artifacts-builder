'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  IconPencil,
  IconCheck,
  IconX,
  IconLoader2,
  IconAlertCircle
} from '@tabler/icons-react';
import type { SearchResult, SaveMessage } from '../types';

interface RagEditDialogProps {
  editingItem: SearchResult | null;
  editContent: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  saveMessage: SaveMessage | null;
}

export function RagEditDialog({
  editingItem,
  editContent,
  onContentChange,
  onSave,
  onClose,
  isSaving,
  saveMessage
}: RagEditDialogProps) {
  return (
    <Dialog open={!!editingItem} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='flex max-h-[80vh] max-w-3xl flex-col overflow-hidden'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <IconPencil className='size-5' />
            編輯知識庫內容
          </DialogTitle>
          <DialogDescription>
            修改後會自動重新生成 embedding 向量以確保搜尋準確性
          </DialogDescription>
        </DialogHeader>

        {editingItem && (
          <div className='flex-1 space-y-4 overflow-auto'>
            <div className='flex items-center gap-2'>
              <Badge variant='secondary'>{editingItem.source}</Badge>
              {editingItem.doc_type && (
                <Badge variant='outline'>{editingItem.doc_type}</Badge>
              )}
            </div>

            <Textarea
              value={editContent}
              onChange={(e) => onContentChange(e.target.value)}
              className='min-h-[300px] font-mono text-sm'
              placeholder='輸入內容...'
            />

            {saveMessage && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 ${
                  saveMessage.type === 'success'
                    ? 'border border-green-200 bg-green-50 text-green-700'
                    : 'border border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {saveMessage.type === 'success' ? (
                  <IconCheck className='size-4' />
                ) : (
                  <IconAlertCircle className='size-4' />
                )}
                {saveMessage.text}
              </div>
            )}
          </div>
        )}

        <DialogFooter className='gap-2'>
          <Button variant='outline' onClick={onClose} disabled={isSaving}>
            <IconX className='mr-1 size-4' />
            取消
          </Button>
          <Button onClick={onSave} disabled={isSaving || !editContent.trim()}>
            {isSaving ? (
              <IconLoader2 className='mr-1 size-4 animate-spin' />
            ) : (
              <IconCheck className='mr-1 size-4' />
            )}
            儲存並更新向量
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

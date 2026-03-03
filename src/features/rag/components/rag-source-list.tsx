'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconFileText, IconPencil, IconAlertCircle } from '@tabler/icons-react';
import { ConfidenceBadge } from './confidence-badge';
import type { SearchResult } from '../types';

interface RagSourceListProps {
  results: SearchResult[];
  onEdit: (item: SearchResult) => void;
}

export function RagSourceList({ results, onEdit }: RagSourceListProps) {
  if (results.length === 0) return null;

  return (
    <>
      {/* Low confidence warning */}
      {results[0].similarity < 0.55 && (
        <Card className='border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'>
          <CardContent className='flex items-start gap-3 pt-4'>
            <IconAlertCircle className='mt-0.5 size-5 text-amber-600' />
            <div>
              <p className='font-medium text-amber-800 dark:text-amber-200'>
                搜尋結果相關度較低
              </p>
              <p className='mt-1 text-sm text-amber-700 dark:text-amber-300'>
                未找到高度匹配的結果。建議嘗試更具體的材料名稱或規格描述（如「PVC
                IV 2.0mm²」）。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconFileText className='size-5' />
            來源引用
          </CardTitle>
          <CardDescription>
            相關度由高到低排序，點擊編輯按鈕可修改內容
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {results.map((result) => (
              <div
                key={result.id}
                className='hover:bg-muted/50 rounded-lg border p-4 transition-colors'
              >
                <div className='mb-2 flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <Badge variant='secondary'>{result.source}</Badge>
                    {result.doc_type && (
                      <Badge variant='outline'>{result.doc_type}</Badge>
                    )}
                    {result.category && (
                      <Badge variant='outline' className='text-xs'>
                        {result.category}
                      </Badge>
                    )}
                  </div>
                  <div className='flex items-center gap-2'>
                    <ConfidenceBadge score={result.similarity} />
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => onEdit(result)}
                      className='h-8 w-8 p-0'
                    >
                      <IconPencil className='size-4' />
                    </Button>
                  </div>
                </div>
                <p className='text-muted-foreground line-clamp-3 text-sm whitespace-pre-wrap'>
                  {result.content}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

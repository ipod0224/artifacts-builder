'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconSearch, IconLoader2 } from '@tabler/icons-react';
import { EXAMPLE_QUERIES } from '../constants';

interface RagSearchCardProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  isConnected: boolean;
}

export function RagSearchCard({
  query,
  onQueryChange,
  onSearch,
  isSearching,
  isConnected
}: RagSearchCardProps) {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <IconSearch className='size-5' />
          語意搜尋
        </CardTitle>
        <CardDescription>
          直接輸入問題，系統會自動從萬筆規則、材料資料庫和知識庫中找出最佳答案
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex gap-4'>
          <Input
            placeholder='輸入任何關於水電材料、價格、規格的問題...'
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            className='flex-1'
            disabled={!isConnected}
          />
          <Button onClick={onSearch} disabled={isSearching || !isConnected}>
            {isSearching ? (
              <IconLoader2 className='size-4 animate-spin' />
            ) : (
              <IconSearch className='size-4' />
            )}
            搜尋
          </Button>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-muted-foreground text-xs'>試試看：</span>
          {EXAMPLE_QUERIES.map((eq) => (
            <button
              key={eq.label}
              onClick={() => onQueryChange(eq.label)}
              className='bg-muted text-muted-foreground hover:bg-accent rounded-full px-2.5 py-1 text-xs transition-colors'
            >
              {eq.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState, useEffect } from 'react';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  IconSearch,
  IconDatabase,
  IconFileText,
  IconBolt,
  IconLoader2,
  IconAlertCircle,
  IconPencil,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';

interface SearchResult {
  id: string;
  content: string;
  source: string;
  similarity: number;
  article_no?: string;
  chunk_idx?: number;
  doc_type?: string;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  price: number;
  spec?: string;
}

export default function RAGPage() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stats, setStats] = useState({ regulations: 0, materials: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // 編輯狀態
  const [editingItem, setEditingItem] = useState<SearchResult | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // 載入統計和材料資料
  useEffect(() => {
    async function loadData() {
      try {
        const [regResult, matResult] = await Promise.all([
          supabase
            .from('regulations')
            .select('id', { count: 'exact', head: true }),
          supabase.from('materials').select('*').limit(10)
        ]);

        if (regResult.error) throw regResult.error;
        if (matResult.error) throw matResult.error;

        setStats({
          regulations: regResult.count || 0,
          materials: matResult.data?.length || 0
        });
        setMaterials(matResult.data || []);
        setIsConnected(true);
        setError(null);
      } catch (err) {
        setError('無法連接 Supabase，請確認服務已啟動');
        setIsConnected(false);
      }
    }
    loadData();
  }, []);

  // 向量搜尋
  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);
    setAnswer('');

    try {
      const response = await fetch('/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          match_count: 5,
          match_threshold: 0.0
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '搜尋失敗');
      }

      if (result.data && result.data.length > 0) {
        const formattedResults: SearchResult[] = result.data.map(
          (item: any) => ({
            id: item.id,
            content: item.content,
            source: item.source || '法規資料庫',
            similarity: item.similarity || 0,
            article_no: item.article_no,
            chunk_idx: item.chunk_idx,
            doc_type: item.doc_type
          })
        );

        setResults(formattedResults);

        const topResult = formattedResults[0];
        setAnswer(
          `根據搜尋結果，${topResult.content}\n\n（來源：${topResult.source}${topResult.article_no ? ` ${topResult.article_no}` : ''}，相似度 ${(topResult.similarity * 100).toFixed(0)}%）`
        );
      } else {
        setAnswer('未找到相關結果，請嘗試其他關鍵字。');
      }
    } catch (err) {
      console.error('搜尋錯誤:', err);
      const message = err instanceof Error ? err.message : '搜尋失敗';
      setError(
        `搜尋失敗：${message}。請確認 Ollama 已啟動且 bge-m3 模型已安裝。`
      );
    } finally {
      setIsSearching(false);
    }
  };

  // 開啟編輯對話框
  const handleEdit = (item: SearchResult) => {
    setEditingItem(item);
    setEditContent(item.content);
    setSaveMessage(null);
  };

  // 關閉編輯對話框
  const handleCloseEdit = () => {
    setEditingItem(null);
    setEditContent('');
    setSaveMessage(null);
  };

  // 儲存編輯
  const handleSave = async () => {
    if (!editingItem || !editContent.trim()) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/rag/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          content: editContent,
          regenerate_embedding: true
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '儲存失敗');
      }

      // 更新本地狀態
      setResults((prev) =>
        prev.map((r) =>
          r.id === editingItem.id ? { ...r, content: editContent } : r
        )
      );

      // 如果是第一筆結果，也更新 answer
      if (results[0]?.id === editingItem.id) {
        setAnswer(
          `根據搜尋結果，${editContent}\n\n（來源：${editingItem.source}${editingItem.article_no ? ` ${editingItem.article_no}` : ''}，相似度 ${(editingItem.similarity * 100).toFixed(0)}%）`
        );
      }

      setSaveMessage({
        type: 'success',
        text: '儲存成功！已重新生成 embedding 向量。'
      });

      // 2 秒後關閉對話框
      setTimeout(() => {
        handleCloseEdit();
      }, 1500);
    } catch (err) {
      console.error('儲存錯誤:', err);
      const message = err instanceof Error ? err.message : '儲存失敗';
      setSaveMessage({ type: 'error', text: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        {/* 標題 */}
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              RAG 知識庫搜尋
            </h2>
            <p className='text-muted-foreground'>搜尋電氣法規與材料資料</p>
          </div>
          <Badge
            variant={isConnected ? 'outline' : 'destructive'}
            className='gap-1'
          >
            <IconDatabase className='size-3' />
            {isConnected ? 'Supabase 已連線' : 'Supabase 未連線'}
          </Badge>
        </div>

        {/* 錯誤提示 */}
        {error && (
          <Card className='border-destructive bg-destructive/10'>
            <CardContent className='flex items-center gap-2 pt-4'>
              <IconAlertCircle className='text-destructive size-5' />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        {/* 統計卡片 */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>法規 Chunks</CardDescription>
              <CardTitle className='text-2xl'>{stats.regulations}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>材料項目</CardDescription>
              <CardTitle className='text-2xl'>{stats.materials}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>向量維度</CardDescription>
              <CardTitle className='text-2xl'>1024</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Embedding 模型</CardDescription>
              <CardTitle className='text-lg'>bge-m3</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* 搜尋區 */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <IconSearch className='size-5' />
              語意搜尋
            </CardTitle>
            <CardDescription>
              輸入問題，系統將從法規與材料庫中搜尋相關內容
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex gap-4'>
              <Input
                placeholder='例如：2.0mm² 電線的安培容量是多少？'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className='flex-1'
                disabled={!isConnected}
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !isConnected}
              >
                {isSearching ? (
                  <IconLoader2 className='size-4 animate-spin' />
                ) : (
                  <IconSearch className='size-4' />
                )}
                搜尋
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 回答區 */}
        {answer && (
          <Card className='border-primary/50 bg-primary/5'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <IconBolt className='text-primary size-5' />
                搜尋結果
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-base leading-relaxed whitespace-pre-wrap'>
                {answer}
              </p>
            </CardContent>
            <CardFooter className='text-muted-foreground text-sm'>
              基於 {results.length} 個相關來源
            </CardFooter>
          </Card>
        )}

        {/* 來源引用 */}
        {results.length > 0 && (
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
                      </div>
                      <div className='flex items-center gap-2'>
                        <Badge
                          variant={
                            result.similarity > 0.7 ? 'default' : 'secondary'
                          }
                        >
                          相似度 {(result.similarity * 100).toFixed(0)}%
                        </Badge>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleEdit(result)}
                          className='h-8 w-8 p-0'
                        >
                          <IconPencil className='size-4' />
                        </Button>
                      </div>
                    </div>
                    <p className='text-sm whitespace-pre-wrap'>
                      {result.content}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 材料表格 */}
        {materials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>材料資料</CardTitle>
              <CardDescription>來自 Supabase 的真實資料</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>材料名稱</TableHead>
                    <TableHead>規格</TableHead>
                    <TableHead>單位</TableHead>
                    <TableHead className='text-right'>單價</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className='font-medium'>
                        {material.name}
                      </TableCell>
                      <TableCell>{material.spec || '-'}</TableCell>
                      <TableCell>{material.unit}</TableCell>
                      <TableCell className='text-right'>
                        ${material.price}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 編輯對話框 */}
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => !open && handleCloseEdit()}
      >
        <DialogContent className='flex max-h-[80vh] max-w-3xl flex-col overflow-hidden'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <IconPencil className='size-5' />
              編輯法規內容
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
                onChange={(e) => setEditContent(e.target.value)}
                className='min-h-[300px] font-mono text-sm'
                placeholder='輸入法規內容...'
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
            <Button
              variant='outline'
              onClick={handleCloseEdit}
              disabled={isSaving}
            >
              <IconX className='mr-1 size-4' />
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !editContent.trim()}
            >
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
    </PageContainer>
  );
}

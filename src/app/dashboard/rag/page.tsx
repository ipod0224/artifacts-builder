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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
interface SearchResult {
  id: string;
  content: string;
  source: string;
  similarity: number;
  chunk_idx?: number;
  doc_type?: string;
  category?: string;
}

type ConfidenceLevel = 'high' | 'medium' | 'low';

function getConfidenceLevel(similarity: number): ConfidenceLevel {
  if (similarity >= 0.75) return 'high';
  if (similarity >= 0.6) return 'medium';
  return 'low';
}

const confidenceConfig: Record<
  ConfidenceLevel,
  { color: string; label: string }
> = {
  high: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: '高度相關'
  },
  medium: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: '中度相關'
  },
  low: {
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    label: '低度相關'
  }
};

function ConfidenceBadge({ score }: { score: number }) {
  const level = getConfidenceLevel(score);
  const { color, label } = confidenceConfig[level];
  const pct = (score * 100).toFixed(0);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      <span
        className={`inline-block size-2 rounded-full ${
          level === 'high'
            ? 'bg-green-500'
            : level === 'medium'
              ? 'bg-blue-500'
              : 'bg-amber-500'
        }`}
      />
      {pct}% {label}
    </span>
  );
}

interface Material {
  id: string;
  name: string;
  unit: string;
  price: number;
  spec?: string;
}

interface MaterialMatch {
  code: string;
  name: string;
  spec: string;
  unit: string;
  unit_price: number;
  category?: string;
}

type AnswerSource = 'rule' | 'rule+materials' | 'llm' | null;

const sourceConfig: Record<string, { color: string; label: string }> = {
  rule: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: '規則匹配'
  },
  'rule+materials': {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: '規則+材料'
  },
  llm: {
    color:
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    label: 'AI 合成'
  }
};

function SourceBadge({
  source,
  confidence
}: {
  source: AnswerSource;
  confidence: number;
}) {
  if (!source) return null;
  const { color, label } = sourceConfig[source];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {label}
      <span className='opacity-60'>({(confidence * 100).toFixed(0)}%)</span>
    </span>
  );
}

export default function RAGPage() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState('');
  const [answerSource, setAnswerSource] = useState<AnswerSource>(null);
  const [answerConfidence, setAnswerConfidence] = useState(0);
  const [matchedRule, setMatchedRule] = useState<{
    ruleId: number;
    type: string;
    subtype: string | null;
    score: number;
  } | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stats, setStats] = useState({
    documents: 0,
    materials: 0,
    qaRules: 0
  });
  const [materialMatches, setMaterialMatches] = useState<MaterialMatch[]>([]);
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
        const response = await fetch('/api/rag/stats');
        if (!response.ok) throw new Error('無法取得統計資料');

        const result = await response.json();
        setStats({
          documents: result.stats.documents || 0,
          materials: result.stats.materials || 0,
          qaRules: result.stats.qaRules || 0
        });
        setMaterials(result.materials || []);
        setIsConnected(true);
        setError(null);
      } catch (err) {
        setError('無法連接資料庫，請確認 PostgreSQL 服務已啟動');
        setIsConnected(false);
      }
    }
    loadData();
  }, []);

  // 對答搜尋（規則優先 + LLM fallback）
  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);
    setMaterialMatches([]);
    setAnswer('');
    setAnswerSource(null);
    setAnswerConfidence(0);
    setMatchedRule(null);

    try {
      const response = await fetch('/api/rag/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '搜尋失敗');
      }

      // 設定回答和來源
      setAnswer(result.answer || '');
      setAnswerSource(result.source || null);
      setAnswerConfidence(result.confidence || 0);
      setMatchedRule(result.matchedRule || null);

      // 設定材料結果
      if (result.materials && result.materials.length > 0) {
        setMaterialMatches(result.materials);
      }

      if (!result.answer) {
        setAnswer('未找到相關結果，請嘗試其他關鍵字。');
      }
    } catch (err) {
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
            <p className='text-muted-foreground'>搜尋知識庫與材料資料</p>
          </div>
          <Badge
            variant={isConnected ? 'outline' : 'destructive'}
            className='gap-1'
          >
            <IconDatabase className='size-3' />
            {isConnected ? 'PostgreSQL 已連線' : 'PostgreSQL 未連線'}
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
        <div className='grid grid-cols-1 gap-4 md:grid-cols-5'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>對答規則</CardDescription>
              <CardTitle className='text-2xl'>
                {stats.qaRules.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>知識庫 Chunks</CardDescription>
              <CardTitle className='text-2xl'>{stats.documents}</CardTitle>
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
              輸入問題，系統將從知識庫中搜尋相關內容
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

        {/* Materials 精確匹配結果（優先顯示） */}
        {materialMatches.length > 0 && (
          <Card className='border-green-200 dark:border-green-800'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <IconDatabase className='size-5 text-green-600' />
                材料匹配結果
              </CardTitle>
              <CardDescription>
                從材料資料庫精確匹配到 {materialMatches.length} 筆資料
              </CardDescription>
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
                  {materialMatches.map((m) => (
                    <TableRow key={m.code}>
                      <TableCell className='font-medium'>{m.name}</TableCell>
                      <TableCell>{m.spec}</TableCell>
                      <TableCell>{m.unit}</TableCell>
                      <TableCell className='text-right'>
                        {m.unit_price != null ? `$${m.unit_price}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 回答區 */}
        {answer && (
          <Card
            className={
              answerSource === 'llm'
                ? 'border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20'
                : 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
            }
          >
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <IconBolt
                  className={
                    answerSource === 'llm'
                      ? 'size-5 text-purple-600'
                      : 'size-5 text-green-600'
                  }
                />
                {answerSource === 'llm' ? 'AI 合成回答' : '規則匹配回答'}
                <SourceBadge
                  source={answerSource}
                  confidence={answerConfidence}
                />
              </CardTitle>
              {matchedRule && (
                <CardDescription>
                  Rule #{matchedRule.ruleId} [{matchedRule.type}
                  {matchedRule.subtype ? `/${matchedRule.subtype}` : ''}]
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className='prose prose-sm dark:prose-invert max-w-none'>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {answer}
              </ReactMarkdown>
            </CardContent>
            <CardFooter className='text-muted-foreground text-sm'>
              {answerSource === 'llm'
                ? `AI 合成 | ${materialMatches.length} 筆材料 + ${results.length} 個知識庫來源`
                : `規則直接匹配 | 延遲 ~${matchedRule ? Math.round(matchedRule.score * 100) : 0}ms`}
            </CardFooter>
          </Card>
        )}

        {/* 低信心度警告 */}
        {results.length > 0 && results[0].similarity < 0.55 && (
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
                          onClick={() => handleEdit(result)}
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
        )}

        {/* 材料表格 */}
        {materials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>材料資料</CardTitle>
              <CardDescription>來自 PostgreSQL 的真實資料</CardDescription>
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
                onChange={(e) => setEditContent(e.target.value)}
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

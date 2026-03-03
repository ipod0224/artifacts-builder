'use client';

import { useCallback } from 'react';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { IconDatabase, IconAlertCircle } from '@tabler/icons-react';
import { useRagStats } from '@/features/rag/hooks/use-rag-stats';
import { useSearchRag } from '@/features/rag/hooks/use-search-rag';
import { useEditDocument } from '@/features/rag/hooks/use-edit-document';
import { RagSearchCard } from '@/features/rag/components/rag-search-card';
import { RagGuideCard } from '@/features/rag/components/rag-guide-card';
import { RagStatsBar } from '@/features/rag/components/rag-stats-bar';
import { RagAnswerCard } from '@/features/rag/components/rag-answer-card';
import { RagMaterialMatches } from '@/features/rag/components/rag-material-matches';
import { RagSourceList } from '@/features/rag/components/rag-source-list';
import { RagMaterialsTable } from '@/features/rag/components/rag-materials-table';
import { RagEditDialog } from '@/features/rag/components/rag-edit-dialog';

export default function RAGPage() {
  const { stats, materials, isConnected, error: statsError } = useRagStats();
  const search = useSearchRag();

  const handleUpdateResult = useCallback(() => {
    if (search.query.trim()) {
      search.handleSearch();
    }
  }, [search.query, search.handleSearch]);
  const edit = useEditDocument(handleUpdateResult);

  const error = search.error || statsError;

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              RAG 知識庫搜尋
            </h2>
            <p className='text-muted-foreground'>
              用自然語言查詢材料價格、技術規格、工法工率與判斷規則
            </p>
          </div>
          <Badge
            variant={isConnected ? 'outline' : 'destructive'}
            className='gap-1'
          >
            <IconDatabase className='size-3' />
            {isConnected ? 'PostgreSQL 已連線' : 'PostgreSQL 未連線'}
          </Badge>
        </div>

        <RagSearchCard
          query={search.query}
          onQueryChange={search.setQuery}
          onSearch={search.handleSearch}
          isSearching={search.isSearching}
          isConnected={isConnected}
        />

        <RagGuideCard />

        {error && (
          <Card className='border-destructive bg-destructive/10'>
            <CardContent className='flex items-center gap-2 pt-4'>
              <IconAlertCircle className='text-destructive size-5' />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        <RagStatsBar stats={stats} />

        <RagMaterialMatches matches={search.materialMatches} />

        <RagAnswerCard
          answer={search.answer}
          source={search.answerSource}
          confidence={search.answerConfidence}
          matchedRule={search.matchedRule}
          materialCount={search.materialMatches.length}
          sourceCount={search.results.length}
        />

        <RagSourceList results={search.results} onEdit={edit.handleEdit} />

        <RagMaterialsTable materials={materials} />
      </div>

      <RagEditDialog
        editingItem={edit.editingItem}
        editContent={edit.editContent}
        onContentChange={edit.setEditContent}
        onSave={edit.handleSave}
        onClose={edit.handleCloseEdit}
        isSaving={edit.isSaving}
        saveMessage={edit.saveMessage}
      />
    </PageContainer>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL_NAME = 'bge-m3';

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      input: [text],
      keep_alive: '5m'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama embedding 失敗: ${errorText}`);
  }

  const result = await response.json();

  if (result.embeddings && result.embeddings.length > 0) {
    return result.embeddings[0];
  } else if (result.embedding) {
    return result.embedding;
  }

  throw new Error('Ollama 返回格式異常');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, match_count = 5, match_threshold = 0, category } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: '缺少查詢參數' }, { status: 400 });
    }

    const embedding = await generateEmbedding(query);
    const embeddingStr = '[' + embedding.join(',') + ']';

    const data = await sql`
      SELECT id, content, metadata,
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM documents
      WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${match_threshold}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${match_count}
    `;

    // content_type 到 category 的映射（向後相容舊資料）
    const contentTypeToCategory: Record<string, string> = {
      contract: 'regulations',
      'engineering-rfq': 'regulations',
      'technical-doc': 'technical',
      code: 'technical',
      'knowledge-base': 'knowledge',
      academic: 'knowledge',
      report: 'business',
      'news-article': 'business',
      conversation: 'communication',
      'structured-data': 'data',
      mixed: 'general'
    };

    // content_type 到中文 doc_type 的映射
    const contentTypeToDocType: Record<string, string> = {
      conversation: '對話記錄',
      'technical-doc': '技術文件',
      report: '報告',
      contract: '合約',
      'knowledge-base': '知識庫',
      'news-article': '新聞',
      academic: '學術論文',
      'structured-data': '結構化資料',
      code: '程式碼',
      'engineering-rfq': '工程報價',
      mixed: '混合內容'
    };

    const formattedData = (data || []).map((item: any) => {
      const metadata = item.metadata || {};
      const contentType = metadata.content_type || 'knowledge-base';

      return {
        id: item.id,
        content: item.content,
        similarity: item.similarity,
        source: metadata.source || '知識庫',
        doc_type:
          metadata.doc_type || contentTypeToDocType[contentType] || '知識庫',
        chunk_idx: metadata.chunk_index,
        category:
          metadata.category || contentTypeToCategory[contentType] || 'general'
      };
    });

    const filteredData = category
      ? formattedData.filter((item: any) => item.category === category)
      : formattedData;

    return NextResponse.json({
      success: true,
      data: filteredData,
      query,
      embedding_dimension: embedding.length
    });
  } catch (err) {
    console.error('搜尋 API 錯誤:', err);
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

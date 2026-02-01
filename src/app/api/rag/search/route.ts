import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL_NAME = 'bge-m3';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
// Supabase CLI 本地開發預設 anon key（非敏感資料）
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

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

    // 生成 embedding 向量
    const embedding = await generateEmbedding(query);

    // 格式化為 PostgreSQL vector 格式
    const embeddingStr = '[' + embedding.join(',') + ']';

    // 使用 match_documents RPC 函數搜尋 documents 表
    const rpcBody: Record<string, unknown> = {
      query_embedding: embeddingStr,
      match_threshold: Number(match_threshold),
      match_count: Number(match_count)
    };

    const rpcUrl = `${supabaseUrl}/rest/v1/rpc/match_documents`;
    const rpcHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };

    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify(rpcBody)
    });

    const responseText = await rpcResponse.text();

    if (!rpcResponse.ok) {
      console.error('Supabase RPC 錯誤:', responseText);
      return NextResponse.json(
        { error: `資料庫搜尋失敗: ${responseText}` },
        { status: 500 }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON response',
        raw: responseText.substring(0, 500)
      });
    }

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

    // 轉換結果格式，從 metadata 提取資訊（向後相容舊資料）
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

    // 如果有 category 過濾
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

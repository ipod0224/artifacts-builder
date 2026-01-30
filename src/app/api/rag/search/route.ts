import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL_NAME = 'bge-m3';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { query, match_count = 5, match_threshold = 0.0, doc_type } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: '缺少查詢參數' }, { status: 400 });
    }

    // 生成 embedding 向量
    const embedding = await generateEmbedding(query);

    // 格式化為 PostgreSQL vector 格式
    const embeddingStr = `[${embedding.join(',')}]`;

    // 呼叫 Supabase RPC
    const params: Record<string, unknown> = {
      query_embedding: embeddingStr,
      match_threshold,
      match_count
    };

    if (doc_type) {
      params.filter_doc_type = doc_type;
    }

    const { data, error } = await supabase.rpc('search_regulations', params);

    if (error) {
      console.error('Supabase RPC 錯誤:', error);
      return NextResponse.json(
        { error: `資料庫搜尋失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      query,
      embedding_dimension: embedding.length
    });
  } catch (err) {
    console.error('搜尋 API 錯誤:', err);
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

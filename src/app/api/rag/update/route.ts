import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

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
    throw new Error(`Ollama embedding 失敗`);
  }

  const result = await response.json();
  return result.embeddings?.[0] || result.embedding;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, content, regenerate_embedding = true } = body;

    if (!id || !content) {
      return NextResponse.json(
        { error: '缺少必要參數 (id, content)' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { content };

    // 重新生成 embedding（因為內容改變了）
    if (regenerate_embedding) {
      const embedding = await generateEmbedding(content);
      updateData.embedding = `[${embedding.join(',')}]`;
    }

    const { data, error } = await supabase
      .from('regulations')
      .update(updateData)
      .eq('id', id)
      .select('id, source, content, doc_type')
      .single();

    if (error) {
      console.error('更新失敗:', error);
      return NextResponse.json(
        { error: `更新失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      embedding_regenerated: regenerate_embedding
    });
  } catch (err) {
    console.error('API 錯誤:', err);
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

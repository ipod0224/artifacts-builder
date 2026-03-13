import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireWriteAuth } from '@/lib/api-auth';

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
    }),
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding 失敗`);
  }

  const result = await response.json();
  return result.embeddings?.[0] || result.embedding;
}

export async function POST(request: NextRequest) {
  const authError = requireWriteAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, content, regenerate_embedding = true } = body;

    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json(
        { error: 'id 必須是有效的 UUID' },
        { status: 400 }
      );
    }
    if (!content || typeof content !== 'string' || content.length > 100_000) {
      return NextResponse.json(
        { error: 'content 必須為 1~100000 字元的字串' },
        { status: 400 }
      );
    }

    let data;

    if (regenerate_embedding) {
      const embedding = await generateEmbedding(content);
      const embeddingStr = '[' + embedding.join(',') + ']';

      const rows = await sql`
        UPDATE documents
        SET content = ${content}, embedding = ${embeddingStr}::vector
        WHERE id = ${id}
        RETURNING id, content, metadata
      `;
      data = rows[0];
    } else {
      // 內容變更但不重新生成 embedding → 清空 embedding 避免向量搜尋返回過時結果
      const rows = await sql`
        UPDATE documents
        SET content = ${content}, embedding = NULL
        WHERE id = ${id}
        RETURNING id, content, metadata
      `;
      data = rows[0];
    }

    if (!data) {
      return NextResponse.json(
        { error: `找不到 id=${id} 的文件` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      embedding_regenerated: regenerate_embedding
    });
  } catch (err) {
    console.error('[RAG update]', err);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

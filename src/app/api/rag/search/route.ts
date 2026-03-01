import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import aliasData from '../aliases.json';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL_NAME = 'bge-m3';

// --- P0: 同義詞展開 ---

const synonymMap = aliasData.synonyms as Record<string, string[]>;

function expandQueryWithSynonyms(query: string): string[] {
  const expanded = new Set<string>();

  // 完全匹配
  if (synonymMap[query]) {
    synonymMap[query].forEach((s) => expanded.add(s));
  }

  // 子字串匹配：查詢中包含 synonym key
  for (const [key, values] of Object.entries(synonymMap)) {
    if (key.length >= 2 && query.includes(key)) {
      values.forEach((s) => expanded.add(s));
    }
  }

  return Array.from(expanded);
}

// --- P1: 智慧分詞 ---

function tokenizeQuery(query: string): string[] {
  // 先按空白和標點分割
  const raw = query
    .replace(/[，。、！？：；（）()]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const tokens: string[] = [];
  for (const token of raw) {
    // 分離中文和英數+符號段（例如 "5.5mm²電線" → ["5.5mm²", "電線"]）
    const parts = token.match(
      /[\u4e00-\u9fff\u3400-\u4dbf]+|[^\u4e00-\u9fff\u3400-\u4dbf]+/g
    );
    if (parts && parts.length > 1) {
      tokens.push(...parts.map((p) => p.trim()).filter(Boolean));
    } else {
      tokens.push(token);
    }
  }

  // 過濾停用詞和太短的 token
  const stopWords = new Set([
    '要',
    '的',
    '多少',
    '錢',
    '一個',
    '幾個',
    '我',
    '你',
    '是',
    '有',
    '在',
    '了',
    '嗎',
    '呢',
    '什麼',
    '怎麼',
    '用',
    '到',
    '哪',
    '和',
    '跟',
    '給',
    '讓',
    '把',
    '被',
    '從',
    '裡',
    '上',
    '下',
    '中',
    '個',
    '台',
    '支',
    '條',
    '組',
    '套',
    '式'
  ]);

  return tokens.filter((t) => t.length >= 1 && !stopWords.has(t));
}

// --- Embedding ---

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

// --- 材料搜尋三層 pipeline ---

interface MaterialRow {
  code: string;
  name: string;
  spec: string;
  unit: string;
  unit_price: number | null;
  category: string;
  similarity?: number;
}

/** Layer 1: 原始 ILIKE */
async function searchByILIKE(query: string): Promise<MaterialRow[]> {
  const rows = await sql`
    SELECT code, name, spec, unit, unit_price, category
    FROM materials
    WHERE name ILIKE ${'%' + query + '%'}
       OR spec ILIKE ${'%' + query + '%'}
       OR code ILIKE ${'%' + query + '%'}
    ORDER BY
      CASE WHEN name ILIKE ${query} THEN 0
           WHEN name ILIKE ${query + '%'} THEN 1
           WHEN name ILIKE ${'%' + query + '%'} THEN 2
           ELSE 3 END,
      name, spec
    LIMIT 20
  `;
  return rows as unknown as MaterialRow[];
}

/** Layer 2: 同義詞展開搜尋（單一 OR 查詢，解決 N+1） */
async function searchBySynonyms(
  expandedTerms: string[]
): Promise<MaterialRow[]> {
  if (expandedTerms.length === 0) return [];

  // 建構 ILIKE 條件（name OR spec 匹配任一同義詞）
  const patterns = expandedTerms.map((t) => `%${t}%`);
  const rows = await sql`
    SELECT DISTINCT ON (code) code, name, spec, unit, unit_price, category
    FROM materials
    WHERE name ILIKE ANY(${patterns})
       OR spec ILIKE ANY(${patterns})
    LIMIT 20
  `;
  return rows as unknown as MaterialRow[];
}

/** Layer 3: token 分詞搜尋（SQL 端 ILIKE 預過濾，解決全表掃描） */
async function searchByTokens(tokens: string[]): Promise<MaterialRow[]> {
  if (tokens.length < 2) return [];

  // SQL 端預過濾：至少匹配一個 token 的材料
  const patterns = tokens.map((t) => `%${t.toLowerCase()}%`);
  const candidates = await sql`
    SELECT code, name, spec, unit, unit_price, category
    FROM materials
    WHERE name ILIKE ANY(${patterns})
       OR spec ILIKE ANY(${patterns})
       OR code ILIKE ANY(${patterns})
  `;

  // JS 端做 60% 多 token 門檻過濾
  const minMatch = Math.ceil(tokens.length * 0.6);
  return (candidates as unknown as MaterialRow[]).filter((m) => {
    const combined = `${m.name} ${m.spec} ${m.code}`.toLowerCase();
    const matchCount = tokens.filter((t) =>
      combined.includes(t.toLowerCase())
    ).length;
    return matchCount >= minMatch;
  });
}

/** Layer 4: materials 向量搜尋（P2） */
async function searchByMaterialVector(
  embeddingStr: string,
  threshold: number
): Promise<MaterialRow[]> {
  try {
    const rows = await sql`
      SELECT code, name, spec, unit, unit_price, category,
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM materials
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> ${embeddingStr}::vector) > ${threshold}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT 10
    `;
    return rows as unknown as MaterialRow[];
  } catch {
    // embedding 欄位不存在時靜默失敗
    return [];
  }
}

// --- 合併 + 去重 ---

function mergeAndRank(layers: MaterialRow[][]): MaterialRow[] {
  const map = new Map<string, MaterialRow & { score: number }>();

  layers.forEach((layer, layerIdx) => {
    layer.forEach((item, itemIdx) => {
      const existing = map.get(item.code);
      // 越前面的 layer 權重越高，越前面的排名也越高
      const layerWeight = [10, 7, 5, 8][layerIdx] || 1;
      const positionScore = Math.max(0, 20 - itemIdx);
      const similarityBonus = (item.similarity || 0) * 20;
      const score = layerWeight + positionScore + similarityBonus;

      if (existing) {
        existing.score += score;
        // 保留最高 similarity
        if ((item.similarity || 0) > (existing.similarity || 0)) {
          existing.similarity = item.similarity;
        }
      } else {
        map.set(item.code, { ...item, score });
      }
    });
  });

  return Array.from(map.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

// --- Main Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, match_count = 5, match_threshold = 0.4, category } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: '缺少查詢參數' }, { status: 400 });
    }

    // P0: 同義詞展開
    const expandedTerms = expandQueryWithSynonyms(query);

    // P1: 分詞
    const tokens = tokenizeQuery(query);

    // 產生嵌入（用於 documents 向量搜尋 + materials 向量搜尋）
    const embedding = await generateEmbedding(query);
    const embeddingStr = '[' + embedding.join(',') + ']';

    // 四層 materials 搜尋並行
    const [layer1, layer2, layer3, layer4] = await Promise.all([
      searchByILIKE(query),
      searchBySynonyms(expandedTerms),
      searchByTokens(tokens),
      searchByMaterialVector(embeddingStr, 0.65)
    ]);

    // 合併結果
    const mergedMaterials = mergeAndRank([layer1, layer2, layer3, layer4]);

    // documents 向量搜尋
    const data = await sql`
      SELECT id, content, metadata,
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM documents
      WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${match_threshold}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${match_count}
    `;

    // 格式化 documents 結果
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

    // 格式化 materials 結果
    const formattedMaterials = mergedMaterials.map((m) => ({
      code: m.code,
      name: m.name,
      spec: m.spec || '-',
      unit: m.unit,
      unit_price: m.unit_price,
      category: m.category
    }));

    return NextResponse.json({
      success: true,
      data: filteredData,
      materials: formattedMaterials,
      query,
      embedding_dimension: embedding.length,
      search_meta: {
        synonym_expanded: expandedTerms.length,
        tokens: tokens,
        layers: {
          ilike: layer1.length,
          synonym: layer2.length,
          token: layer3.length,
          vector: layer4.length
        }
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

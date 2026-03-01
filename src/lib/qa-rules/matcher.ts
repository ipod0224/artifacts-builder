/**
 * qa_rules 二層匹配引擎
 *
 * Layer 1: 關鍵字 GIN overlap (<5ms)
 * Layer 2: 向量 cosine similarity (<15ms)
 * 合併: final_score = kw_score × 0.4 + vec_score × 0.6
 * 閾值: ≥ 0.65 → matched
 */

import { sql } from '@/lib/db';
import aliasData from '@/app/api/rag/aliases.json';
import type { QaRuleRow, RuleCandidate, RuleMatchResult } from './types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL_NAME = 'bge-m3';

const KW_WEIGHT = 0.4;
const VEC_WEIGHT = 0.6;
const MATCH_THRESHOLD = 0.5;
const VEC_SIMILARITY_FLOOR = 0.55;
const VEC_AUTO_MATCH = 0.75;
const KW_LIMIT = 50;
const VEC_LIMIT = 20;
const MAX_TOKENS = 100;
const EMBED_TIMEOUT_MS = 10_000;

// --- 查詢處理（與 search/route.ts 同源邏輯） ---

const synonymMap = aliasData.synonyms as Record<string, string[]>;

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

export function expandQueryWithSynonyms(query: string): string[] {
  const expanded = new Set<string>();

  if (synonymMap[query]) {
    synonymMap[query].forEach((s) => expanded.add(s));
  }

  for (const [key, values] of Object.entries(synonymMap)) {
    if (key.length >= 2 && query.includes(key)) {
      values.forEach((s) => expanded.add(s));
    }
  }

  return Array.from(expanded);
}

export function tokenizeQuery(query: string): string[] {
  const raw = query
    .replace(/[，。、！？：；（）()]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const tokens: string[] = [];
  for (const token of raw) {
    const parts = token.match(
      /[\u4e00-\u9fff\u3400-\u4dbf]+|[^\u4e00-\u9fff\u3400-\u4dbf]+/g
    );
    if (parts && parts.length > 1) {
      tokens.push(...parts.map((p) => p.trim()).filter(Boolean));
    } else {
      tokens.push(token);
    }
  }

  // 對長 CJK 段落做 bigram 拆分（中文沒有空白分隔）
  const expanded: string[] = [];
  for (const t of tokens) {
    expanded.push(t);
    if (/^[\u4e00-\u9fff\u3400-\u4dbf]+$/.test(t) && t.length >= 4) {
      for (let i = 0; i <= t.length - 2; i++) {
        expanded.push(t.slice(i, i + 2));
      }
      if (t.length >= 6) {
        for (let i = 0; i <= t.length - 3; i++) {
          expanded.push(t.slice(i, i + 3));
        }
      }
    }
  }

  const unique = Array.from(new Set(expanded));
  return unique
    .filter((t) => t.length >= 1 && !stopWords.has(t))
    .slice(0, MAX_TOKENS);
}

async function generateEmbedding(text: string): Promise<number[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        input: [text],
        keep_alive: '5m'
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama embedding failed: ${errorText}`);
    }

    const result = await response.json();
    if (result.embeddings && result.embeddings.length > 0) {
      return result.embeddings[0];
    } else if (result.embedding) {
      return result.embedding;
    }
    throw new Error('Ollama embedding response format unexpected');
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Layer 1: 關鍵字 GIN 匹配 ---

async function searchByKeywords(allTerms: string[]): Promise<QaRuleRow[]> {
  if (allTerms.length === 0) return [];

  const rows = await sql`
    SELECT id, rule_id, type, subtype, query, rule, keywords, embedding,
           created_at, updated_at
    FROM qa_rules
    WHERE keywords && ${allTerms}
    LIMIT ${KW_LIMIT}
  `;
  return rows as unknown as QaRuleRow[];
}

export function computeKwScore(
  ruleKeywords: string[],
  queryTerms: string[]
): number {
  if (ruleKeywords.length === 0) return 0;
  const overlapCount = ruleKeywords.filter((kw) =>
    queryTerms.some((t) => kw.includes(t) || t.includes(kw))
  ).length;
  return overlapCount / ruleKeywords.length;
}

// --- Layer 2: 向量 cosine 匹配 ---

async function searchByVector(
  embeddingStr: string
): Promise<(QaRuleRow & { similarity: number })[]> {
  try {
    const rows = await sql`
      SELECT id, rule_id, type, subtype, query, rule, keywords, embedding,
             created_at, updated_at,
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM qa_rules
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> ${embeddingStr}::vector) > ${VEC_SIMILARITY_FLOOR}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${VEC_LIMIT}
    `;
    return rows as unknown as (QaRuleRow & { similarity: number })[];
  } catch {
    return [];
  }
}

// --- 主匹配函式 ---

export async function matchRules(query: string): Promise<RuleMatchResult> {
  const startTime = Date.now();

  // 1. 查詢前處理
  const tokens = tokenizeQuery(query);
  const synonyms = expandQueryWithSynonyms(query);
  const allTerms = Array.from(new Set([...tokens, ...synonyms]));

  // 2. 生成 embedding
  let embedding: number[] | null = null;
  let embeddingStr = '';
  try {
    embedding = await generateEmbedding(query);
    embeddingStr = '[' + embedding.join(',') + ']';
  } catch {
    // embedding 失敗時只走關鍵字層
  }

  // 3. 並行查詢兩層
  const [kwRows, vecRows] = await Promise.all([
    searchByKeywords(allTerms),
    embeddingStr ? searchByVector(embeddingStr) : Promise.resolve([])
  ]);

  // 4. 合併候選，計算 final_score
  const candidateMap = new Map<number, RuleCandidate>();

  for (const row of kwRows) {
    const kwScore = computeKwScore(row.keywords, allTerms);
    candidateMap.set(row.rule_id, {
      rule: row,
      kwScore,
      vecScore: 0,
      finalScore: kwScore * KW_WEIGHT
    });
  }

  for (const row of vecRows) {
    const vecScore = row.similarity;
    const existing = candidateMap.get(row.rule_id);
    if (existing) {
      existing.vecScore = vecScore;
      existing.finalScore =
        existing.kwScore * KW_WEIGHT + vecScore * VEC_WEIGHT;
    } else {
      candidateMap.set(row.rule_id, {
        rule: row,
        kwScore: 0,
        vecScore,
        finalScore: vecScore * VEC_WEIGHT
      });
    }
  }

  // 5. 排序、篩選
  const candidates = Array.from(candidateMap.values()).sort(
    (a, b) => b.finalScore - a.finalScore
  );

  // 高向量相似度直接匹配，不受加權門檻限制
  const bestMatch =
    candidates.length > 0 &&
    (candidates[0].finalScore >= MATCH_THRESHOLD ||
      candidates[0].vecScore >= VEC_AUTO_MATCH)
      ? candidates[0]
      : null;

  return {
    matched: bestMatch !== null,
    candidates: candidates.slice(0, 10),
    bestMatch,
    matchMeta: {
      queryTokens: tokens,
      synonymExpanded: synonyms,
      kwCandidates: kwRows.length,
      vecCandidates: vecRows.length,
      elapsed: Date.now() - startTime
    }
  };
}

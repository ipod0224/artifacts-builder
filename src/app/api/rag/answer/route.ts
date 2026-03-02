/**
 * POST /api/rag/answer
 *
 * 規則優先 + LLM fallback 對答 endpoint
 *
 * Flow:
 * 1. matchRules(query) → 二層匹配（GIN + vector）
 * 2. matched → renderAnswer(rule) → ~100ms, $0
 * 3. not matched → search + synthesize → 5-30s, ~$0.05
 */

import { NextRequest, NextResponse } from 'next/server';
import { matchRules, renderAnswer } from '@/lib/qa-rules';

// Vercel 上沒有 localhost:3001，用 request origin 動態解析
function getApiBase(request: NextRequest): string {
  return process.env.RAG_API_BASE || request.nextUrl.origin;
}
const MAX_QUERY_LENGTH = 500;

interface AnswerResponse {
  success: boolean;
  answer: string;
  source: 'rule' | 'rule+materials' | 'llm';
  confidence: number;
  matchedRule?: {
    ruleId: number;
    type: string;
    subtype: string | null;
    score: number;
  };
  materials?: Array<{
    code: string;
    name: string;
    spec: string;
    unit: string;
    unit_price: number | null;
  }>;
  meta?: {
    elapsed: number;
    queryTokens: string[];
    kwCandidates: number;
    vecCandidates: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: '缺少查詢參數' }, { status: 400 });
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      return NextResponse.json({ error: '查詢不可為空白' }, { status: 400 });
    }
    if (trimmedQuery.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `查詢長度不可超過 ${MAX_QUERY_LENGTH} 字` },
        { status: 400 }
      );
    }

    // Step 1: 嘗試規則匹配
    const matchResult = await matchRules(trimmedQuery);

    if (matchResult.matched && matchResult.bestMatch) {
      const { bestMatch } = matchResult;
      const rendered = renderAnswer(bestMatch.rule, bestMatch.finalScore);

      // 品質閘門：renderAnswer 回傳 null 代表答案過短，退化到 LLM
      if (rendered) {
        const response: AnswerResponse = {
          success: true,
          answer: rendered.answer,
          source: rendered.source,
          confidence: rendered.confidence,
          matchedRule: {
            ruleId: bestMatch.rule.rule_id,
            type: bestMatch.rule.type,
            subtype: bestMatch.rule.subtype,
            score: bestMatch.finalScore
          },
          meta: {
            elapsed: Date.now() - startTime,
            queryTokens: matchResult.matchMeta.queryTokens,
            kwCandidates: matchResult.matchMeta.kwCandidates,
            vecCandidates: matchResult.matchMeta.vecCandidates
          }
        };

        return NextResponse.json(response);
      }
    }

    // Step 2: 未命中 → LLM fallback
    // 轉發 auth headers（Basic Auth cookie + authorization）給內部 API 呼叫
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const cookie = request.headers.get('cookie');
    if (cookie) forwardHeaders['cookie'] = cookie;
    const authorization = request.headers.get('authorization');
    if (authorization) forwardHeaders['authorization'] = authorization;

    const searchRes = await fetch(`${getApiBase(request)}/api/rag/search`, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify({
        query: trimmedQuery,
        match_count: 5,
        match_threshold: 0.4
      })
    });

    if (!searchRes.ok) {
      throw new Error(`search API failed: HTTP ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const materials = searchData.materials || [];
    const chunks = searchData.data || [];

    const synthesizeRes = await fetch(
      `${getApiBase(request)}/api/rag/synthesize`,
      {
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify({ query: trimmedQuery, materials, chunks })
      }
    );

    if (!synthesizeRes.ok) {
      throw new Error(`synthesize API failed: HTTP ${synthesizeRes.status}`);
    }

    const synthesizeData = await synthesizeRes.json();

    const response: AnswerResponse = {
      success: true,
      answer: synthesizeData.answer,
      source: 'llm',
      confidence:
        chunks.length > 0
          ? Math.max(...chunks.map((c: { similarity: number }) => c.similarity))
          : 0,
      materials: materials.slice(0, 10),
      meta: {
        elapsed: Date.now() - startTime,
        queryTokens: matchResult.matchMeta.queryTokens,
        kwCandidates: matchResult.matchMeta.kwCandidates,
        vecCandidates: matchResult.matchMeta.vecCandidates
      }
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : '對答系統錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

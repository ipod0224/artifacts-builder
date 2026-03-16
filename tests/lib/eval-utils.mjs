/**
 * RAG 評估共用工具
 * API 呼叫、評分邏輯、MRR 計算、checkpoint、報告格式
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const DEFAULT_API_BASE = 'http://localhost:3001';
const DEFAULT_MATCH_COUNT = 5;
const DEFAULT_MATCH_THRESHOLD = 0.4;
const REQUEST_DELAY_MS = 150;
const MAX_RETRIES = 2;

/**
 * 呼叫 /api/rag/search，含重試和超時
 */
export async function callSearchAPI(query, options = {}) {
  const {
    apiBase = DEFAULT_API_BASE,
    matchCount = DEFAULT_MATCH_COUNT,
    matchThreshold = DEFAULT_MATCH_THRESHOLD,
    retries = MAX_RETRIES,
  } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${apiBase}/api/rag/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          match_count: matchCount,
          match_threshold: matchThreshold,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timeout);
      if (attempt < retries) {
        await delay(1000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

/**
 * 統一評分邏輯
 * @param {Object} question - { id, type, query, expect_materials_gte, keywords }
 * @param {Object} result - API 回傳 { materials, data }
 * @returns {Object} 評估結果
 */
export function evaluateSearchResult(question, result) {
  const materials = result.materials || [];
  const chunks = result.data || [];

  const eval_ = {
    id: question.id,
    type: question.type,
    subtype: question.subtype || '',
    query: question.query,
    pass: false,
    materialCount: materials.length,
    chunkCount: chunks.length,
    topSimilarity: 0,
    avgSimilarity: 0,
    details: '',
    materialNames: materials.map((m) => m.name),
  };

  if (chunks.length > 0) {
    eval_.topSimilarity = Math.max(...chunks.map((c) => c.similarity));
    eval_.avgSimilarity =
      chunks.reduce((s, c) => s + c.similarity, 0) / chunks.length;
  }

  const expected = question.expect_materials_gte || 0;

  if (expected === 0) {
    // 知識類問題，API 不報錯就 pass
    eval_.pass = true;
    eval_.details = `知識類（材料 ${materials.length} 筆）`;
  } else if (materials.length >= expected) {
    eval_.pass = true;
    eval_.details = `材料命中 ${materials.length} 筆（要求 ≥${expected}）`;
  } else {
    eval_.details = `材料不足：${materials.length}/${expected}`;
  }

  return eval_;
}

/**
 * 計算加權通過率 (Weighted Pass Rate)
 * pass + 有材料 → 1.0，pass + 無材料（知識類）→ 0.5，fail → 0
 */
export function calculateWeightedPassRate(evalResults) {
  if (evalResults.length === 0) return 0;
  const score = evalResults.reduce((sum, r) => {
    if (r.pass && r.materialCount > 0) return sum + 1;
    if (r.pass && r.materialCount === 0) return sum + 0.5;
    return sum;
  }, 0);
  return score / evalResults.length;
}

/**
 * Checkpoint 寫入
 */
export function writeCheckpoint(data, path) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

/**
 * Checkpoint 讀取
 */
export function readCheckpoint(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 產生統一格式的報告
 */
export function formatReport(evalResults, config = {}) {
  const passed = evalResults.filter((r) => r.pass).length;
  const failed = evalResults.filter((r) => !r.pass && !r.error).length;
  const errors = evalResults.filter((r) => r.error).length;
  const total = evalResults.length;
  const passRate = total > 0 ? parseFloat(((passed / total) * 100).toFixed(1)) : 0;

  // 分類統計
  const typeStats = {};
  for (const r of evalResults) {
    if (!typeStats[r.type]) typeStats[r.type] = { pass: 0, fail: 0, total: 0 };
    typeStats[r.type].total++;
    if (r.pass) typeStats[r.type].pass++;
    else typeStats[r.type].fail++;
  }

  // 向量品質
  const withSim = evalResults.filter((r) => r.topSimilarity > 0);
  const vectorQuality = withSim.length > 0
    ? {
        avgTopSimilarity: withSim.reduce((s, r) => s + r.topSimilarity, 0) / withSim.length,
        highConfidence: withSim.filter((r) => r.topSimilarity >= 0.7).length,
        mediumConfidence: withSim.filter((r) => r.topSimilarity >= 0.5 && r.topSimilarity < 0.7).length,
        lowConfidence: withSim.filter((r) => r.topSimilarity < 0.5).length,
      }
    : null;

  const weightedPassRate = calculateWeightedPassRate(evalResults);

  return {
    timestamp: new Date().toISOString(),
    config,
    summary: { total, passed, failed, errors, passRate, weightedPassRate },
    typeStats,
    vectorQuality,
    failures: evalResults.filter((r) => !r.pass).map((r) => ({
      id: r.id, type: r.type, query: r.query, details: r.details || r.error,
    })),
    results: evalResults,
  };
}

/**
 * 印出摘要到 console
 */
export function printSummary(report) {
  const { summary, typeStats, vectorQuality } = report;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`結果：${summary.passed}/${summary.total} 通過（${summary.passRate}%），${summary.failed} 失敗，${summary.errors} 錯誤`);
  console.log(`加權通過率：${summary.weightedPassRate.toFixed(3)}`);
  console.log(`${'='.repeat(60)}`);

  console.log(`\n分類統計：`);
  for (const [type, stats] of Object.entries(typeStats).sort((a, b) => b[1].total - a[1].total)) {
    const rate = ((stats.pass / stats.total) * 100).toFixed(0);
    console.log(`  ${type.padEnd(15)} ${stats.pass}/${stats.total} (${rate}%)`);
  }

  if (vectorQuality) {
    console.log(`\n向量品質：`);
    console.log(`  平均 topSimilarity：${(vectorQuality.avgTopSimilarity * 100).toFixed(1)}%`);
    console.log(`  高信心 ≥70%：${vectorQuality.highConfidence} 筆`);
    console.log(`  中信心 50-70%：${vectorQuality.mediumConfidence} 筆`);
    console.log(`  低信心 <50%：${vectorQuality.lowConfidence} 筆`);
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export { delay, REQUEST_DELAY_MS };

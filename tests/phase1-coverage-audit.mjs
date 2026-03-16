#!/usr/bin/env node
/**
 * Phase 1：覆蓋審計（離線）
 * 分析資料集分佈、subtype、關鍵字頻率、問題長度
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIN_TYPE_RATIO = 0.03; // 每類至少 3%

function audit() {
  const startTime = Date.now();
  console.log('=== Phase 1：覆蓋審計 ===\n');

  const raw = JSON.parse(readFileSync(join(__dirname, 'rag-training-rules.json'), 'utf-8'));
  const questions = raw.questions;
  const total = questions.length;
  console.log(`題數：${total}`);

  const warnings = [];

  // 1. 類別分佈
  const typeCounts = {};
  for (const q of questions) {
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
  }

  console.log('\n類別分佈：');
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedTypes) {
    const ratio = (count / total * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / total * 50));
    console.log(`  ${type.padEnd(15)} ${String(count).padStart(5)} (${ratio}%) ${bar}`);
    if (count / total < MIN_TYPE_RATIO) {
      warnings.push(`類別 "${type}" 佔比 ${ratio}% < 3% 門檻`);
    }
  }

  // 2. Subtype 分佈
  const subtypeCounts = {};
  for (const q of questions) {
    const key = `${q.type}/${q.subtype}`;
    subtypeCounts[key] = (subtypeCounts[key] || 0) + 1;
  }

  const subtypeEntries = Object.entries(subtypeCounts).sort((a, b) => b[1] - a[1]);
  console.log(`\nSubtype 數量：${subtypeEntries.length}`);
  console.log('Top 15 subtypes：');
  for (const [key, count] of subtypeEntries.slice(0, 15)) {
    console.log(`  ${key.padEnd(35)} ${count}`);
  }

  // 偵測只有 1 題的 subtype
  const singletons = subtypeEntries.filter(([, count]) => count === 1);
  if (singletons.length > 0) {
    warnings.push(`${singletons.length} 個 subtype 只有 1 題`);
  }

  // 3. 關鍵字頻率 top-50
  const kwFreq = {};
  for (const q of questions) {
    if (!Array.isArray(q.keywords)) continue;
    for (const kw of q.keywords) {
      kwFreq[kw] = (kwFreq[kw] || 0) + 1;
    }
  }

  const topKw = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 50);
  console.log('\n關鍵字頻率 Top-20：');
  for (const [kw, count] of topKw.slice(0, 20)) {
    console.log(`  ${kw.padEnd(20)} ${count}`);
  }

  // 偵測高度集中
  if (topKw.length > 0 && topKw[0][1] > total * 0.1) {
    warnings.push(`關鍵字 "${topKw[0][0]}" 出現 ${topKw[0][1]} 次（>${(total * 0.1).toFixed(0)}）可能過度集中`);
  }

  // 4. 問題長度分佈
  const lengths = questions.map((q) => q.query.length).sort((a, b) => a - b);
  const avg = lengths.reduce((s, l) => s + l, 0) / lengths.length;
  const median = lengths[Math.floor(lengths.length / 2)];
  const p95 = lengths[Math.floor(lengths.length * 0.95)];
  const p5 = lengths[Math.floor(lengths.length * 0.05)];

  console.log('\n問題長度分佈：');
  console.log(`  最短：${lengths[0]} 字`);
  console.log(`  P5：  ${p5} 字`);
  console.log(`  中位：${median} 字`);
  console.log(`  平均：${avg.toFixed(1)} 字`);
  console.log(`  P95： ${p95} 字`);
  console.log(`  最長：${lengths[lengths.length - 1]} 字`);

  // 5. expect_materials_gte 分佈
  const matCounts = { zero: 0, nonzero: 0 };
  for (const q of questions) {
    if ((q.expect_materials_gte || 0) === 0) matCounts.zero++;
    else matCounts.nonzero++;
  }

  console.log('\nexpect_materials_gte 分佈：');
  console.log(`  = 0（知識類）：${matCounts.zero} (${(matCounts.zero / total * 100).toFixed(1)}%)`);
  console.log(`  ≥ 1（材料類）：${matCounts.nonzero} (${(matCounts.nonzero / total * 100).toFixed(1)}%)`);

  // 警告
  const elapsed = Date.now() - startTime;

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} 個警告：`);
    for (const w of warnings) {
      console.log(`  WARN: ${w}`);
    }
  }

  console.log(`\n--- Phase 1 結果 ---`);
  console.log(`類別數：${sortedTypes.length}`);
  console.log(`子類數：${subtypeEntries.length}`);
  console.log(`關鍵字數：${Object.keys(kwFreq).length}`);
  console.log(`警告：${warnings.length}`);
  console.log(`耗時：${elapsed}ms`);
  console.log(`\nPHASE 1 PASSED（覆蓋審計為資訊性質，不阻斷）`);

  // 寫入報告
  const report = {
    timestamp: new Date().toISOString(),
    total,
    typeDistribution: Object.fromEntries(sortedTypes.map(([t, c]) => [t, { count: c, ratio: parseFloat((c / total * 100).toFixed(1)) }])),
    subtypeCount: subtypeEntries.length,
    topSubtypes: Object.fromEntries(subtypeEntries.slice(0, 30)),
    singletonSubtypes: singletons.length,
    keywordStats: {
      uniqueCount: Object.keys(kwFreq).length,
      top20: Object.fromEntries(topKw.slice(0, 20)),
    },
    queryLength: {
      min: lengths[0],
      p5,
      median,
      avg: parseFloat(avg.toFixed(1)),
      p95,
      max: lengths[lengths.length - 1],
    },
    materialsExpectation: matCounts,
    warnings,
  };

  const reportPath = join(__dirname, 'coverage-audit-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n報告已存至：${reportPath}`);

  return report;
}

export { audit };

if (process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/^.*tests/, 'tests'))) {
  audit();
}

#!/usr/bin/env node
/**
 * Phase 0：Schema 驗證（離線）
 * 驗證 rag-training-rules.json 的結構完整性
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VALID_TYPES = new Set([
  'scenario', 'estimation', 'regulation', 'selection',
  'pricing', 'procedure', 'troubleshoot', 'template',
]);

const REQUIRED_FIELDS = ['id', 'type', 'subtype', 'query', 'rule', 'keywords', 'expect_materials_gte'];

function validate() {
  const startTime = Date.now();
  console.log('=== Phase 0：Schema 驗證 ===\n');

  const raw = JSON.parse(readFileSync(join(__dirname, 'rag-training-rules.json'), 'utf-8'));
  const questions = raw.questions;

  if (!Array.isArray(questions)) {
    console.error('FATAL: questions 不是陣列');
    process.exit(1);
  }

  console.log(`題數：${questions.length}`);

  const errors = [];
  const warnings = [];
  const seenIds = new Set();
  const seenQueries = new Set();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const prefix = `[${i}] id=${q.id}`;

    // 必備欄位
    for (const field of REQUIRED_FIELDS) {
      if (q[field] === undefined || q[field] === null) {
        errors.push(`${prefix}: 缺少欄位 "${field}"`);
      }
    }

    // type 合法性
    if (q.type && !VALID_TYPES.has(q.type)) {
      errors.push(`${prefix}: type "${q.type}" 不在合法值中`);
    }

    // query 非空且 ≥3 字
    if (typeof q.query === 'string') {
      if (q.query.trim().length < 3) {
        errors.push(`${prefix}: query 太短 "${q.query}"`);
      }
    } else if (q.query !== undefined) {
      errors.push(`${prefix}: query 不是字串`);
    }

    // keywords 為非空陣列
    if (Array.isArray(q.keywords)) {
      if (q.keywords.length === 0) {
        warnings.push(`${prefix}: keywords 為空陣列`);
      }
    } else if (q.keywords !== undefined) {
      errors.push(`${prefix}: keywords 不是陣列`);
    }

    // rule 為 object 且非空
    if (q.rule !== undefined && q.rule !== null) {
      if (typeof q.rule !== 'object' || Array.isArray(q.rule)) {
        errors.push(`${prefix}: rule 不是 object`);
      } else if (Object.keys(q.rule).length === 0) {
        warnings.push(`${prefix}: rule 為空 object`);
      }
    }

    // expect_materials_gte 為非負整數
    if (q.expect_materials_gte !== undefined) {
      if (typeof q.expect_materials_gte !== 'number' || q.expect_materials_gte < 0) {
        errors.push(`${prefix}: expect_materials_gte 無效 (${q.expect_materials_gte})`);
      }
    }

    // ID 唯一性
    if (seenIds.has(q.id)) {
      errors.push(`${prefix}: ID 重複`);
    }
    seenIds.add(q.id);

    // query 唯一性
    if (q.query && seenQueries.has(q.query)) {
      errors.push(`${prefix}: query 重複 "${q.query.slice(0, 50)}"`);
    }
    if (q.query) seenQueries.add(q.query);
  }

  // 輸出結果
  const elapsed = Date.now() - startTime;

  if (errors.length > 0) {
    console.log(`\n${errors.length} 個錯誤：`);
    for (const e of errors.slice(0, 30)) {
      console.log(`  ERROR: ${e}`);
    }
    if (errors.length > 30) {
      console.log(`  ... 還有 ${errors.length - 30} 個錯誤`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} 個警告：`);
    for (const w of warnings.slice(0, 20)) {
      console.log(`  WARN: ${w}`);
    }
    if (warnings.length > 20) {
      console.log(`  ... 還有 ${warnings.length - 20} 個警告`);
    }
  }

  console.log(`\n--- Phase 0 結果 ---`);
  console.log(`題數：${questions.length}`);
  console.log(`錯誤：${errors.length}`);
  console.log(`警告：${warnings.length}`);
  console.log(`耗時：${elapsed}ms`);

  if (errors.length === 0) {
    console.log(`\nPHASE 0 PASSED`);
  } else {
    console.log(`\nPHASE 0 FAILED`);
    process.exit(1);
  }

  return { errors: errors.length, warnings: warnings.length, total: questions.length };
}

export { validate };

if (process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/^.*tests/, 'tests'))) {
  validate();
}

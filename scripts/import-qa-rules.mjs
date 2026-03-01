#!/usr/bin/env node
/**
 * 匯入 rag-training-rules.json → qa_rules 表
 *
 * 用法：
 *   node scripts/import-qa-rules.mjs                     # 全量匯入（含 embedding）
 *   node scripts/import-qa-rules.mjs --skip-embedding    # 跳過 embedding
 *   node scripts/import-qa-rules.mjs --batch-size 20     # 調整 embedding 批次
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

// CLI
const args = process.argv.slice(2);
const skipEmbedding = args.includes('--skip-embedding');
const batchIdx = args.indexOf('--batch-size');
const embeddingBatchSize = batchIdx >= 0 ? parseInt(args[batchIdx + 1], 10) : 10;

// Config
const DB_URL = process.env.DATABASE_URL || 'postgresql://tmw:tmw@localhost:4202/tmw';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL_NAME = 'bge-m3';
const INSERT_BATCH = 100;

const sql = postgres(DB_URL, { max: 5, idle_timeout: 20 });

async function generateEmbeddings(texts) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL_NAME, input: texts }),
  });
  if (!res.ok) throw new Error(`Ollama embed HTTP ${res.status}`);
  const data = await res.json();
  return data.embeddings;
}

function toVectorString(vec) {
  return `[${vec.join(',')}]`;
}

async function run() {
  const startTime = Date.now();
  console.log('=== 匯入 qa_rules ===\n');

  // 載入資料
  const raw = JSON.parse(
    readFileSync(join(__dirname, '..', 'tests', 'rag-training-rules.json'), 'utf-8')
  );
  const questions = raw.questions;
  console.log(`資料集：${questions.length} 題（v${raw.version}）`);
  console.log(`embedding：${skipEmbedding ? '跳過' : `Ollama ${MODEL_NAME}，批次 ${embeddingBatchSize}`}`);

  // 批次處理
  let imported = 0;
  let embedGenerated = 0;
  const buffer = [];

  for (let i = 0; i < questions.length; i += embeddingBatchSize) {
    const batch = questions.slice(i, i + embeddingBatchSize);

    // 生成 embedding
    let embeddings = null;
    if (!skipEmbedding) {
      try {
        const texts = batch.map(
          (q) => `${q.query} ${q.keywords.join(' ')}`
        );
        embeddings = await generateEmbeddings(texts);
        embedGenerated += batch.length;
      } catch (err) {
        console.error(`  embedding 失敗 (batch ${i}): ${err.message}`);
        embeddings = null;
      }
    }

    // 累積到 buffer
    for (let j = 0; j < batch.length; j++) {
      const q = batch[j];
      buffer.push({
        rule_id: q.id,
        type: q.type,
        subtype: q.subtype || null,
        query: q.query,
        rule: q.rule,
        keywords: q.keywords,
        embedding: embeddings ? toVectorString(embeddings[j]) : null,
      });
    }

    // 批次 INSERT
    if (buffer.length >= INSERT_BATCH || i + embeddingBatchSize >= questions.length) {
      await insertBatch(buffer);
      imported += buffer.length;
      buffer.length = 0;
    }

    // 進度
    if ((i + embeddingBatchSize) % 500 < embeddingBatchSize || i + embeddingBatchSize >= questions.length) {
      const pct = (((i + batch.length) / questions.length) * 100).toFixed(0);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`  ${i + batch.length}/${questions.length} (${pct}%) ${elapsed}s\n`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 驗證
  const [{ count }] = await sql`SELECT count(*)::int as count FROM qa_rules`;
  console.log(`\n=== 匯入完成 ===`);
  console.log(`匯入：${imported} 筆`);
  console.log(`embedding：${embedGenerated} 筆`);
  console.log(`資料庫總數：${count} 筆`);
  console.log(`耗時：${elapsed}s`);

  // 重建 ivfflat 索引（有資料後效果更好）
  if (!skipEmbedding && count > 1000) {
    console.log('\n重建 ivfflat 索引...');
    await sql`DROP INDEX IF EXISTS idx_qa_rules_embedding_ivfflat`;
    await sql`CREATE INDEX idx_qa_rules_embedding_ivfflat ON qa_rules USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`;
    console.log('ivfflat 索引已重建');
  }

  await sql.end();
}

async function insertBatch(rows) {
  await sql.begin(async (tx) => {
    for (const r of rows) {
      await tx`
        INSERT INTO qa_rules (rule_id, type, subtype, query, rule, keywords, embedding)
        VALUES (
          ${r.rule_id}, ${r.type}, ${r.subtype}, ${r.query},
          ${tx.json(r.rule)}, ${r.keywords}, ${r.embedding ? tx`${r.embedding}::vector` : null}
        )
        ON CONFLICT (rule_id) DO UPDATE SET
          type = EXCLUDED.type,
          subtype = EXCLUDED.subtype,
          query = EXCLUDED.query,
          rule = EXCLUDED.rule,
          keywords = EXCLUDED.keywords,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
      `;
    }
  });
}

run().catch((err) => {
  console.error('匯入錯誤:', err);
  process.exit(1);
});

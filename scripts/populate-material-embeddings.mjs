#!/usr/bin/env node
/**
 * 為 materials 表的每筆記錄產生 bge-m3 嵌入向量
 * 嵌入文字 = name + ' ' + spec + ' ' + category
 */

import postgres from 'postgres';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = 'bge-m3';

const sql = postgres(
  process.env.DATABASE_URL ||
    'postgresql://tmw:055931c4ece3cd4b1d7f851315a14b8e@127.0.0.1:4202/tmw'
);

async function generateEmbedding(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: [text], keep_alive: '5m' }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${await res.text()}`);
  const data = await res.json();
  return data.embeddings?.[0] || data.embedding;
}

async function main() {
  const materials = await sql`
    SELECT code, name, spec, category FROM materials ORDER BY code
  `;

  console.log(`Found ${materials.length} materials to embed`);
  let done = 0;

  for (const m of materials) {
    const text = [m.name, m.spec, m.category].filter(Boolean).join(' ');
    try {
      const embedding = await generateEmbedding(text);
      const embStr = '[' + embedding.join(',') + ']';
      await sql`
        UPDATE materials SET embedding = ${embStr}::vector WHERE code = ${m.code}
      `;
      done++;
      if (done % 10 === 0) console.log(`  ${done}/${materials.length} done`);
    } catch (err) {
      console.error(`  Error embedding ${m.code}: ${err.message}`);
    }
  }

  console.log(`\nCompleted: ${done}/${materials.length}`);

  // Verify
  const count = await sql`SELECT COUNT(*) as n FROM materials WHERE embedding IS NOT NULL`;
  console.log(`Materials with embeddings: ${count[0].n}`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

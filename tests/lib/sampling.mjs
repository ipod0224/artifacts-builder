/**
 * 分層抽樣工具
 * Mulberry32 seeded PRNG + 按 type 分層抽樣
 */

/**
 * Mulberry32 — 確定性 32-bit PRNG
 * @param {number} seed
 * @returns {() => number} 回傳 0~1 的浮點數
 */
export function mulberry32(seed) {
  let t = seed | 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle（使用提供的 PRNG）
 * @param {any[]} arr
 * @param {() => number} rng
 * @returns {any[]} 新陣列（不 mutate 原陣列）
 */
function shuffle(arr, rng) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 分層抽樣
 * @param {Array<{type: string}>} questions - 問題陣列
 * @param {Object} config
 * @param {'quick'|'standard'|'full'} config.mode
 * @param {number} [config.minPerType=20] - 每類最少抽幾題
 * @param {number} [config.seed=42] - RNG seed
 * @returns {Array} 抽樣後的問題
 */
export function stratifiedSample(questions, config = {}) {
  const { mode = 'standard', minPerType = 20, seed = 42 } = config;

  if (mode === 'full') return [...questions];

  const rng = mulberry32(seed);

  // 按 type 分組
  const byType = {};
  for (const q of questions) {
    if (!byType[q.type]) byType[q.type] = [];
    byType[q.type].push(q);
  }

  const total = questions.length;
  const ratio = mode === 'quick' ? 0 : 0.08; // standard = 8%

  const sampled = [];
  for (const [type, items] of Object.entries(byType)) {
    const proportional = Math.ceil(items.length * ratio);
    const count = Math.max(minPerType, proportional);
    const take = Math.min(count, items.length);

    const shuffled = shuffle(items, rng);
    sampled.push(...shuffled.slice(0, take));
  }

  return sampled;
}

/**
 * 取得抽樣統計摘要
 */
export function sampleStats(questions, sampled) {
  const totalByType = {};
  const sampledByType = {};

  for (const q of questions) {
    totalByType[q.type] = (totalByType[q.type] || 0) + 1;
  }
  for (const q of sampled) {
    sampledByType[q.type] = (sampledByType[q.type] || 0) + 1;
  }

  return { totalByType, sampledByType, total: questions.length, sampled: sampled.length };
}

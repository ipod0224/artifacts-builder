#!/usr/bin/env node
/**
 * qa-rules 核心純函式單元測試
 *
 * 測試範圍：tokenizeQuery, expandQueryWithSynonyms, computeKwScore,
 *           selectRenderer (路由), parseRule (雙重編碼)
 *
 * 用法：node tests/qa-rules-unit.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- 複製純函式（避免 TypeScript / path alias 依賴）---

const stopWords = new Set([
  '要', '的', '多少', '錢', '一個', '幾個', '我', '你', '是', '有',
  '在', '了', '嗎', '呢', '什麼', '怎麼', '用', '到', '哪', '和',
  '跟', '給', '讓', '把', '被', '從', '裡', '上', '下', '中',
  '個', '台', '支', '條', '組', '套', '式',
]);

const MAX_TOKENS = 100;

function tokenizeQuery(query) {
  const raw = query
    .replace(/[，。、！？：；（）()]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const tokens = [];
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

  const expanded = [];
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
  return unique.filter((t) => t.length >= 1 && !stopWords.has(t)).slice(0, MAX_TOKENS);
}

function computeKwScore(ruleKeywords, queryTerms) {
  if (ruleKeywords.length === 0) return 0;
  const overlapCount = ruleKeywords.filter((kw) =>
    queryTerms.some((t) => kw.includes(t) || t.includes(kw))
  ).length;
  return overlapCount / ruleKeywords.length;
}

function parseRule(row) {
  if (typeof row.rule === 'string') {
    try {
      return { ...row, rule: JSON.parse(row.rule) };
    } catch {
      return row;
    }
  }
  return row;
}

function selectRenderer(row) {
  const rule = row.rule;
  if ('template' in rule) return 'renderDirectAnswer';
  if ('steps' in rule || 'causes' in rule || 'methods' in rule) return 'renderStepsProcedure';
  if ('estimate' in rule || 'formula' in rule || ('min' in rule && 'max' in rule) || 'unit_price' in rule || ('work' in rule && 'price' in rule)) return 'renderEstimation';
  if ('gauge' in rule || 'amp' in rule || 'law' in rule || 'standard' in rule) return 'renderRegulation';
  if ('materials' in rule || 'scene' in rule || 'room' in rule || 'wire' in rule) return 'renderMaterialList';
  if ('answer' in rule || 'mechanism' in rule || 'trend' in rule) return 'renderDirectAnswer';
  return 'renderGenericRule';
}

// --- 品質閘門 ---
// IMPORTANT: Must match constants in src/lib/qa-rules/renderers.ts

const MIN_ANSWER_LENGTH = 25;
const MIN_GENERIC_ANSWER_LENGTH = 40;

// 簡化版 renderers（用於測試品質閘門）
function renderDirectAnswer(row) {
  const rule = row.rule;
  if (rule.template) return rule.template;
  const parts = [];
  if (rule.answer) parts.push(rule.answer);
  if (rule.mechanism) parts.push(`機制：${rule.mechanism}`);
  if (rule.trend) parts.push(`趨勢：${rule.trend}`);
  return parts.join('\n\n');
}

function renderGenericRule(row) {
  const rule = row.rule;
  const parts = [];
  for (const [key, value] of Object.entries(rule)) {
    if (Array.isArray(value)) {
      parts.push(`${key}：`);
      value.forEach((v) => parts.push(`- ${v}`));
    } else {
      parts.push(`${key}：${value}`);
    }
  }
  return parts.join('\n');
}

function renderMaterialList(row) {
  const rule = row.rule;
  const parts = [];
  if (rule.scene) parts.push(`場景：${rule.scene}`);
  if (rule.room) parts.push(`空間：${rule.room}`);
  if (rule.materials && rule.materials.length > 0) {
    parts.push('所需材料：');
    rule.materials.forEach((m) => parts.push(`- ${m}`));
  }
  if (rule.wire) parts.push(`建議線徑：${rule.wire}`);
  return parts.join('\n');
}

function renderEstimation(row) {
  const rule = row.rule;
  const parts = [];

  if (rule.work && rule.price) {
    const priceDisplay = rule.price.startsWith('$') ? rule.price : `$${rule.price}`;
    parts.push(`**${rule.work}：${priceDisplay}**`);
    if (rule.includes) parts.push(`含：${rule.includes}`);
    return parts.join('\n');
  }

  if (rule.formula) parts.push(`公式：${rule.formula}`);
  if (rule.ping) parts.push(`坪數：${rule.ping} 坪`);

  if (rule.items && typeof rule.items === 'object' && !Array.isArray(rule.items)) {
    const entries = Object.entries(rule.items);
    if (entries.length > 0) {
      parts.push('項目明細：');
      for (const [name, qty] of entries) {
        parts.push(`- ${name} × ${qty}`);
      }
    }
  }

  if (rule.unit_price !== undefined && rule.count !== undefined) {
    const total = Math.round(rule.unit_price * rule.count);
    const itemName = rule.item || '項目';
    parts.push(`${itemName} × ${rule.count}，單價 $${rule.unit_price.toLocaleString()}，合計 $${total.toLocaleString()}`);
  } else if (rule.item && rule.unit_price !== undefined) {
    parts.push(`${rule.item}：$${rule.unit_price.toLocaleString()}/個`);
  }

  if (rule.estimate) parts.push(`**預估費用：${rule.estimate}**`);
  if (rule.min !== undefined && rule.max !== undefined) {
    parts.push(`範圍：${rule.min.toLocaleString()} ~ ${rule.max.toLocaleString()} 元`);
  }
  return parts.join('\n');
}

function renderStepsProcedure(row) {
  const rule = row.rule;
  const parts = [];
  if (rule.procedure) parts.push(`**${rule.procedure}**`);
  if (rule.steps && rule.steps.length > 0) {
    parts.push('步驟：');
    rule.steps.forEach((step, i) => parts.push(`${i + 1}. ${step}`));
  }
  if (rule.causes && rule.causes.length > 0) {
    parts.push('可能原因：');
    rule.causes.forEach((cause) => parts.push(`- ${cause}`));
  }
  if (rule.methods && rule.methods.length > 0) {
    parts.push('處理方式：');
    rule.methods.forEach((method) => parts.push(`- ${method}`));
  }
  if (rule.notes) parts.push(`\n備註：${rule.notes}`);
  return parts.join('\n');
}

function renderRegulation(row) {
  const rule = row.rule;
  const parts = [];
  if (rule.answer) parts.push(rule.answer);
  if (rule.location) parts.push(`適用場所：${rule.location}`);
  if (rule.reason) parts.push(`原因：${rule.reason}`);
  if (rule.spec) parts.push(`規格要求：${rule.spec}`);
  if (rule.gauge) parts.push(`線徑：${rule.gauge}`);
  if (rule.amp) parts.push(`額定電流：${rule.amp}`);
  if (rule.law) parts.push(`法規依據：${rule.law}`);
  if (rule.standard) parts.push(`標準：${rule.standard}`);
  return parts.join('\n');
}

const rendererMap = {
  renderDirectAnswer,
  renderStepsProcedure,
  renderEstimation,
  renderRegulation,
  renderGenericRule,
  renderMaterialList,
};

function renderAnswer(rawRow, confidence) {
  const row = parseRule(rawRow);
  const rendererName = selectRenderer(row);
  const renderer = rendererMap[rendererName] || renderGenericRule;
  const answer = renderer(row);

  // renderGenericRule 的 key-value dump 需要更長才有意義
  const threshold = rendererName === 'renderGenericRule'
    ? MIN_GENERIC_ANSWER_LENGTH
    : MIN_ANSWER_LENGTH;

  if (answer.length < threshold) {
    return null;
  }

  return {
    answer,
    source: 'rule',
    confidence,
    ruleType: row.type || 'unknown',
    ruleId: row.rule_id || 0,
  };
}

// === 測試 ===

describe('tokenizeQuery', () => {
  it('should split CJK text into bigrams', () => {
    const tokens = tokenizeQuery('廚房需要材料');
    assert.ok(tokens.includes('廚房'));
    assert.ok(tokens.includes('材料'));
    assert.ok(tokens.includes('房需'));
  });

  it('should produce trigrams for 6+ char CJK', () => {
    const tokens = tokenizeQuery('全室重配線施工步驟');
    assert.ok(tokens.includes('全室'));
    assert.ok(tokens.includes('重配'));
    assert.ok(tokens.includes('全室重'));
    assert.ok(tokens.includes('施工步'));
  });

  it('should filter stop words', () => {
    const tokens = tokenizeQuery('我要用廚房的材料');
    assert.ok(!tokens.includes('我'));
    assert.ok(!tokens.includes('要'));
    assert.ok(!tokens.includes('的'));
    assert.ok(tokens.includes('廚房'));
  });

  it('should handle mixed CJK and alphanumeric', () => {
    const tokens = tokenizeQuery('5.5mm²電線');
    assert.ok(tokens.includes('5.5mm²'));
    assert.ok(tokens.includes('電線'));
  });

  it('should handle punctuation removal', () => {
    const tokens = tokenizeQuery('浴室一定要裝漏電斷路器嗎？');
    assert.ok(!tokens.includes('？'));
    assert.ok(tokens.some((t) => t.includes('浴室')));
  });

  it('should not exceed MAX_TOKENS', () => {
    const longQuery = '一'.repeat(300);
    const tokens = tokenizeQuery(longQuery);
    assert.ok(tokens.length <= MAX_TOKENS);
  });

  it('should return empty for empty input', () => {
    const tokens = tokenizeQuery('');
    assert.equal(tokens.length, 0);
  });

  it('should keep short CJK as single token (no bigram for < 4 chars)', () => {
    const tokens = tokenizeQuery('廚房');
    assert.deepEqual(tokens, ['廚房']);
  });

  it('should handle pure alphanumeric', () => {
    const tokens = tokenizeQuery('NFB 20A');
    assert.ok(tokens.includes('NFB'));
    assert.ok(tokens.includes('20A'));
  });
});

describe('computeKwScore', () => {
  it('should return 0 for empty keywords', () => {
    assert.equal(computeKwScore([], ['廚房']), 0);
  });

  it('should return 1.0 for full match', () => {
    const score = computeKwScore(['廚房', '材料'], ['廚房', '材料']);
    assert.equal(score, 1.0);
  });

  it('should return 0.5 for partial match', () => {
    const score = computeKwScore(['廚房', '漏電斷路器'], ['廚房', '電線']);
    assert.equal(score, 0.5);
  });

  it('should match via substring (query term includes keyword)', () => {
    const score = computeKwScore(['廚房'], ['廚房需要什麼材料']);
    assert.equal(score, 1.0);
  });

  it('should match via substring (keyword includes query term)', () => {
    const score = computeKwScore(['漏電斷路器'], ['漏電']);
    assert.equal(score, 1.0);
  });

  it('should return 0 for no match', () => {
    const score = computeKwScore(['冷氣', '迴路'], ['浴室', '防水']);
    assert.equal(score, 0);
  });
});

describe('parseRule', () => {
  it('should parse stringified JSON rule', () => {
    const row = { rule: '{"scene":"廚房","materials":["電線"]}' };
    const result = parseRule(row);
    assert.equal(typeof result.rule, 'object');
    assert.equal(result.rule.scene, '廚房');
    assert.deepEqual(result.rule.materials, ['電線']);
  });

  it('should pass through object rule unchanged', () => {
    const rule = { scene: '廚房' };
    const row = { rule };
    const result = parseRule(row);
    assert.equal(result.rule, rule);
  });

  it('should handle invalid JSON string gracefully', () => {
    const row = { rule: '{invalid json}' };
    const result = parseRule(row);
    assert.equal(result.rule, '{invalid json}');
  });

  it('should not mutate original row', () => {
    const original = { rule: '{"a":1}', other: 'keep' };
    const result = parseRule(original);
    assert.equal(original.rule, '{"a":1}');
    assert.notEqual(result, original);
  });
});

describe('selectRenderer', () => {
  it('should route template to renderDirectAnswer', () => {
    assert.equal(selectRenderer({ rule: { template: '回覆範本' } }), 'renderDirectAnswer');
  });

  it('should route steps to renderStepsProcedure', () => {
    assert.equal(selectRenderer({ rule: { steps: ['步驟1'] } }), 'renderStepsProcedure');
  });

  it('should route causes to renderStepsProcedure', () => {
    assert.equal(selectRenderer({ rule: { causes: ['原因1'] } }), 'renderStepsProcedure');
  });

  it('should route estimate to renderEstimation', () => {
    assert.equal(selectRenderer({ rule: { estimate: '50,000元' } }), 'renderEstimation');
  });

  it('should route min+max to renderEstimation', () => {
    assert.equal(selectRenderer({ rule: { min: 1000, max: 5000, ping: 10 } }), 'renderEstimation');
  });

  it('should route unit_price to renderEstimation', () => {
    assert.equal(selectRenderer({ rule: { unit_price: 1200, count: 5 } }), 'renderEstimation');
  });

  it('should route work+price to renderEstimation', () => {
    assert.equal(selectRenderer({ rule: { work: '換開關', price: '500~800' } }), 'renderEstimation');
  });

  it('should route law to renderRegulation', () => {
    assert.equal(selectRenderer({ rule: { law: '用戶用電設備裝置規則' } }), 'renderRegulation');
  });

  it('should route gauge to renderRegulation', () => {
    assert.equal(selectRenderer({ rule: { gauge: '2.0mm' } }), 'renderRegulation');
  });

  it('should route materials to renderMaterialList', () => {
    assert.equal(selectRenderer({ rule: { materials: ['電線'] } }), 'renderMaterialList');
  });

  it('should route scene to renderMaterialList', () => {
    assert.equal(selectRenderer({ rule: { scene: '廚房' } }), 'renderMaterialList');
  });

  it('should route wire to renderMaterialList', () => {
    assert.equal(selectRenderer({ rule: { wire: '2.0mm PVC' } }), 'renderMaterialList');
  });

  it('should route answer to renderDirectAnswer', () => {
    assert.equal(selectRenderer({ rule: { answer: '是' } }), 'renderDirectAnswer');
  });

  it('should route trend to renderDirectAnswer', () => {
    assert.equal(selectRenderer({ rule: { trend: '上漲' } }), 'renderDirectAnswer');
  });

  it('should fallback to renderGenericRule for unknown structure', () => {
    assert.equal(selectRenderer({ rule: { custom_field: 'value' } }), 'renderGenericRule');
  });

  it('should prioritize template over other fields', () => {
    assert.equal(selectRenderer({ rule: { template: '範本', answer: '答案' } }), 'renderDirectAnswer');
  });

  it('should prioritize steps over estimation', () => {
    assert.equal(selectRenderer({ rule: { steps: ['1'], estimate: '100' } }), 'renderStepsProcedure');
  });
});

describe('renderAnswer quality gate', () => {
  it('should reject single-key classifier (room)', () => {
    const result = renderAnswer({ rule: { room: '廚房' } }, 0.8);
    assert.equal(result, null);
  });

  it('should reject single-key classifier (material)', () => {
    const result = renderAnswer({ rule: { material: 'XLPE導線' } }, 0.7);
    assert.equal(result, null);
  });

  it('should reject single-key classifier (topic)', () => {
    const result = renderAnswer({ rule: { topic: '接地電阻' } }, 0.6);
    assert.equal(result, null);
  });

  it('should reject oral:true classifier', () => {
    const result = renderAnswer({ rule: { oral: true } }, 0.5);
    assert.equal(result, null);
  });

  it('should accept long template answer', () => {
    const result = renderAnswer({
      rule: { template: '分離式冷氣迴路連工帶料$3,500/台（含5.5mm²電線+2P-20A NFB+冷氣專用插座）' },
    }, 0.9);
    assert.notEqual(result, null);
    assert.equal(result.source, 'rule');
    assert.ok(result.answer.includes('$3,500'));
  });

  it('should accept estimation with min/max and ping', () => {
    const result = renderAnswer({
      rule: { min: 50000, max: 80000, ping: 20 },
    }, 0.75);
    assert.notEqual(result, null);
    assert.ok(result.answer.includes('50,000'));
    assert.ok(result.answer.includes('80,000'));
  });

  it('should accept multi-item material list', () => {
    const result = renderAnswer({
      rule: { materials: ['110V插座點位', 'PVC導線', 'CD管'] },
    }, 0.7);
    assert.notEqual(result, null);
    assert.ok(result.answer.includes('PVC導線'));
  });

  it('should accept detailed answer text', () => {
    const result = renderAnswer({
      rule: { answer: '是，電纜價格直接受LME銅價影響', mechanism: '牌價=銅價+加工費+利潤' },
    }, 0.85);
    assert.notEqual(result, null);
    assert.ok(result.answer.includes('LME銅價'));
  });

  it('should handle stringified rule with quality gate', () => {
    const result = renderAnswer({
      rule: '{"material":"PVC導線"}',
    }, 0.6);
    assert.equal(result, null);
  });

  it('should pass stringified rule with rich content', () => {
    const result = renderAnswer({
      rule: '{"template":"全室重配線以坪數計價，約$2,500~4,000/坪（純電路）"}',
    }, 0.9);
    assert.notEqual(result, null);
    assert.ok(result.answer.includes('$2,500'));
  });

  it('should reject single gauge regulation', () => {
    const result = renderAnswer({ rule: { gauge: '2.0mm' } }, 0.6);
    assert.equal(result, null);
  });

  it('should accept rich regulation with answer+law+location', () => {
    const result = renderAnswer({
      rule: { answer: '是，法規強制要求', law: '用戶用電設備裝置規則', location: '浴室' },
    }, 0.9);
    assert.notEqual(result, null);
    assert.ok(result.answer.includes('法規強制'));
  });

  it('should accept procedure with multiple steps', () => {
    const result = renderAnswer({
      rule: { procedure: '接地工程', steps: ['開挖', '接地極安裝', '接線', '回填', '測試'] },
    }, 0.85);
    assert.notEqual(result, null);
    assert.ok(result.answer.includes('接地工程'));
  });

  it('should reject empty rule object', () => {
    const result = renderAnswer({ rule: {} }, 0.5);
    assert.equal(result, null);
  });

  it('should reject 2-key generic classifier under 40 chars', () => {
    // renderGenericRule: "spec：2.0mm²\nmaterial：PVC導線" = 26 chars, < 40
    const result = renderAnswer({ rule: { spec: '2.0mm²', material: 'PVC導線' } }, 0.8);
    assert.equal(result, null);
  });

  it('should use lower threshold for specialized renderers', () => {
    // renderEstimation: "坪數：20 坪\n範圍：50,000 ~ 80,000 元" = 28 chars, >= 25
    const result = renderAnswer({ rule: { min: 50000, max: 80000, ping: 20 } }, 0.75);
    assert.notEqual(result, null);
  });

  it('should accept unit_price+count estimation', () => {
    const result = renderAnswer({
      rule: { item: '接地棒 1.5m', unit_price: 280, count: 3 },
    }, 0.8);
    assert.notEqual(result, null);
    assert.ok(result.answer.includes('接地棒'));
    assert.ok(result.answer.includes('280'));
    assert.ok(result.answer.includes('840'));
  });

  it('should accept items+estimate with breakdown', () => {
    const result = renderAnswer({
      rule: {
        items: { '燈具': 6, '開關': 7, '110V插座': 13 },
        estimate: 27800,
      },
    }, 0.75);
    assert.notEqual(result, null);
    assert.ok(result.answer.includes('燈具'));
    assert.ok(result.answer.includes('27800'));
  });

  it('should accept work+price service quote', () => {
    const result = renderAnswer({
      rule: { work: '換一顆NFB', price: '300~500', includes: '工資+NFB' },
    }, 0.7);
    assert.notEqual(result, null);
    assert.ok(result.answer.includes('換一顆NFB'));
    assert.ok(result.answer.includes('300~500'));
    assert.ok(result.answer.includes('工資'));
  });

  it('should reject single unit_price without count (too short)', () => {
    // "冷氣專用插座：$250/個" = 14 chars, < 25 threshold
    const result = renderAnswer({
      rule: { item: '冷氣專用插座', unit_price: 250 },
    }, 0.6);
    assert.equal(result, null);
  });
});

/**
 * qa_rules 渲染引擎
 *
 * 5 + 1 fallback Renderer 覆蓋 8 大類規則：
 * 1. renderDirectAnswer   → template, pricing, regulation (有 answer/template)
 * 2. renderStepsProcedure → procedure, troubleshoot (有 steps/causes/methods)
 * 3. renderEstimation     → estimation (有 estimate/formula)
 * 4. renderRegulation     → regulation (有 law/spec/gauge)
 * 5. renderMaterialList   → scenario, selection (有 materials/scene)
 * 6. renderGenericRule    → fallback（全部）
 */

import type {
  QaRuleRow,
  RenderedAnswer,
  ScenarioRule,
  EstimationRule,
  RegulationRule,
  SelectionRule,
  PricingRule,
  ProcedureRule,
  TroubleshootRule,
  TemplateRule
} from './types';

// --- Renderer 1: 直接答案 ---

function renderDirectAnswer(row: QaRuleRow): string {
  const rule = row.rule as unknown as TemplateRule &
    PricingRule &
    RegulationRule;

  if (rule.template) {
    return rule.template;
  }

  const parts: string[] = [];
  if (rule.answer) parts.push(rule.answer);
  if (rule.mechanism) parts.push(`機制：${rule.mechanism}`);
  if (rule.trend) parts.push(`趨勢：${rule.trend}`);

  return parts.join('\n\n');
}

// --- Renderer 2: 步驟/排障 ---

function renderStepsProcedure(row: QaRuleRow): string {
  const rule = row.rule as unknown as ProcedureRule & TroubleshootRule;
  const parts: string[] = [];

  if (rule.procedure) {
    parts.push(`**${rule.procedure}**`);
  }

  if (rule.steps && rule.steps.length > 0) {
    parts.push('步驟：');
    rule.steps.forEach((step, i) => {
      parts.push(`${i + 1}. ${step}`);
    });
  }

  if (rule.causes && rule.causes.length > 0) {
    parts.push('可能原因：');
    rule.causes.forEach((cause) => {
      parts.push(`- ${cause}`);
    });
  }

  if (rule.methods && rule.methods.length > 0) {
    parts.push('處理方式：');
    rule.methods.forEach((method) => {
      parts.push(`- ${method}`);
    });
  }

  if (rule.notes) parts.push(`\n備註：${rule.notes}`);

  return parts.join('\n');
}

// --- Renderer 3: 估價 ---

function renderEstimation(row: QaRuleRow): string {
  const rule = row.rule as unknown as EstimationRule;
  const parts: string[] = [];

  // 施工報價模式：work + price + includes
  if (rule.work && rule.price) {
    const priceDisplay = rule.price.startsWith('$')
      ? rule.price
      : `$${rule.price}`;
    parts.push(`**${rule.work}：${priceDisplay}**`);
    if (rule.includes) parts.push(`含：${rule.includes}`);
    return parts.join('\n');
  }

  if (rule.method) parts.push(`計價方式：${rule.method}`);
  if (rule.formula) parts.push(`公式：${rule.formula}`);
  if (rule.unit_price_range) parts.push(`單價範圍：${rule.unit_price_range}`);
  if (rule.ping) parts.push(`坪數：${rule.ping} 坪`);

  // 項目明細模式：items { 燈具: 6, 開關: 7 } + estimate
  if (
    rule.items &&
    typeof rule.items === 'object' &&
    !Array.isArray(rule.items)
  ) {
    const entries = Object.entries(rule.items);
    if (entries.length > 0) {
      parts.push('項目明細：');
      for (const [name, qty] of entries) {
        parts.push(`- ${name} × ${qty}`);
      }
    }
  }

  // 單價×數量模式：unit_price + count + item
  if (rule.unit_price !== undefined && rule.count !== undefined) {
    const total = Math.round(rule.unit_price * rule.count);
    const itemName = rule.item || '項目';
    parts.push(
      `${itemName} × ${rule.count}，單價 $${rule.unit_price.toLocaleString()}，合計 $${total.toLocaleString()}`
    );
  } else if (rule.item && rule.unit_price !== undefined) {
    parts.push(`${rule.item}：$${rule.unit_price.toLocaleString()}/個`);
  }

  if (rule.estimate) parts.push(`**預估費用：${rule.estimate}**`);
  if (rule.panel) parts.push(`配電箱：${rule.panel}`);

  if (rule.min !== undefined && rule.max !== undefined) {
    parts.push(
      `範圍：${rule.min.toLocaleString()} ~ ${rule.max.toLocaleString()} 元`
    );
  }

  return parts.join('\n');
}

// --- Renderer 4: 法規 ---

function renderRegulation(row: QaRuleRow): string {
  const rule = row.rule as unknown as RegulationRule;
  const parts: string[] = [];

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

// --- Renderer 5: 材料/場景清單 ---

function renderMaterialList(row: QaRuleRow): string {
  const rule = row.rule as unknown as ScenarioRule & SelectionRule;
  const parts: string[] = [];

  if (rule.scene) parts.push(`場景：${rule.scene}`);
  if (rule.room) parts.push(`空間：${rule.room}`);

  if (rule.materials && rule.materials.length > 0) {
    parts.push('所需材料：');
    rule.materials.forEach((m) => {
      parts.push(`- ${m}`);
    });
  }

  if (rule.current !== undefined) parts.push(`負載電流：${rule.current}A`);
  if (rule.wire) parts.push(`建議線徑：${rule.wire}`);
  if (rule.scenario) parts.push(`應用場景：${rule.scenario}`);

  if (rule.elcb_required) {
    parts.push('\n⚠️ 需安裝漏電斷路器');
  }

  if ('notes' in row.rule && typeof row.rule.notes === 'string') {
    parts.push(`\n備註：${row.rule.notes}`);
  }

  return parts.join('\n');
}

// --- Renderer 6: 通用 fallback ---

function renderGenericRule(row: QaRuleRow): string {
  const rule = row.rule;
  const parts: string[] = [];

  for (const [key, value] of Object.entries(rule)) {
    if (Array.isArray(value)) {
      parts.push(`${key}：`);
      value.forEach((v) => parts.push(`- ${v}`));
    } else if (typeof value === 'object' && value !== null) {
      parts.push(`${key}：${JSON.stringify(value)}`);
    } else {
      parts.push(`${key}：${value}`);
    }
  }

  return parts.join('\n');
}

// --- 解析 rule（處理 JSONB 雙重編碼） ---

export function parseRule(row: QaRuleRow): QaRuleRow {
  if (typeof row.rule === 'string') {
    try {
      return { ...row, rule: JSON.parse(row.rule as unknown as string) };
    } catch {
      return row;
    }
  }
  return row;
}

// --- 路由邏輯 ---

function selectRenderer(row: QaRuleRow): (row: QaRuleRow) => string {
  const rule = row.rule;

  // 優先順序檢查 rule 欄位
  if ('template' in rule) return renderDirectAnswer;
  if ('steps' in rule || 'causes' in rule || 'methods' in rule)
    return renderStepsProcedure;
  if (
    'estimate' in rule ||
    'formula' in rule ||
    ('min' in rule && 'max' in rule) ||
    'unit_price' in rule ||
    ('work' in rule && 'price' in rule)
  )
    return renderEstimation;
  if ('gauge' in rule || 'amp' in rule || 'law' in rule || 'standard' in rule)
    return renderRegulation;
  if (
    'materials' in rule ||
    'scene' in rule ||
    'room' in rule ||
    'wire' in rule
  )
    return renderMaterialList;
  if ('answer' in rule || 'mechanism' in rule || 'trend' in rule)
    return renderDirectAnswer;

  return renderGenericRule;
}

// --- 品質閘門 ---

// renderGenericRule 只是 key-value dump，需要更多內容才算有用
const MIN_ANSWER_LENGTH = 25;
const MIN_GENERIC_ANSWER_LENGTH = 40;

// --- 公開 API ---

export function renderAnswer(
  rawRow: QaRuleRow,
  confidence: number
): RenderedAnswer | null {
  const row = parseRule(rawRow);
  const renderer = selectRenderer(row);
  const answer = renderer(row);

  // 品質閘門：過短的答案視為無效，退化到 LLM
  // renderGenericRule 的 key-value dump 需要更長才有意義
  const threshold =
    renderer === renderGenericRule
      ? MIN_GENERIC_ANSWER_LENGTH
      : MIN_ANSWER_LENGTH;

  if (answer.length < threshold) {
    return null;
  }

  return {
    answer,
    source: 'rule',
    confidence,
    ruleType: row.type,
    ruleSubtype: row.subtype,
    ruleId: row.rule_id
  };
}

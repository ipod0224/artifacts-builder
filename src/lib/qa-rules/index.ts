/**
 * qa_rules 對答規則系統
 *
 * 規則優先 + LLM fallback：
 * 1. matchRules() — 二層匹配（GIN keyword + vector cosine）
 * 2. renderAnswer() — 5 個 Renderer 根據 rule 類型產出答案
 * 3. 未命中 → 退化到現有 search + Claude synthesize
 */

export { matchRules } from './matcher';
export { renderAnswer } from './renderers';
export type {
  QaRuleRow,
  QaRuleType,
  RuleCandidate,
  RuleMatchResult,
  RenderedAnswer,
  MaterialItem
} from './types';

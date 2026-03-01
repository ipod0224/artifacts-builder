/**
 * qa_rules 對答規則系統型別定義
 */

// --- 資料庫層 ---

export interface QaRuleRow {
  id: number;
  rule_id: number;
  type: QaRuleType;
  subtype: string | null;
  query: string;
  rule: Record<string, unknown>;
  keywords: string[];
  embedding: string | null;
  created_at: string;
  updated_at: string;
}

export type QaRuleType =
  | 'scenario'
  | 'estimation'
  | 'regulation'
  | 'selection'
  | 'pricing'
  | 'procedure'
  | 'troubleshoot'
  | 'template';

// --- 匹配結果 ---

export interface RuleCandidate {
  rule: QaRuleRow;
  kwScore: number;
  vecScore: number;
  finalScore: number;
}

export interface RuleMatchResult {
  matched: boolean;
  candidates: RuleCandidate[];
  bestMatch: RuleCandidate | null;
  matchMeta: {
    queryTokens: string[];
    synonymExpanded: string[];
    kwCandidates: number;
    vecCandidates: number;
    elapsed: number;
  };
}

// --- 渲染結果 ---

export interface RenderedAnswer {
  answer: string;
  source: 'rule' | 'rule+materials' | 'llm';
  confidence: number;
  ruleType: QaRuleType;
  ruleSubtype: string | null;
  ruleId: number;
  materials?: MaterialItem[];
}

export interface MaterialItem {
  code: string;
  name: string;
  spec: string;
  unit: string;
  unitPrice: number | null;
  category: string;
}

// --- Rule 結構（各類型的 rule JSONB 欄位） ---

export interface ScenarioRule {
  scene: string;
  materials: string[];
  elcb_required?: boolean;
  notes?: string;
}

export interface EstimationRule {
  method: string;
  formula: string;
  unit_price_range: string;
  ping?: number;
  estimate: string | number;
  panel?: string;
  min?: number;
  max?: number;
  // 擴充欄位：單價×數量、項目明細、施工報價
  item?: string;
  unit_price?: number;
  count?: number;
  items?: Record<string, number>;
  work?: string;
  price?: string;
  includes?: string;
}

export interface RegulationRule {
  answer: string;
  location?: string;
  reason?: string;
  spec?: string;
  law?: string;
  gauge?: string;
  amp?: string;
  standard?: string;
}

export interface SelectionRule {
  current?: number;
  wire?: string;
  scenario?: string;
  materials?: string[];
  scene?: string;
  room?: string;
}

export interface PricingRule {
  answer?: string;
  mechanism?: string;
  trend?: string;
}

export interface ProcedureRule {
  procedure: string;
  steps: string[];
  step_count: number;
  notes?: string;
}

export interface TroubleshootRule {
  causes?: string[];
  steps?: string[];
  methods?: string[];
}

export interface TemplateRule {
  template: string;
}

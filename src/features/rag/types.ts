export interface SearchResult {
  id: string;
  content: string;
  source: string;
  similarity: number;
  chunk_idx?: number;
  doc_type?: string;
  category?: string;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  price: number;
  spec?: string;
}

export interface MaterialMatch {
  code: string;
  name: string;
  spec: string;
  unit: string;
  unit_price: number;
  category?: string;
}

export type AnswerSource = 'rule' | 'rule+materials' | 'llm' | null;

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface MatchedRule {
  ruleId: number;
  type: string;
  subtype: string | null;
  score: number;
}

export interface RagStats {
  documents: number;
  materials: number;
  qaRules: number;
}

export interface SaveMessage {
  type: 'success' | 'error';
  text: string;
}

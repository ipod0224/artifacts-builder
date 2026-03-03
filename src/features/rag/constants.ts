import type { ConfidenceLevel } from './types';

export const CONFIDENCE_CONFIG: Record<
  ConfidenceLevel,
  { color: string; label: string }
> = {
  high: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: '高度相關'
  },
  medium: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: '中度相關'
  },
  low: {
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    label: '低度相關'
  }
};

export const SOURCE_CONFIG: Record<string, { color: string; label: string }> = {
  rule: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: '規則匹配'
  },
  'rule+materials': {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: '規則+材料'
  },
  llm: {
    color:
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    label: 'AI 合成'
  }
};

export const EXAMPLE_QUERIES = [
  { label: 'EMT 導管 22mm 單價', category: '材料價格' },
  { label: '2.0mm² 電線安培容量', category: '技術規格' },
  { label: 'XLPE 和 PVC 差別', category: '材料比較' },
  { label: '管銷費率怎麼算', category: '判斷規則' },
  { label: 'NFB 怎麼選', category: '選型建議' }
] as const;

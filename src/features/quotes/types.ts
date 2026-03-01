export interface Quote {
  id: string;
  date: string | null;
  meal: '晨讀' | '午學' | '夕省' | null;
  original: string;
  originalLang: 'zh' | 'en';
  translation: string;
  source: string;
  commentary: string;
  category: 'daily' | 'naval';
  theme: string | null;
}

export interface QuoteData {
  extractedAt: string;
  count: number;
  quotes: Quote[];
}

export interface Quote {
  id: string;
  date: string | null;
  meal: '晨讀' | '午學' | '夕省' | null;
  original: string;
  originalLang: 'zh' | 'en';
  translation: string;
  source: string;
  commentary: string;
  category: 'daily' | 'book';
  theme: string | null;
  bookKey: string | null;
}

export interface BookInfo {
  key: string;
  title: string;
  titleZh: string;
  author: string;
  description: string;
  category: string;
}

export interface QuoteData {
  extractedAt: string;
  count: number;
  books: BookInfo[];
  quotes: Quote[];
}

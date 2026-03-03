import type { SourceTypeStat } from './constants';

export interface PriceSummaryData {
  totals: {
    total_items: number;
    total_categories: number;
    total_sources: number;
    last_updated: string;
  };
  categories: {
    category: string;
    count: number;
    avg_price: number;
    min_price: number;
    max_price: number;
  }[];
  sources: { source: string; count: number; categories: string[] }[];
  sourceTypes: SourceTypeStat[];
  recentUpdates: {
    category: string;
    source: string;
    count: number;
    updated_at: string;
  }[];
}

export interface PriceCompareData {
  category: string;
  sourceComparison: {
    source: string;
    item_count: number;
    avg_sell_price: number;
    avg_list_price: number;
    avg_discount: string;
    min_price: number;
    max_price: number;
    stddev_price: number;
  }[];
  specOverlap: {
    spec_label: string;
    ampere: string;
    poles: string;
    prices: {
      source: string;
      sell_price: number;
      list_price: number;
      discount: number;
    }[];
  }[];
}

export interface PriceTrendData {
  category: string;
  specCurve: {
    source: string;
    sell_price: number;
    ampere: string | null;
    size: string | null;
    spec_value: string | null;
    model: string | null;
    nominal_size: string | null;
  }[];
  distribution: { source: string; price_range: string; count: number }[];
  coverage: {
    source: string;
    total: number;
    unique_models: number;
    unique_amperes: number;
    unique_sizes: number;
  }[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface CommodityMeta {
  symbol: string;
  name: string;
  unit: string;
  color: string;
  yAxisIndex: number; // 0 = left (USD), 1 = right (index)
  impact: string; // 影響範圍
}

export const COMMODITIES: CommodityMeta[] = [
  {
    symbol: 'HG=F',
    name: '銅 COMEX',
    unit: 'USD/磅',
    color: '#2563eb',
    yAxisIndex: 0,
    impact: '電纜導體、匯流排、接地線'
  },
  {
    symbol: 'ALI=F',
    name: '鋁 COMEX',
    unit: 'USD/噸',
    color: '#ea580c',
    yAxisIndex: 0,
    impact: '鋁電纜、匯流排、散熱片'
  },
  {
    symbol: 'HRC=F',
    name: '鋼 HRC',
    unit: 'USD/短噸',
    color: '#16a34a',
    yAxisIndex: 0,
    impact: '鋼管導線管、線槽、配電箱體'
  },
  {
    symbol: 'GC=F',
    name: '黃金 COMEX',
    unit: 'USD/盎司',
    color: '#ca8a04',
    yAxisIndex: 0,
    impact: '高階接點端子、連接器鍍層'
  },
  {
    symbol: 'SI=F',
    name: '白銀 COMEX',
    unit: 'USD/盎司',
    color: '#9333ea',
    yAxisIndex: 0,
    impact: '接點端子、繼電器觸點'
  },
  {
    symbol: 'TIO=F',
    name: '鐵礦砂 SGX',
    unit: 'USD/噸',
    color: '#b91c1c',
    yAxisIndex: 0,
    impact: '鋼材原料、結構支撐、盤體'
  },
  {
    symbol: 'ZN=F',
    name: '鋅 LME',
    unit: 'USD/噸',
    color: '#0891b2',
    yAxisIndex: 0,
    impact: '鍍鋅鋼管 EMT/厚壁管、防鏽塗層'
  },
  {
    symbol: 'CL=F',
    name: '原油 WTI',
    unit: 'USD/桶',
    color: '#374151',
    yAxisIndex: 0,
    impact: 'PE/XLPE 絕緣料、PVC 原料、運輸成本'
  },
  {
    symbol: 'WPU066',
    name: 'PVC 樹脂 PPI',
    unit: '指數',
    color: '#64748b',
    yAxisIndex: 1,
    impact: 'PVC 管、電線絕緣被覆、線槽'
  }
];

export const PERIOD_OPTIONS = [
  { label: '30 天', value: '30' },
  { label: '90 天', value: '90' },
  { label: '180 天', value: '180' },
  { label: '1 年', value: '365' },
  { label: '5 年', value: '1825' }
] as const;

export interface LatestPrice {
  symbol: string;
  name: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
  unit: string;
}

export interface PriceChange {
  symbol: string;
  name: string;
  unit: string;
  latest: { date: string; price: number };
  changes: Record<
    '1d' | '1w' | '1m' | '3m' | '1y',
    {
      from: { date: string; price: number };
      to: { date: string; price: number };
      change: number;
      pct: number;
    } | null
  >;
}

export interface HistoryRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoryResponse {
  symbol: string;
  name: string;
  unit: string;
  count: number;
  rows: HistoryRow[];
}

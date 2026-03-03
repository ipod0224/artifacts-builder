/** TCC 曲線常數與型別定義 */

export interface TccPoint {
  current_pct: number;
  time_s: number;
}

export interface TccGroup {
  models: string[];
  min_curve: TccPoint[];
  max_curve: TccPoint[];
}

export type TccData = Record<string, TccGroup>;

export interface TccApiResponse {
  success: boolean;
  data?: {
    groups: TccData;
    meta: {
      totalGroups: number;
      totalModels: number;
      totalPoints: number;
    };
  };
  error?: string;
}

/** MCCB 組別（15 組，BM/BL 系列）*/
export const MCCB_GROUPS = [
  'BM30-CN',
  'BM30-SN',
  'BM50-CN_BM100-MN',
  'BM60-SN',
  'BM100-SN',
  'BM60-HBN_BM100-HN',
  'BM100-H',
  'BM125-SN',
  'BM100-HBN_BM160-HB',
  'BM160-SN_BM250',
  'BM400',
  'BM630',
  'BM800',
  'BM1000_BM1200',
  'BM1600'
] as const;

/** MCB 組別（7 組，BH/BHA/BHL/BHN 系列）*/
export const MCB_GROUPS = [
  'MCB_15-50A',
  'MCB_60-100A',
  'BHA_C-type',
  'BHA_D-type',
  'BHA_DC',
  'BHA_80-100A_C-type',
  'BHA_80-100A_D-type'
] as const;

/** 組別中文標籤 */
export const GROUP_LABELS: Record<string, string> = {
  'BM30-CN': 'BM30-CN (30AF 標準)',
  'BM30-SN': 'BM30-SN (30AF 高斷)',
  'BM50-CN_BM100-MN': 'BM50-CN / BM100-MN',
  'BM60-SN': 'BM60-SN / BM60-HN / BL50-SN',
  'BM100-SN': 'BM100-SN (100AF 標準)',
  'BM60-HBN_BM100-HN': 'BM60-HBN / BM100-HN / BL100',
  'BM100-H': 'BM100-H / HC / HS',
  'BM125-SN': 'BM125-SN / BM125-HN',
  'BM100-HBN_BM160-HB': 'BM100-HBN / BM160-HB / BM250-HB',
  'BM160-SN_BM250': 'BM160-SN / BM250 / BL160 / BL250',
  BM400: 'BM400 / BL400 (400AF)',
  BM630: 'BM630 / BL630 (630AF)',
  BM800: 'BM800 / BL800 (800AF)',
  BM1000_BM1200: 'BM1000 / BM1200',
  BM1600: 'BM1600',
  'MCB_15-50A': 'MCB 15-50A (BH/BPH/BKH)',
  'MCB_60-100A': 'MCB 60-100A (BL/BLH/BLS)',
  'BHA_C-type': 'BHA/BHL/BHN C-type',
  'BHA_D-type': 'BHA/BHL/BHN D-type',
  BHA_DC: 'BHA DC',
  'BHA_80-100A_C-type': 'BHA 80-100A C-type',
  'BHA_80-100A_D-type': 'BHA 80-100A D-type'
};

/** 每組固定顏色（最多 4 組疊圖時不重複）*/
export const GROUP_COLORS = [
  '#2563eb', // blue-600
  '#dc2626', // red-600
  '#16a34a', // green-600
  '#ea580c' // orange-600
] as const;

/** 最多同時疊圖組數 */
export const MAX_OVERLAY = 4;

import { z } from 'zod';

export const ALLOWED_CATEGORIES = [
  'cable',
  'nfb',
  'leakagebreaker',
  'contactor',
  'transformer',
  'emt-conduit',
  'emt-fitting',
  'pvc-pipe',
  'pvc-fitting',
  'rsg-conduit',
  'stainlesspipe',
  'stainlessfitting',
  'acb',
  'motor-starter',
  'thermal-relay'
] as const;

export type PriceCategory = (typeof ALLOWED_CATEGORIES)[number];

export const categorySchema = z.enum(ALLOWED_CATEGORIES);

export const CATEGORY_LABELS: Record<PriceCategory, string> = {
  cable: '電纜',
  nfb: 'NFB 無熔線斷路器',
  leakagebreaker: '漏電斷路器',
  contactor: '電磁接觸器',
  transformer: '變壓器',
  'emt-conduit': 'EMT 導管',
  'emt-fitting': 'EMT 另件',
  'pvc-pipe': 'PVC 管',
  'pvc-fitting': 'PVC 另件',
  'rsg-conduit': 'RSG 導管',
  stainlesspipe: '不鏽鋼管',
  stainlessfitting: '不鏽鋼另件',
  acb: 'ACB 氣體斷路器',
  'motor-starter': '電磁開關',
  'thermal-relay': '熱動過載電驛'
};

export interface SourceTypeStat {
  source_type: string;
  count: number;
  sources: number;
  categories: number;
  avg_price: number;
  last_sync: string;
}

/**
 * Interactive spec dimensions per category.
 * Order matters — user selects from left to right (coarse → fine).
 *
 * 維度來源依據：
 * - cable:          JC-158 canonical (type/cores/mm²) + CNS 2655/679/3301
 * - nfb:            JC-47 選型速查 (poles→AF→AT→Icu) + JC-158 scoreNfb
 * - leakagebreaker: JC-47 (同 nfb + sensitivity_ma) + JC-158
 * - contactor:      JC-146 接觸器定價 + JC-158 canonical (rated_current_a)
 * - thermal-relay:  JC-158 canonical (current_range/max_current_a)
 * - transformer:    JC-72 降壓變壓器 + JC-158 canonical (type/kva)
 * - emt-conduit:    JC-37a 管材 TCRI + JC-149 規則 7 (nominalSize)
 * - emt-fitting:    JC-149 規則 6 (fittingType) + JC-37a
 * - pvc-pipe:       JC-149 規則 3 (pipeType) + JC-37a
 * - rsg-conduit:    JC-37a (nominalSize)
 * - stainlesspipe:  JC-158 canonical (grade/size_mm/schedule)
 * - pvc-fitting:    萬蕙昇 specs (fittingType/spec)
 * - stainlessfitting: 萬蕙昇 specs (fittingType/spec)
 *
 * 注意：
 * - nfb/leakagebreaker 的 ampere 存為 JSON 陣列（一筆=一框架），
 *   不適合按鈕篩選，需 D2 技術債（JC-156）解決後才加入
 * - ic_ka 存為巢狀 JSON {"220V":10,"380V":7.5}，同理暫不加入
 * - series 為製造商產品線（JC-47 型號對照），品牌特定非通用規格，
 *   已從篩選維度移除（會鎖死單一通路），改為結果表顯示欄位
 * - motor-starter/acb 資料不足（30/12 筆，僅單通路），暫不定義
 */
export interface SpecDimension {
  key: string;
  label: string;
}

export const SPEC_DIMENSIONS: Partial<Record<PriceCategory, SpecDimension[]>> =
  {
    // JC-47: poles → frame_af → rated_at
    // DB 覆蓋: poles 739/739 (CTE 正則 100%), frame_af 689/739 (CTE 93.1%)
    // rated_at: TCRI/PCIC name regex + 朝立/東元/三菱 ampere JSON 陣列展開
    // series 移至結果表顯示（品牌專屬，放篩選會鎖死單一通路）
    nfb: [
      { key: 'poles', label: '極數' },
      { key: 'frame_af', label: '框架(AF)' },
      { key: 'rated_at', label: '額定電流(AT)' }
    ],
    // JC-47 + JC-158: poles → sensitivity_ma → frame_af
    // series 移至結果表顯示
    leakagebreaker: [
      { key: 'poles', label: '極數' },
      { key: 'sensitivity_ma', label: '感度(mA)' },
      { key: 'frame_af', label: '框架(AF)' }
    ],
    // JC-146 + JC-158: rated_current_a 為 canonical 唯一有效維度
    // series 移至結果表顯示 (S-T/CN/CU)
    contactor: [{ key: 'rated_current_a', label: '額定電流(A)' }],
    // JC-158 canonical + CNS 2655/679: type → cores → spec(mm²)
    cable: [
      { key: 'type', label: '種類' },
      { key: 'cores', label: '芯數' },
      { key: 'spec', label: '線徑' }
    ],
    // JC-72 + JC-158: type(dry/oil) → capacityKVA
    transformer: [
      { key: 'type', label: '型式' },
      { key: 'capacityKVA', label: '容量(kVA)' }
    ],
    // JC-158 canonical: current_range + max_current_a
    // DB: current_range 21/80, rated_current_a 59/80, series 80/80
    'thermal-relay': [
      { key: 'rated_current_a', label: '額定電流(A)' },
      { key: 'current_range', label: '電流範圍' }
    ],
    // JC-37a + JC-149 規則 7: nominalSize (英制)
    'emt-conduit': [{ key: 'nominalSize', label: '管徑' }],
    // JC-149 規則 6 + JC-37a: fittingType → nominalSize
    'emt-fitting': [
      { key: 'fittingType', label: '另件種類' },
      { key: 'nominalSize', label: '管徑' }
    ],
    // JC-149 規則 3 + JC-37a: pipeType(A/E) → nominalSize(mm)
    'pvc-pipe': [
      { key: 'pipeType', label: '管種' },
      { key: 'nominalSize', label: '管徑' }
    ],
    // JC-37a: nominalSize
    'rsg-conduit': [{ key: 'nominalSize', label: '管徑' }],
    // JC-158 canonical: grade(304/316) → size(mm) → thickness
    // TCRI/PCIC 用 JIS 標稱 mm、萬蕙昇 用不同 mm，CTE 統一轉英制
    stainlesspipe: [{ key: 'size', label: '管徑' }],
    // 萬蕙昇 specs: fittingType (5 種) → spec (管徑+角度)
    // 515 筆單通路，fittingType 為粗篩維度
    'pvc-fitting': [
      { key: 'fittingType', label: '另件種類' },
      { key: 'spec', label: '規格' }
    ],
    // 萬蕙昇 specs: fittingType (5 種) → spec (JIS mm 管徑)
    // 142 筆單通路
    stainlessfitting: [
      { key: 'fittingType', label: '另件種類' },
      { key: 'spec', label: '規格' }
    ]
  };

/** Short labels for compact display (e.g., coverage matrix) */
export const CATEGORY_SHORT_LABELS: Record<PriceCategory, string> = {
  cable: '電纜',
  nfb: 'NFB',
  leakagebreaker: '漏電',
  contactor: '接觸器',
  transformer: '變壓器',
  'emt-conduit': 'EMT 管',
  'emt-fitting': 'EMT 件',
  'pvc-pipe': 'PVC 管',
  'pvc-fitting': 'PVC 件',
  'rsg-conduit': 'RSG 管',
  stainlesspipe: '不鏽鋼管',
  stainlessfitting: '不鏽鋼件',
  acb: 'ACB',
  'motor-starter': '電磁開關',
  'thermal-relay': '熱動電驛'
};

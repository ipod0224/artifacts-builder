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

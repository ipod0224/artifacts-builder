#!/usr/bin/env node
/**
 * RAG 訓練資料集生成器
 * 目標：從 500 題擴展到 10,000 題
 *
 * 類別分佈：
 *   1. scenario     場景→材料推薦組合     2,000 題
 *   2. estimation   估價公式/計算         1,500 題
 *   3. regulation   法規安全              1,500 題
 *   4. selection    材料選型              1,500 題
 *   5. pricing      價格趨勢/市場因素      1,000 題
 *   6. procedure    施工工序               1,000 題
 *   7. troubleshoot 故障排除                500 題
 *   8. template     回答模板                500 題
 *
 * 用法：node tests/generate-training-data.mjs
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ========================================
// 基礎資料（來自 DB + 研究）
// ========================================

const MATERIALS = {
  wires: {
    pvc: [
      { code: 'W-PVC-1.6', name: 'PVC導線', spec: '1.6mm²', price: 8, amp_pvc: 13, amp_xlpe: null },
      { code: 'W-PVC-2.0', name: 'PVC導線', spec: '2.0mm²', price: 10, amp_pvc: 18, amp_xlpe: null },
      { code: 'W-PVC-2.6', name: 'PVC導線', spec: '2.6mm²', price: 15, amp_pvc: 24, amp_xlpe: null },
      { code: 'W-PVC-5.5', name: 'PVC導線', spec: '5.5mm²', price: 28, amp_pvc: 25, amp_xlpe: null },
    ],
    xlpe: [
      { code: 'W-XLPE-1.6', name: 'XLPE導線', spec: '1.6mm²', price: 12, amp_pvc: null, amp_xlpe: 24 },
      { code: 'W-XLPE-2.0', name: 'XLPE導線', spec: '2.0mm²', price: 15, amp_pvc: null, amp_xlpe: 28 },
      { code: 'W-XLPE-2.6', name: 'XLPE導線', spec: '2.6mm²', price: 22, amp_pvc: null, amp_xlpe: 39 },
      { code: 'W-XLPE-3.5', name: 'XLPE導線', spec: '3.5mm²', price: 28, amp_pvc: null, amp_xlpe: 30 },
      { code: 'W-XLPE-5.5', name: 'XLPE導線', spec: '5.5mm²', price: 38, amp_pvc: null, amp_xlpe: 39 },
      { code: 'W-XLPE-8.0', name: 'XLPE導線', spec: '8.0mm²', price: 55, amp_pvc: null, amp_xlpe: 51 },
      { code: 'W-XLPE-14', name: 'XLPE導線', spec: '14mm²', price: 95, amp_pvc: null, amp_xlpe: 74 },
      { code: 'W-XLPE-22', name: 'XLPE導線', spec: '22mm²', price: 145, amp_pvc: null, amp_xlpe: 90 },
      { code: 'W-XLPE-30', name: 'XLPE導線', spec: '30mm²', price: 195, amp_pvc: null, amp_xlpe: 105 },
      { code: 'W-XLPE-38', name: 'XLPE導線', spec: '38mm²', price: 250, amp_pvc: null, amp_xlpe: 120 },
      { code: 'W-XLPE-50', name: 'XLPE導線', spec: '50mm²', price: 320, amp_pvc: null, amp_xlpe: 140 },
    ],
    ground: [
      { code: 'W-GND-1.6', name: '接地線(綠)', spec: '1.6mm²', price: 10 },
      { code: 'W-GND-2.0', name: '接地線(綠)', spec: '2.0mm²', price: 12 },
      { code: 'W-GND-5.5', name: '接地線(綠)', spec: '5.5mm²', price: 32 },
      { code: 'W-GND-8.0', name: '接地線(綠)', spec: '8.0mm²', price: 48 },
      { code: 'W-GND-14', name: '接地線(綠)', spec: '14mm²', price: 85 },
    ],
  },
  breakers: {
    nfb: [
      { code: 'NFB-1P-15', spec: '1P 15A', price: 120, poles: 1, amps: 15 },
      { code: 'NFB-1P-20', spec: '1P 20A', price: 130, poles: 1, amps: 20 },
      { code: 'NFB-1P-30', spec: '1P 30A', price: 150, poles: 1, amps: 30 },
      { code: 'NFB-2P-15', spec: '2P 15A', price: 280, poles: 2, amps: 15 },
      { code: 'NFB-2P-20', spec: '2P 20A', price: 300, poles: 2, amps: 20 },
      { code: 'NFB-2P-30', spec: '2P 30A', price: 350, poles: 2, amps: 30 },
      { code: 'NFB-2P-50', spec: '2P 50A', price: 480, poles: 2, amps: 50 },
      { code: 'NFB-2P-75', spec: '2P 75A', price: 650, poles: 2, amps: 75 },
      { code: 'NFB-2P-100', spec: '2P 100A', price: 850, poles: 2, amps: 100 },
      { code: 'NFB-3P-30', spec: '3P 30A', price: 520, poles: 3, amps: 30 },
      { code: 'NFB-3P-50', spec: '3P 50A', price: 680, poles: 3, amps: 50 },
      { code: 'NFB-3P-75', spec: '3P 75A', price: 880, poles: 3, amps: 75 },
      { code: 'NFB-3P-100', spec: '3P 100A', price: 1200, poles: 3, amps: 100 },
    ],
    elcb: [
      { code: 'ELCB-1P-20-30mA', spec: '1P 20A 30mA', price: 420, poles: 1, amps: 20 },
      { code: 'ELCB-2P-20-30mA', spec: '2P 20A 30mA', price: 595, poles: 2, amps: 20 },
      { code: 'ELCB-2P-30-30mA', spec: '2P 30A 30mA', price: 650, poles: 2, amps: 30 },
      { code: 'ELCB-2P-50-30mA', spec: '2P 50A 30mA', price: 850, poles: 2, amps: 50 },
      { code: 'ELCB-2P-75-30mA', spec: '2P 75A 30mA', price: 1200, poles: 2, amps: 75 },
      { code: 'ELCB-3P-50-30mA', spec: '3P 50A 30mA', price: 1500, poles: 3, amps: 50 },
      { code: 'ELCB-3P-100-30mA', spec: '3P 100A 30mA', price: 2400, poles: 3, amps: 100 },
    ],
  },
  conduits: [
    { code: 'CD-16', name: 'CD管(波浪管)', spec: '16mm', price: 12, type: 'CD' },
    { code: 'CD-22', name: 'CD管(波浪管)', spec: '22mm', price: 18, type: 'CD' },
    { code: 'PVC-16', name: 'PVC導線管', spec: '16mm', price: 15, type: 'PVC' },
    { code: 'PVC-22', name: 'PVC導線管', spec: '22mm', price: 22, type: 'PVC' },
    { code: 'PVC-28', name: 'PVC導線管', spec: '28mm', price: 32, type: 'PVC' },
    { code: 'EMT-16', name: 'EMT金屬導線管', spec: '16mm', price: 45, type: 'EMT' },
    { code: 'EMT-22', name: 'EMT金屬導線管', spec: '22mm', price: 60, type: 'EMT' },
    { code: 'EMT-28', name: 'EMT金屬導線管', spec: '28mm', price: 85, type: 'EMT' },
  ],
  panels: [
    { code: 'PNL-4', spec: '4迴路', price: 800 },
    { code: 'PNL-6', spec: '6迴路', price: 1000 },
    { code: 'PNL-8', spec: '8迴路', price: 1200 },
    { code: 'PNL-12', spec: '12迴路', price: 1600 },
    { code: 'PNL-16', spec: '16迴路', price: 2000 },
    { code: 'PNL-20', spec: '20迴路', price: 2500 },
    { code: 'PNL-24', spec: '24迴路', price: 3000 },
  ],
  unit_costs: [
    { code: 'UC-OUTLET-110', name: '110V插座點位', price: 1200, unit: '點' },
    { code: 'UC-OUTLET-220', name: '220V專用點位', price: 1800, unit: '點' },
    { code: 'UC-SWITCH', name: '開關點位', price: 900, unit: '點' },
    { code: 'UC-LIGHT', name: '燈具點位', price: 800, unit: '點' },
    { code: 'UC-REWIRE-M2', name: '全室重配線', price: 3500, unit: '坪' },
    { code: 'UC-AC-SPLIT', name: '分離式冷氣迴路', price: 3500, unit: '台' },
    { code: 'UC-AC-WINDOW', name: '窗型冷氣迴路', price: 2500, unit: '台' },
    { code: 'UC-HEATER', name: '電熱水器迴路', price: 4000, unit: '台' },
    { code: 'UC-HEATER-I', name: '即熱式熱水器迴路', price: 5500, unit: '台' },
    { code: 'UC-PANEL-NEW', name: '新設配電箱', price: 8000, unit: '座' },
    { code: 'UC-PANEL-EXP', name: '配電箱擴充', price: 1500, unit: '迴路' },
  ],
  boxes: [
    { code: 'BOX-8', name: '八角盒', price: 45 },
    { code: 'BOX-4', name: '四角盒', price: 35 },
    { code: 'BOX-PB', name: '拉線盒', price: 120 },
    { code: 'BOX-JCT', name: '接線盒', price: 60 },
  ],
  grounding: [
    { code: 'GND-ROD-6', name: '接地棒', spec: 'φ16 x 1.5m', price: 280 },
    { code: 'GND-ROD-8', name: '接地棒', spec: 'φ16 x 2.4m', price: 420 },
    { code: 'GND-CLAMP', name: '接地夾', price: 85 },
    { code: 'GND-PLATE', name: '接地端子板', price: 150 },
  ],
  switches: [
    { code: 'SW-1', name: '單切開關', price: 60 },
    { code: 'SW-2', name: '雙切開關', price: 90 },
    { code: 'SW-3', name: '三切開關', price: 120 },
    { code: 'SW-3W', name: '三路開關', price: 100 },
    { code: 'SW-DIM', name: '調光開關', price: 350 },
    { code: 'OUT-1G', name: '單插座', price: 80 },
    { code: 'OUT-2G', name: '雙插座', price: 120 },
    { code: 'OUT-3G', name: '三插座', price: 180 },
    { code: 'OUT-220', name: '冷氣專用插座', price: 250 },
    { code: 'OUT-GND', name: '接地型插座', price: 150 },
  ],
  labor: [
    { code: 'L-HELP', name: '小工', spec: '助手', price: 250, unit: 'hr' },
    { code: 'L-HELP-DAY', name: '小工', spec: '日薪', price: 1800, unit: 'day' },
    { code: 'L-TECH', name: '電氣技工', spec: '中級師傅', price: 350, unit: 'hr' },
    { code: 'L-TECH-DAY', name: '電氣技工', spec: '日薪(中級)', price: 2500, unit: 'day' },
    { code: 'L-ELEC', name: '電氣技師', spec: '持照乙級', price: 500, unit: 'hr' },
    { code: 'L-ELEC-DAY', name: '電氣技師', spec: '日薪(持照)', price: 3500, unit: 'day' },
  ],
  fees: [
    { code: 'FEE-SAFETY', name: '安全防護', price: 200 },
    { code: 'FEE-SITE-DAY', name: '工地管理', price: 4000, unit: 'day' },
    { code: 'FEE-WASTE', name: '廢棄物清運', price: 300 },
    { code: 'FEE-INSP', name: '檢驗費', spec: '竣工檢驗', price: 1500 },
    { code: 'FEE-INSP-H', name: '檢驗費', spec: '複雜檢驗', price: 2500 },
    { code: 'FEE-DESIGN-S', name: '設計費', spec: '簡單', price: 500 },
    { code: 'FEE-DESIGN-M', name: '設計費', spec: '中等', price: 1000 },
    { code: 'FEE-DESIGN-C', name: '設計費', spec: '複雜', price: 2000 },
    { code: 'FEE-TRANS', name: '運輸費', price: 500 },
  ],
};

// 載流量對照表
const AMPACITY_TABLE = {
  '1.6mm': { pvc60: 13, xlpe90: 24 },
  '2.0mm': { pvc60: 18, xlpe90: 28 },
  '2.6mm': { pvc60: 24, xlpe90: 39 },
  '3.5mm²': { pvc60: 19, xlpe90: 30 },
  '5.5mm²': { pvc60: 25, xlpe90: 39 },
  '8mm²': { pvc60: 33, xlpe90: 51 },
  '14mm²': { pvc60: 43, xlpe90: 74 },
  '22mm²': { pvc60: 57, xlpe90: 90 },
  '30mm²': { pvc60: 66, xlpe90: 105 },
  '38mm²': { pvc60: 76, xlpe90: 120 },
  '50mm²': { pvc60: 100, xlpe90: 140 },
};

// NFB 搭配線徑對照
const NFB_WIRE_MAP = [
  { amps: 15, wire: '1.6mm', wire_mm2: '1.6' },
  { amps: 20, wire: '2.0mm', wire_mm2: '2.0' },
  { amps: 30, wire: '2.6mm 或 5.5mm²', wire_mm2: '5.5' },
  { amps: 50, wire: '14mm²', wire_mm2: '14' },
  { amps: 75, wire: '22mm²', wire_mm2: '22' },
  { amps: 100, wire: '38mm²', wire_mm2: '38' },
];

// 管內穿線數
const CONDUIT_CAPACITY = {
  '16mm': { '2.0mm': 4, '5.5mm²': 2 },
  '22mm': { '2.0mm': 7, '5.5mm²': 4 },
  '28mm': { '2.0mm': 12, '5.5mm²': 6 },
};

// 場景配置
const SCENARIOS = {
  廚房: {
    materials: ['110V插座點位', '220V專用點位', '漏電斷路器', '無熔絲斷路器', 'PVC導線', 'XLPE導線'],
    circuits_110v: '1~2', circuits_220v: '2~3', outlets: '6~12',
    elcb_required: true,
    notes: '流理台附近插座強制ELCB，IH爐/烤箱/洗碗機各需220V專用迴路',
  },
  浴室: {
    materials: ['漏電斷路器', '接地型插座', '燈具點位', 'XLPE導線', 'PVC導線'],
    circuits_110v: '1', circuits_220v: '1~2',
    elcb_required: true,
    notes: '全部插座分路強制ELCB，防水插座IP44以上',
  },
  臥室: {
    materials: ['110V插座點位', '開關點位', '燈具點位', 'PVC導線', '三路開關'],
    circuits_110v: '1', circuits_220v: '1(冷氣)',
    outlets: '4~6',
    notes: '床頭雙控三路開關，冷氣獨立迴路',
  },
  客廳: {
    materials: ['110V插座點位', '開關點位', '燈具點位', 'PVC導線', '調光開關'],
    circuits_110v: '2', circuits_220v: '1(冷氣)',
    outlets: '6~10',
    notes: '電視牆集中插座，主燈調光開關',
  },
  陽台: {
    materials: ['110V插座點位', '漏電斷路器', '燈具點位', 'EMT金屬導線管'],
    elcb_required: true,
    notes: '戶外插座強制ELCB，配管建議EMT防潮',
  },
  地下室: {
    materials: ['EMT金屬導線管', '漏電斷路器', '接地棒', '燈具點位'],
    elcb_required: true,
    notes: '潮濕環境用EMT管，加強接地系統',
  },
  頂樓加蓋: {
    materials: ['配電箱', '全室重配線', 'EMT金屬導線管', '漏電斷路器', '接地棒'],
    notes: '需獨立配電箱，戶外管路用EMT',
  },
  辦公室: {
    materials: ['配電箱', '110V插座點位', '燈具點位', 'PVC導線管'],
    circuits_110v: '6~10', outlets: '20~30',
    notes: '插座密度高，注意迴路分配平衡',
  },
  店面: {
    materials: ['配電箱', '110V插座點位', '220V專用點位', '燈具點位', 'EMT金屬導線管'],
    notes: '招牌需ELCB，大功率設備需220V專用迴路',
  },
};

// 住宅規模與迴路數建議
const HOUSE_SIZES = [
  { ping: 15, rooms: '1房1廳', circuits: '8~10', panel: '12迴路' },
  { ping: 20, rooms: '2房1廳', circuits: '10~14', panel: '16迴路' },
  { ping: 25, rooms: '2房2廳', circuits: '12~16', panel: '16迴路' },
  { ping: 30, rooms: '3房2廳', circuits: '15~20', panel: '20迴路' },
  { ping: 35, rooms: '3房2廳', circuits: '16~22', panel: '20迴路' },
  { ping: 40, rooms: '4房2廳', circuits: '18~24', panel: '24迴路' },
  { ping: 50, rooms: '4房2廳', circuits: '20~28', panel: '24迴路' },
];

// 品牌資料
const BRANDS = {
  cable: ['華新麗華', '太平洋', '大亞', '大山', '華榮'],
  nfb: ['士林電機', '東元', '三菱電機', 'ABB', '施耐德'],
  switch: ['國際牌(Panasonic)', '中一電工', '施耐德(Schneider)', 'Legrand'],
  conduit_pvc: ['南亞塑膠', '春風企業'],
  conduit_emt: ['光南鋼鐵', '樺晟', '申芳'],
};

// 常見電器功率
const APPLIANCES = [
  { name: '窗型冷氣', watt: 900, volt: 110 },
  { name: '分離式冷氣(小)', watt: 1200, volt: 220 },
  { name: '分離式冷氣(大)', watt: 2500, volt: 220 },
  { name: '電熱水器', watt: 3000, volt: 220 },
  { name: '即熱式電熱水器', watt: 8000, volt: 220 },
  { name: '微波爐', watt: 1200, volt: 110 },
  { name: '電鍋', watt: 800, volt: 110 },
  { name: '烤箱', watt: 1500, volt: 220 },
  { name: 'IH爐', watt: 2000, volt: 220 },
  { name: '洗碗機', watt: 1800, volt: 220 },
  { name: '烘衣機', watt: 2500, volt: 220 },
  { name: '洗衣機', watt: 500, volt: 110 },
  { name: '冰箱', watt: 150, volt: 110 },
  { name: '吹風機', watt: 1200, volt: 110 },
  { name: '電磁爐', watt: 1300, volt: 220 },
  { name: '快煮壺', watt: 1500, volt: 110 },
  { name: '除濕機', watt: 300, volt: 110 },
  { name: '電暖器', watt: 1200, volt: 110 },
];

// ========================================
// 題目生成器
// ========================================

let nextId = 501; // 從 501 開始（前 500 已有）

function genId() {
  return nextId++;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function range(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- 1. 場景推薦題 ----
function generateScenarioQuestions() {
  const questions = [];
  const scenes = Object.keys(SCENARIOS);
  const queryTemplates = [
    (s) => `${s}需要哪些水電材料？`,
    (s) => `裝修${s}的電路要準備什麼？`,
    (s) => `${s}配電需要用到哪些東西？`,
    (s) => `${s}水電工程材料清單`,
    (s) => `新裝${s}電路要買什麼材料？`,
    (s) => `${s}電氣工程需要哪些建材？`,
    (s) => `${s}配線材料有哪些？`,
    (s) => `我要裝修${s}，電料要準備什麼？`,
    (s) => `${s}的電路配置需要什麼材料？`,
    (s) => `幫我列${s}的水電材料`,
  ];

  // 每場景 × 多種問法
  for (const scene of scenes) {
    const info = SCENARIOS[scene];
    for (let i = 0; i < 15; i++) {
      const tmpl = queryTemplates[i % queryTemplates.length];
      questions.push({
        id: genId(),
        type: 'scenario',
        subtype: 'room_materials',
        query: tmpl(scene),
        rule: {
          scene,
          materials: info.materials,
          elcb_required: info.elcb_required || false,
          notes: info.notes,
        },
        keywords: [scene, ...info.materials.slice(0, 3)],
        expect_materials_gte: 2,
      });
    }
  }

  // 組合場景
  const combos = [
    { rooms: ['廚房', '浴室'], query_templates: [
      '廚房和浴室的水電材料差異？',
      '廚房浴室各需要什麼電路配置？',
      '濕區（廚房浴室）的配電要注意什麼？',
    ]},
    { rooms: ['臥室', '客廳'], query_templates: [
      '臥室客廳的插座開關怎麼配？',
      '客廳和臥室的電路規劃差異',
      '一般起居空間需要多少插座？',
    ]},
    { rooms: ['陽台', '頂樓加蓋'], query_templates: [
      '陽台和頂樓的配電有什麼要注意的？',
      '戶外空間的電路安全規範',
      '露天區域的配線要用什麼管材？',
    ]},
  ];

  for (const combo of combos) {
    for (const q of combo.query_templates) {
      const allMats = [...new Set(combo.rooms.flatMap(r => SCENARIOS[r].materials))];
      questions.push({
        id: genId(),
        type: 'scenario',
        subtype: 'room_combo',
        query: q,
        rule: {
          scenes: combo.rooms,
          materials: allMats,
        },
        keywords: [...combo.rooms, ...allMats.slice(0, 3)],
        expect_materials_gte: 3,
      });
    }
  }

  // 冷氣場景
  const acQueries = [
    '裝冷氣需要什麼電料？',
    '冷氣專用迴路需要哪些材料？',
    '窗型冷氣和分離式冷氣的配電差異',
    '一台冷氣需要拉什麼線？',
    '冷氣電源線要用多粗的？',
    '安裝冷氣要準備什麼？',
    '冷氣迴路的NFB要用幾安培？',
    '冷氣插座要用什麼規格？',
    '分離式冷氣需要220V嗎？',
    '冷氣要用XLPE還是PVC線？',
  ];
  for (const q of acQueries) {
    questions.push({
      id: genId(),
      type: 'scenario',
      subtype: 'ac_circuit',
      query: q,
      rule: {
        scene: '冷氣迴路',
        wire: '5.5mm² (XLPE或PVC)',
        nfb: '2P-20A (220V) 或 1P-20A (110V)',
        outlet: '冷氣專用插座 220V T型',
        conduit: '22mm PVC管或CD管',
      },
      keywords: ['冷氣', '迴路', '5.5mm²'],
      expect_materials_gte: 2,
    });
  }

  // 電熱水器場景
  const heaterQueries = [
    '電熱水器需要什麼電路配置？',
    '即熱式電熱水器要用多粗的線？',
    '裝電熱水器的配電要注意什麼？',
    '電熱水器一定要裝漏電斷路器嗎？',
    '電熱水器迴路的材料清單',
    '儲熱式和即熱式電熱水器的電路差異',
    '電熱水器用的NFB要幾安培？',
    '浴室電熱水器的配線規格',
  ];
  for (const q of heaterQueries) {
    questions.push({
      id: genId(),
      type: 'scenario',
      subtype: 'heater_circuit',
      query: q,
      rule: {
        scene: '電熱水器迴路',
        储熱式: { wire: '5.5mm²', nfb: '2P-30A', elcb: '2P-30A 30mA' },
        即熱式: { wire: '8mm² 以上', nfb: '2P-50A', elcb: '2P-50A 30mA' },
        elcb_required: true,
      },
      keywords: ['電熱水器', '迴路', '漏電'],
      expect_materials_gte: 2,
    });
  }

  // 全室重配線場景
  for (const h of HOUSE_SIZES) {
    const queries = [
      `${h.ping}坪${h.rooms}全室重配線需要什麼？`,
      `${h.ping}坪的房子重拉電線要準備哪些材料？`,
      `${h.rooms}老屋翻修的配電規劃`,
      `${h.ping}坪住宅的迴路數要幾迴？`,
    ];
    for (const q of queries) {
      questions.push({
        id: genId(),
        type: 'scenario',
        subtype: 'full_rewire',
        query: q,
        rule: {
          ping: h.ping,
          rooms: h.rooms,
          circuits: h.circuits,
          panel: h.panel,
          materials: ['配電箱', 'PVC導線', 'CD管', '無熔絲斷路器', '漏電斷路器', '開關', '插座'],
        },
        keywords: ['配電箱', '重配線', h.rooms],
        expect_materials_gte: 3,
      });
    }
  }

  // 電器 → 迴路需求
  for (const app of APPLIANCES) {
    const amp = (app.watt / app.volt).toFixed(1);
    questions.push({
      id: genId(),
      type: 'scenario',
      subtype: 'appliance_circuit',
      query: `${app.name}需要什麼電路？`,
      rule: {
        appliance: app.name,
        watt: app.watt,
        volt: app.volt,
        amp: parseFloat(amp),
        dedicated_circuit: app.watt > 1000,
      },
      keywords: [app.name, `${app.volt}V`],
      expect_materials_gte: 1,
    });
    questions.push({
      id: genId(),
      type: 'scenario',
      subtype: 'appliance_circuit',
      query: `安裝${app.name}要拉什麼線？`,
      rule: {
        appliance: app.name,
        watt: app.watt,
        volt: app.volt,
        amp: parseFloat(amp),
      },
      keywords: [app.name],
      expect_materials_gte: 1,
    });
  }

  // 加裝/擴充場景
  const addQueries = [
    { q: '客廳想多加2個插座', mats: ['110V插座點位', 'PVC導線', 'CD管'] },
    { q: '臥室要加一盞崁燈', mats: ['燈具點位', 'PVC導線'] },
    { q: '想在陽台裝一個插座', mats: ['110V插座點位', '漏電斷路器', 'EMT金屬導線管'] },
    { q: '浴室要加裝暖風機', mats: ['漏電斷路器', 'XLPE導線', '220V專用點位'] },
    { q: '書房要加USB充電插座', mats: ['110V插座點位', 'PVC導線'] },
    { q: '廚房想加一個220V插座給烤箱', mats: ['220V專用點位', 'XLPE導線', '無熔絲斷路器'] },
    { q: '想在車庫裝照明', mats: ['燈具點位', 'EMT金屬導線管', '漏電斷路器'] },
    { q: '要在頂樓加裝太陽能逆變器電源', mats: ['配電箱擴充', 'XLPE導線', '無熔絲斷路器'] },
    { q: '餐廳要加地面插座', mats: ['110V插座點位', 'PVC導線'] },
    { q: '衣帽間要加燈', mats: ['燈具點位', '開關點位'] },
    { q: '門口想裝感應燈', mats: ['燈具點位', '開關點位'] },
    { q: '花園要拉電給景觀燈', mats: ['燈具點位', 'EMT金屬導線管', '接地棒'] },
    { q: '工作室需要大量插座', mats: ['110V插座點位', '配電箱擴充', 'PVC導線'] },
    { q: '地下儲藏室要拉電燈', mats: ['燈具點位', 'EMT金屬導線管', '漏電斷路器'] },
    { q: '二樓陽台要裝洗衣機插座', mats: ['110V插座點位', '漏電斷路器'] },
  ];
  for (const item of addQueries) {
    questions.push({
      id: genId(),
      type: 'scenario',
      subtype: 'add_point',
      query: item.q,
      rule: { materials: item.mats },
      keywords: item.mats.slice(0, 3),
      expect_materials_gte: 1,
    });
    // 加費用問法
    questions.push({
      id: genId(),
      type: 'scenario',
      subtype: 'add_point_cost',
      query: item.q + '大概多少錢？',
      rule: { materials: item.mats },
      keywords: item.mats.slice(0, 3),
      expect_materials_gte: 1,
    });
  }

  return questions;
}

// ---- 2. 估價題 ----
function generateEstimationQuestions() {
  const questions = [];

  // 坪數估價
  for (const h of HOUSE_SIZES) {
    const cost_min = h.ping * 2500;
    const cost_max = h.ping * 4000;
    const templates = [
      `${h.ping}坪的房子重拉電線大概多少錢？`,
      `${h.rooms}全室重配線費用估算`,
      `${h.ping}坪老屋電路翻修預算`,
      `${h.rooms}住宅水電重做要多少預算？`,
      `${h.ping}坪公寓全部換線報價`,
    ];
    for (const q of templates) {
      questions.push({
        id: genId(),
        type: 'estimation',
        subtype: 'per_ping',
        query: q,
        rule: {
          method: '坪數計價',
          formula: '坪數 × 單價/坪',
          unit_price_range: '2,500~4,000元/坪（純電路）',
          ping: h.ping,
          estimate: `${cost_min.toLocaleString()}~${cost_max.toLocaleString()}元`,
          panel: h.panel,
        },
        keywords: ['重配線', '費用', h.rooms],
        expect_materials_gte: 1,
      });
    }
  }

  // 點位估價
  const pointCombos = [
    { outlets_110: 10, outlets_220: 2, switches: 8, lights: 6 },
    { outlets_110: 15, outlets_220: 3, switches: 12, lights: 8 },
    { outlets_110: 20, outlets_220: 4, switches: 15, lights: 10 },
    { outlets_110: 6, outlets_220: 1, switches: 5, lights: 4 },
    { outlets_110: 30, outlets_220: 5, switches: 20, lights: 15 },
  ];
  for (const combo of pointCombos) {
    const total = combo.outlets_110 * 1200 + combo.outlets_220 * 1800 +
                  combo.switches * 900 + combo.lights * 800;
    questions.push({
      id: genId(),
      type: 'estimation',
      subtype: 'per_point',
      query: `${combo.outlets_110}個110V插座、${combo.outlets_220}個220V插座、${combo.switches}個開關、${combo.lights}個燈具的配線費用？`,
      rule: {
        method: '點位計價',
        breakdown: {
          '110V插座': { count: combo.outlets_110, unit_price: 1200 },
          '220V插座': { count: combo.outlets_220, unit_price: 1800 },
          '開關': { count: combo.switches, unit_price: 900 },
          '燈具': { count: combo.lights, unit_price: 800 },
        },
        subtotal: total,
        notes: '不含配電箱、幹線更新',
      },
      keywords: ['插座', '開關', '燈具', '費用'],
      expect_materials_gte: 2,
    });
  }

  // 單項估價
  const singleItems = [
    { q: '加一個110V插座多少錢？', item: '110V插座點位', price: '1,200~3,500元', notes: '含配管配線' },
    { q: '加一個220V專用插座費用？', item: '220V專用點位', price: '1,800~5,000元', notes: '含專用迴路' },
    { q: '裝一個冷氣迴路多少？', item: '分離式冷氣迴路', price: '3,200~5,500元', notes: '含專用迴路+插座' },
    { q: '加一個燈具點位多少錢？', item: '燈具點位', price: '800~2,500元', notes: '不含燈具本體' },
    { q: '換一個NFB多少錢？', item: '無熔絲斷路器', price: '300~2,500元', notes: '簡易更換300~500元' },
    { q: '配電箱新裝費用？', item: '新設配電箱', price: '15,000~25,000元', notes: '含主開關+迴路分配' },
    { q: '請師傅來檢測電路多少？', item: '檢驗費', price: '500~2,500元', notes: '基本出勤費另計' },
    { q: '全室重配線設計費？', item: '設計費', price: '500~2,000元', notes: '依複雜度' },
    { q: '電熱水器迴路安裝費？', item: '電熱水器迴路', price: '4,000~6,000元', notes: '含ELCB' },
    { q: '即熱式熱水器拉線費用？', item: '即熱式熱水器迴路', price: '5,500~8,000元', notes: '線徑較粗+ELCB' },
    { q: '擴充配電箱一迴路多少？', item: '配電箱擴充', price: '1,500~3,000元', notes: '含NFB+配線' },
    { q: '換一個漏電斷路器多少錢？', item: '漏電斷路器', price: '420~2,400元', notes: '依規格' },
    { q: '裝修廢棄物清運費用？', item: '廢棄物清運', price: '300~500元/趟', notes: '' },
    { q: '材料送到工地運費多少？', item: '運輸費', price: '500~800元/趟', notes: '' },
  ];
  for (const item of singleItems) {
    questions.push({
      id: genId(),
      type: 'estimation',
      subtype: 'single_item',
      query: item.q,
      rule: {
        item: item.item,
        price_range: item.price,
        notes: item.notes,
      },
      keywords: [item.item],
      expect_materials_gte: 1,
    });
    // 口語變體
    const variants = [
      item.q.replace('多少錢', '要花多少'),
      item.q.replace('費用', '要多少錢'),
      item.q.replace('多少', '大概多少'),
    ];
    for (const v of variants) {
      if (v !== item.q) {
        questions.push({
          id: genId(),
          type: 'estimation',
          subtype: 'single_item_variant',
          query: v,
          rule: { item: item.item, price_range: item.price },
          keywords: [item.item],
          expect_materials_gte: 1,
        });
      }
    }
  }

  // 工資估算
  const laborQueries = [
    { q: '水電師傅一天工資多少？', worker: '電氣技工', daily: 2500, hourly: 350 },
    { q: '持照技師一天多少錢？', worker: '電氣技師', daily: 3500, hourly: 500 },
    { q: '水電小工日薪多少？', worker: '小工', daily: 1800, hourly: 250 },
    { q: '請電工師傅來修一趟多少？', worker: '電氣技工', daily: 2500, hourly: 350 },
    { q: '甲級電匠一天工資？', worker: '電氣技師', daily: 3500, hourly: 500 },
    { q: '水電技術工的行情日薪？', worker: '電氣技工', daily: 2500, hourly: 350 },
    { q: '請助手幫忙一天多少？', worker: '小工', daily: 1800, hourly: 250 },
  ];
  for (const lq of laborQueries) {
    questions.push({
      id: genId(),
      type: 'estimation',
      subtype: 'labor_cost',
      query: lq.q,
      rule: {
        worker: lq.worker,
        daily_rate: lq.daily,
        hourly_rate: lq.hourly,
        reference: 'TCRI 171期 室內配線技術工日薪$3,500/工',
      },
      keywords: [lq.worker, '日薪'],
      expect_materials_gte: 1,
    });
  }

  // 管銷費率
  const feeRateQueries = [
    { q: '水電工程的管銷費怎麼算？', rate: '8%~20%', notes: '依案件規模與風險' },
    { q: '工程報價的管銷利潤通常幾趴？', rate: '10%~15%', notes: '標準案約10%' },
    { q: '五金雜項費用怎麼估？', rate: '6%~10%', notes: '螺絲束帶配件等' },
    { q: '運什費一般怎麼算？', rate: '3%~5%', notes: '材料運搬+廢棄物' },
    { q: '報價要加多少營業稅？', rate: '5%', notes: '營業稅固定5%' },
  ];
  for (const fq of feeRateQueries) {
    questions.push({
      id: genId(),
      type: 'estimation',
      subtype: 'fee_rate',
      query: fq.q,
      rule: { rate: fq.rate, notes: fq.notes },
      keywords: ['管銷', '費率'],
      expect_materials_gte: 0,
    });
  }

  // 電器功率計算
  for (const app of APPLIANCES) {
    const amp = (app.watt / app.volt).toFixed(1);
    questions.push({
      id: genId(),
      type: 'estimation',
      subtype: 'power_calc',
      query: `${app.name}的電流是多少安培？需要用多粗的線？`,
      rule: {
        appliance: app.name,
        watt: app.watt,
        volt: app.volt,
        amp: parseFloat(amp),
        formula: `A = W / V = ${app.watt} / ${app.volt} = ${amp}A`,
      },
      keywords: [app.name, '安培', '線徑'],
      expect_materials_gte: 1,
    });
  }

  return questions;
}

// ---- 3. 法規安全題 ----
function generateRegulationQuestions() {
  const questions = [];

  // ELCB 法規
  const elcbLocations = [
    { location: '浴室', reason: '潮濕環境漏電風險高' },
    { location: '廚房流理台', reason: '距水槽1.8m內插座' },
    { location: '陽台', reason: '戶外所有插座' },
    { location: '室外', reason: '所有戶外線路及插座' },
    { location: '電熱水器', reason: '高功率+近水' },
    { location: '潛水泵浦', reason: '直接接觸水' },
    { location: '飲水機', reason: '公共場所近水設備' },
  ];
  for (const loc of elcbLocations) {
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'elcb_mandatory',
      query: `${loc.location}一定要裝漏電斷路器嗎？`,
      rule: {
        answer: '是，法規強制要求',
        location: loc.location,
        reason: loc.reason,
        spec: '額定靈敏度6mA以下，動作時間0.1秒以下',
        law: '用戶用電設備裝置規則',
      },
      keywords: ['漏電斷路器', loc.location],
      expect_materials_gte: 1,
    });
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'elcb_mandatory',
      query: `為什麼${loc.location}要裝漏電保護？`,
      rule: {
        answer: loc.reason,
        law: '用戶用電設備裝置規則',
      },
      keywords: ['漏電', loc.location],
      expect_materials_gte: 1,
    });
  }

  // 接地規定
  const groundTypes = [
    { type: '特種接地', resistance: '10Ω以下', wire: '22mm²以上', usage: '高壓變壓器二次側' },
    { type: '第一種接地', resistance: '25Ω以下', wire: '5.5mm²以上', usage: '避雷器、高壓設備外殼' },
    { type: '第二種接地', resistance: '50Ω以下', wire: '8mm²以上', usage: '低壓變壓器二次側' },
    { type: '第三種接地', resistance: '100Ω以下', wire: '3.5mm²以上', usage: '低壓設備外殼、金屬管路' },
  ];
  for (const gt of groundTypes) {
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'grounding_type',
      query: `${gt.type}的接地電阻要求是多少？`,
      rule: gt,
      keywords: [gt.type, '接地', '電阻'],
      expect_materials_gte: 1,
    });
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'grounding_type',
      query: `${gt.type}用在什麼場合？接地線要多粗？`,
      rule: gt,
      keywords: [gt.type, '接地'],
      expect_materials_gte: 1,
    });
  }

  // 佔積率
  const fillRatioQueries = [
    '導線管內電線佔積率規定是多少？',
    '管內導線截面積不能超過多少百分比？',
    '電管穿線的佔積率上限？',
    'PVC管穿線數量有什麼限制？',
    '導線管佔積率40%是什麼意思？',
  ];
  for (const q of fillRatioQueries) {
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'fill_ratio',
      query: q,
      rule: {
        standard: '40%（不同線徑混合時）',
        same_size_short: '60%（同線徑、管長6m以下、8mm²以下）',
        law: '用戶用電設備裝置規則',
      },
      keywords: ['佔積率', '導線管', '穿線'],
      expect_materials_gte: 1,
    });
  }

  // 載流量法規
  for (const [gauge, caps] of Object.entries(AMPACITY_TABLE)) {
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'ampacity',
      query: `${gauge}電線可以承受多少安培？`,
      rule: {
        gauge,
        pvc_60c: `${caps.pvc60}A`,
        xlpe_90c: `${caps.xlpe90}A`,
        condition: 'PVC管配線，3條以下',
      },
      keywords: [gauge, '安培', '載流量'],
      expect_materials_gte: 1,
    });
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'ampacity',
      query: `${gauge}的載流量是多少？PVC和XLPE差多少？`,
      rule: {
        gauge,
        pvc_60c: `${caps.pvc60}A`,
        xlpe_90c: `${caps.xlpe90}A`,
        difference: `XLPE比PVC高約${Math.round((caps.xlpe90/caps.pvc60 - 1) * 100)}%`,
      },
      keywords: [gauge, '載流量'],
      expect_materials_gte: 1,
    });
  }

  // NFB 搭配規定
  for (const mapping of NFB_WIRE_MAP) {
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'nfb_wire_match',
      query: `${mapping.amps}A的NFB要搭配多粗的線？`,
      rule: {
        nfb_amps: mapping.amps,
        min_wire: mapping.wire,
        principle: 'NFB額定電流不得超過電線最大可承載電流量',
      },
      keywords: [`${mapping.amps}A`, 'NFB', '線徑'],
      expect_materials_gte: 1,
    });
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'nfb_wire_match',
      query: `${mapping.wire_mm2}mm²的線要用幾A的斷路器？`,
      rule: {
        wire: `${mapping.wire_mm2}mm²`,
        nfb_amps: mapping.amps,
      },
      keywords: [`${mapping.wire_mm2}mm²`, '斷路器'],
      expect_materials_gte: 1,
    });
  }

  // 安全距離/高度
  const safetyQueries = [
    { q: '插座安裝高度有規定嗎？', rule: { 一般: '離地15~20cm', 廚房檯面: '40cm', 開關: '120cm' } },
    { q: '開關的標準安裝高度？', rule: { height: '約120cm' } },
    { q: '浴室插座要裝多高？', rule: { height: '110cm以上（高位安裝）', reason: '遠離水花噴濺' } },
    { q: '電線走地面要離地多高？', rule: { height: '30cm以上', reason: '防潮' } },
    { q: '配電箱安裝高度？', rule: { height: '約180cm', reason: '便於操作維護' } },
  ];
  for (const sq of safetyQueries) {
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'installation_height',
      query: sq.q,
      rule: sq.rule,
      keywords: ['高度', '安裝'],
      expect_materials_gte: 0,
    });
  }

  // 溫度降載
  const tempQueries = [
    '環境溫度40度電線要降載多少？',
    '夏天高溫對電線載流量有影響嗎？',
    '溫度升高電線能承受的電流會變少嗎？',
    'XLPE線在50度環境下的降載係數？',
    '多條導線在管內的降載修正怎麼算？',
  ];
  for (const q of tempQueries) {
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'derating',
      query: q,
      rule: {
        temp_40c: { pvc60: 0.90, xlpe90: 0.95 },
        temp_45c: { pvc60: 0.78, xlpe90: 0.90 },
        temp_50c: { pvc60: 0.64, xlpe90: 0.85 },
        multi_wire: { '10~20條': 0.50, '21~30條': 0.45, '31~40條': 0.40 },
      },
      keywords: ['降載', '溫度', '載流量'],
      expect_materials_gte: 0,
    });
  }

  // 一般安全問題
  const generalSafety = [
    { q: '延長線可以串接嗎？', rule: { answer: '不可以，禁止延長線串接使用', risk: '過熱起火' } },
    { q: '電線可以穿牆不用管嗎？', rule: { answer: '不可以，穿牆須用護管保護', reason: '防止絕緣層磨損' } },
    { q: '接地線可以省略不裝嗎？', rule: { answer: '不可以，三孔插座必須接地', reason: '漏電保護' } },
    { q: '1.2mm的電線現在還能用嗎？', rule: { answer: '不建議，現行法規最低標準為1.6mm（照明）/2.0mm（插座）' } },
    { q: '中性線和接地線可以短接嗎？', rule: { answer: '僅在總電箱相接，分電箱內不可短接' } },
    { q: '電線接頭可以用膠帶包就好嗎？', rule: { answer: '不建議，應使用壓接端子或快速接頭，外加絕緣套管' } },
    { q: '一個迴路最多接幾個插座？', rule: { answer: '建議不超過6個（110V），避免過載' } },
    { q: 'NFB的壽命是多久？', rule: { answer: '10~15年，超過建議更換' } },
    { q: '漏電斷路器要多久測試一次？', rule: { answer: '每月按一次TEST鈕測試', reason: '確認跳脫功能正常' } },
    { q: '火線應該接在開關的哪一端？', rule: { answer: '火線接入開關，中性線直接到燈具', reason: '關閉開關後燈座不帶電' } },
  ];
  for (const gs of generalSafety) {
    questions.push({
      id: genId(),
      type: 'regulation',
      subtype: 'general_safety',
      query: gs.q,
      rule: gs.rule,
      keywords: gs.q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
      expect_materials_gte: 0,
    });
  }

  return questions;
}

// ---- 4. 材料選型題 ----
function generateSelectionQuestions() {
  const questions = [];

  // 線徑選型
  const wireSelections = [
    { current: 10, answer: '1.6mm（PVC 13A）', scenario: '一般照明' },
    { current: 15, answer: '2.0mm（PVC 18A）', scenario: '一般插座' },
    { current: 20, answer: '2.6mm（PVC 24A）或 5.5mm²（25A）', scenario: '大功率插座' },
    { current: 30, answer: '5.5mm²（PVC 25A）或 8mm²（33A）', scenario: '冷氣/電熱水器' },
    { current: 50, answer: '14mm²（PVC 43A）', scenario: '大型設備' },
    { current: 75, answer: '22mm²（PVC 57A）', scenario: '主幹線' },
    { current: 100, answer: '38mm²（PVC 76A）', scenario: '進戶線/總開關' },
  ];
  for (const ws of wireSelections) {
    questions.push({
      id: genId(),
      type: 'selection',
      subtype: 'wire_by_current',
      query: `負載電流${ws.current}A要用多粗的線？`,
      rule: { current: ws.current, wire: ws.answer, scenario: ws.scenario },
      keywords: [`${ws.current}A`, '線徑'],
      expect_materials_gte: 1,
    });
    questions.push({
      id: genId(),
      type: 'selection',
      subtype: 'wire_by_current',
      query: `${ws.scenario}用什麼線徑？`,
      rule: { current: ws.current, wire: ws.answer, scenario: ws.scenario },
      keywords: [ws.scenario, '線徑'],
      expect_materials_gte: 1,
    });
  }

  // 管材選型
  const conduitSelections = [
    { scenario: 'RC牆內暗管', answer: 'CD管', reason: '可撓好彎、預埋專用' },
    { scenario: '天花板走線', answer: 'CD管或PF管', reason: '耐燃、可撓' },
    { scenario: '室內明管', answer: 'PVC導線管', reason: '整齊美觀、成本適中' },
    { scenario: '工業風明管', answer: 'EMT金屬導線管', reason: '電磁屏障、美觀' },
    { scenario: '戶外配線', answer: 'EMT金屬導線管', reason: '防潮防撞' },
    { scenario: '潮濕環境', answer: 'EMT金屬導線管', reason: '金屬防潮' },
    { scenario: '地下室', answer: 'EMT金屬導線管', reason: '潮濕+防護需求高' },
    { scenario: '工廠', answer: 'EMT或RSG管', reason: '高防護需求' },
  ];
  for (const cs of conduitSelections) {
    const templates = [
      `${cs.scenario}用什麼管？`,
      `${cs.scenario}配線該選哪種管材？`,
      `${cs.scenario}適合用CD管還是EMT管？`,
    ];
    for (const q of templates) {
      questions.push({
        id: genId(),
        type: 'selection',
        subtype: 'conduit_by_scenario',
        query: q,
        rule: { scenario: cs.scenario, recommendation: cs.answer, reason: cs.reason },
        keywords: [cs.answer.split('(')[0].trim()],
        expect_materials_gte: 1,
      });
    }
  }

  // 管徑選型
  for (const [size, caps] of Object.entries(CONDUIT_CAPACITY)) {
    questions.push({
      id: genId(),
      type: 'selection',
      subtype: 'conduit_size',
      query: `${size}的管可以穿幾條2.0mm的線？`,
      rule: { conduit: size, wire: '2.0mm', max_count: caps['2.0mm'] },
      keywords: [size, '穿線', '2.0mm'],
      expect_materials_gte: 1,
    });
    questions.push({
      id: genId(),
      type: 'selection',
      subtype: 'conduit_size',
      query: `${size}的管穿5.5mm²的線最多幾條？`,
      rule: { conduit: size, wire: '5.5mm²', max_count: caps['5.5mm²'] },
      keywords: [size, '穿線', '5.5mm²'],
      expect_materials_gte: 1,
    });
  }

  // NFB 選型
  const nfbSelections = [
    { scenario: '照明迴路', nfb: '1P 15A', wire: '1.6mm' },
    { scenario: '一般插座迴路', nfb: '1P 20A', wire: '2.0mm' },
    { scenario: '冷氣專用迴路(220V)', nfb: '2P 20A', wire: '5.5mm²' },
    { scenario: '電熱水器(220V)', nfb: '2P 30A', wire: '5.5mm²' },
    { scenario: '即熱式熱水器(220V)', nfb: '2P 50A', wire: '14mm²' },
    { scenario: '總開關', nfb: '2P 75A~100A', wire: '22~38mm²' },
  ];
  for (const ns of nfbSelections) {
    questions.push({
      id: genId(),
      type: 'selection',
      subtype: 'nfb_selection',
      query: `${ns.scenario}要用幾安培的NFB？`,
      rule: { scenario: ns.scenario, nfb: ns.nfb, wire: ns.wire },
      keywords: ['NFB', ns.scenario],
      expect_materials_gte: 1,
    });
    questions.push({
      id: genId(),
      type: 'selection',
      subtype: 'nfb_selection',
      query: `${ns.scenario}的NFB和電線怎麼搭配？`,
      rule: { scenario: ns.scenario, nfb: ns.nfb, wire: ns.wire },
      keywords: ['NFB', '電線', ns.scenario],
      expect_materials_gte: 1,
    });
  }

  // 配電箱選型
  for (const h of HOUSE_SIZES) {
    questions.push({
      id: genId(),
      type: 'selection',
      subtype: 'panel_selection',
      query: `${h.ping}坪${h.rooms}要用幾迴路的配電箱？`,
      rule: { ping: h.ping, rooms: h.rooms, circuits: h.circuits, panel: h.panel },
      keywords: ['配電箱', h.rooms, '迴路'],
      expect_materials_gte: 1,
    });
  }

  // 品牌選型
  for (const [category, brands] of Object.entries(BRANDS)) {
    const catName = {
      cable: '電纜', nfb: 'NFB/斷路器', switch: '開關插座',
      conduit_pvc: 'PVC管', conduit_emt: 'EMT管',
    }[category];
    questions.push({
      id: genId(),
      type: 'selection',
      subtype: 'brand_recommendation',
      query: `${catName}有哪些品牌可以選？`,
      rule: { category: catName, brands, recommendation: brands[0] },
      keywords: [catName, '品牌'],
      expect_materials_gte: 0,
    });
    questions.push({
      id: genId(),
      type: 'selection',
      subtype: 'brand_comparison',
      query: `${catName}哪個品牌比較好？`,
      rule: { category: catName, brands, notes: '一級廠品質差異不大，主要差在價格與通路' },
      keywords: [catName, '品牌'],
      expect_materials_gte: 0,
    });
  }

  // PVC vs XLPE 選型
  const pvcXlpeQueries = [
    { q: '什麼情況要用XLPE不用PVC？', rule: { xlpe: '高溫環境/大電流/長距離/戶外', pvc: '一般室內配線' } },
    { q: 'XLPE比PVC貴多少？值得嗎？', rule: { price_diff: 'XLPE約貴20~50%', worth: '耐溫90°C vs 60°C，載流量高約50%' } },
    { q: '室內一般插座要用XLPE嗎？', rule: { answer: '不需要，PVC 2.0mm即可', reason: 'PVC足以應付15~20A負載' } },
    { q: '220V大功率設備線路要用XLPE嗎？', rule: { answer: '建議用XLPE', reason: '耐溫高、載流量大、安全裕度高' } },
  ];
  for (const pxq of pvcXlpeQueries) {
    questions.push({
      id: genId(),
      type: 'selection',
      subtype: 'pvc_vs_xlpe',
      query: pxq.q,
      rule: pxq.rule,
      keywords: ['PVC', 'XLPE'],
      expect_materials_gte: 1,
    });
  }

  return questions;
}

// ---- 5. 價格趨勢題 ----
function generatePricingQuestions() {
  const questions = [];

  // 銅價影響
  const copperQueries = [
    { q: '銅價上漲會影響電纜價格嗎？', rule: { answer: '是，電纜價格直接受LME銅價影響', mechanism: '牌價=銅價+加工費+利潤，每月依銅價調整' } },
    { q: '最近銅價漲了多少？', rule: { trend: '2026年初LME銅價約12,500~13,000 USD/噸，年漲幅超過40%' } },
    { q: '銅價漲電線會跟著漲嗎？', rule: { answer: '是，通常1~2個月內反映', mechanism: '每月底依當月LME均價計算隔月報價' } },
    { q: '為什麼最近電纜變貴了？', rule: { reasons: ['銅價創歷史新高', 'AI資料中心需求大增', '電動車產業擴張', '能源轉型用銅增加'] } },
    { q: '電纜牌價和售價的關係？', rule: { answer: '售價=牌價×折數', 折數範圍: '0.5~0.85', notes: '依品牌、品項、數量、付款條件而異' } },
  ];
  for (const cq of copperQueries) {
    questions.push({
      id: genId(),
      type: 'pricing',
      subtype: 'copper_impact',
      query: cq.q,
      rule: cq.rule,
      keywords: ['銅價', '電纜', '價格'],
      expect_materials_gte: 0,
    });
  }

  // 季節因素
  const seasonQueries = [
    { q: '水電工程什麼時候最便宜？', rule: { cheapest: '3~5月（梅雨淡季）', expensive: '9~11月（黃金旺季）' } },
    { q: '夏天裝冷氣會比較貴嗎？', rule: { answer: '是，6~8月冷氣安裝旺季，師傅工期排滿，可能加收急件費' } },
    { q: '年底趕裝修會加價嗎？', rule: { answer: '12月趕農曆年前入住，加班費+材料漲價，預估貴10~20%' } },
    { q: '颱風季材料會漲價嗎？', rule: { answer: '颱風後短期供給不足可能漲價，室外工程停工影響工期' } },
    { q: '北部水電比南部貴嗎？', rule: { answer: '是，北部報價通常高10~20%', reasons: ['物價水準差異', '租金成本', '師傅薪資行情'] } },
  ];
  for (const sq of seasonQueries) {
    questions.push({
      id: genId(),
      type: 'pricing',
      subtype: 'seasonal',
      query: sq.q,
      rule: sq.rule,
      keywords: ['季節', '價格'],
      expect_materials_gte: 0,
    });
  }

  // 材料價格比較
  for (const wire of [...MATERIALS.wires.pvc, ...MATERIALS.wires.xlpe.slice(0, 6)]) {
    questions.push({
      id: genId(),
      type: 'pricing',
      subtype: 'material_price',
      query: `${wire.name} ${wire.spec}多少錢一米？`,
      rule: { name: wire.name, spec: wire.spec, price: wire.price, unit: '元/m' },
      keywords: [wire.name, wire.spec],
      expect_materials_gte: 1,
    });
  }

  // 斷路器價格
  for (const br of MATERIALS.breakers.nfb.slice(0, 8)) {
    questions.push({
      id: genId(),
      type: 'pricing',
      subtype: 'material_price',
      query: `無熔絲斷路器 ${br.spec}的價格？`,
      rule: { name: '無熔絲斷路器', spec: br.spec, price: br.price, unit: '元/個' },
      keywords: ['無熔絲斷路器', br.spec],
      expect_materials_gte: 1,
    });
  }

  for (const br of MATERIALS.breakers.elcb.slice(0, 5)) {
    questions.push({
      id: genId(),
      type: 'pricing',
      subtype: 'material_price',
      query: `漏電斷路器 ${br.spec}多少錢？`,
      rule: { name: '漏電斷路器', spec: br.spec, price: br.price, unit: '元/個' },
      keywords: ['漏電斷路器', br.spec],
      expect_materials_gte: 1,
    });
  }

  // 配電箱價格
  for (const p of MATERIALS.panels) {
    questions.push({
      id: genId(),
      type: 'pricing',
      subtype: 'material_price',
      query: `${p.spec}配電箱多少錢？`,
      rule: { name: '配電箱', spec: p.spec, price: p.price, unit: '元/個' },
      keywords: ['配電箱', p.spec],
      expect_materials_gte: 1,
    });
  }

  // 折數概念
  const discountQueries = [
    { q: '什麼是電纜折數？', rule: { answer: '經銷商售價=廠商牌價×折數', range: '0.5~0.85折', notes: '折數越低價格越便宜' } },
    { q: '士林NFB的折數大概幾折？', rule: { answer: '約0.6~0.7折', notes: '依通路和數量而異' } },
    { q: '華新電纜牌價怎麼查？', rule: { answer: '華新麗華官網或經銷商可查牌價表', notes: '牌價每月隨銅價調整' } },
    { q: '買多有打折嗎？', rule: { answer: '量大通常可議價，折數更低', notes: '一般5%~15%數量折扣' } },
    { q: '現金付款會比較便宜嗎？', rule: { answer: '是，現金付款折數通常比月結低1~3%' } },
  ];
  for (const dq of discountQueries) {
    questions.push({
      id: genId(),
      type: 'pricing',
      subtype: 'discount',
      query: dq.q,
      rule: dq.rule,
      keywords: ['折數', '牌價', '售價'],
      expect_materials_gte: 0,
    });
  }

  // 市場因素
  const marketQueries = [
    { q: 'AI資料中心建設對銅價有什麼影響？', rule: { impact: '大幅增加銅需求', detail: '每座資料中心需數千噸銅纜，推升全球銅價' } },
    { q: '電動車產業對電纜市場有影響嗎？', rule: { impact: '充電樁+車用線束需求大增', detail: '每台電動車用銅約83kg，傳統汽車僅23kg' } },
    { q: '營建物價指數CCI是什麼？', rule: { answer: '營造工程物價指數，反映建材價格整體走勢', source: 'TCRI營建物價資訊平台' } },
    { q: '台電大案對電纜市場有什麼影響？', rule: { impact: '台電輸配電建設釋出大單，帶動建築用線需求' } },
  ];
  for (const mq of marketQueries) {
    questions.push({
      id: genId(),
      type: 'pricing',
      subtype: 'market_factor',
      query: mq.q,
      rule: mq.rule,
      keywords: ['市場', '銅價'],
      expect_materials_gte: 0,
    });
  }

  return questions;
}

// ---- 6. 施工工序題 ----
function generateProcedureQuestions() {
  const questions = [];

  const procedures = [
    {
      name: '全室重配線',
      steps: ['斷電確認', '拆除舊設備', '舊線抽換新線', '更換NFB', '重新安裝設備', '整理盤面測試'],
      notes: '工期1~2天，若需打牆則更久',
      keywords: ['重配線', '步驟'],
    },
    {
      name: '配電箱安裝',
      steps: ['定位', '開孔埋設', '管線進入', '匯流排安裝', 'NFB安裝', '接線', '標示'],
      notes: '安裝高度180cm，必須垂直水平',
      keywords: ['配電箱', '安裝'],
    },
    {
      name: '暗管配線(CD管)',
      steps: ['規劃路徑', '打鑿', '埋設CD管', '固定', '打粗胚', '穿線'],
      notes: 'CD管只能預埋在RC牆內',
      keywords: ['暗管', 'CD管', '施工'],
    },
    {
      name: '明管配線(EMT管)',
      steps: ['路徑規劃', '管線裁切', '彎管', '管線連接', '管線固定', '出線盒', '穿線'],
      notes: '固定間隔不超過2m',
      keywords: ['明管', 'EMT', '施工'],
    },
    {
      name: '接地工程',
      steps: ['開挖', '接地極安裝', '接線', '回填', '測試'],
      notes: '接地極垂直釘沒於地面下1m以上',
      keywords: ['接地', '施工'],
    },
    {
      name: '插座安裝',
      steps: ['斷電確認', '拆除飾板', '拆除固定座', '接線', '接地線', '固定安裝', '送電測試'],
      notes: '火線→短孔、中性線→長孔',
      keywords: ['插座', '安裝'],
    },
  ];

  for (const proc of procedures) {
    const templates = [
      `${proc.name}的施工步驟是什麼？`,
      `${proc.name}怎麼做？`,
      `${proc.name}的施工流程`,
      `${proc.name}要注意什麼？`,
      `請問${proc.name}的工序`,
    ];
    for (const q of templates) {
      questions.push({
        id: genId(),
        type: 'procedure',
        subtype: 'construction_steps',
        query: q,
        rule: {
          procedure: proc.name,
          steps: proc.steps,
          step_count: proc.steps.length,
          notes: proc.notes,
        },
        keywords: proc.keywords,
        expect_materials_gte: 1,
      });
    }
  }

  // 施工注意事項
  const precautions = [
    { q: '暗管配線有什麼要注意的？', rules: ['CD管只能埋在RC牆內', '減少折角避免交錯', '不可損壞結構筋', '留抽換餘地'] },
    { q: '配電箱接線要注意什麼？', rules: ['各迴路進線充足長度', '不得有接頭', '整齊規則螺絲緊固', '標明各迴路名稱'] },
    { q: '接地工程施工時要注意什麼？', rules: ['接地極垂直釘沒於地面下1m以上', '銅線為原則', '保持土壤濕潤', '中性線與接地線僅在總電箱相接'] },
    { q: '穿線施工有什麼技巧？', rules: ['用鋼魚引線', '管內不可超過佔積率40%', '避免尖銳管緣刮線皮', '預留足夠長度'] },
    { q: '換開關插座要注意什麼安全事項？', rules: ['一定要先斷電', '用測電筆確認無電', '火線接短孔中性線接長孔', '三孔必須接地線'] },
    { q: 'EMT管安裝時要注意什麼？', rules: ['管緣去毛刺', '使用專用接頭', '固定間隔不超過2m', '彎管不可直線橫越'] },
  ];
  for (const p of precautions) {
    questions.push({
      id: genId(),
      type: 'procedure',
      subtype: 'precaution',
      query: p.q,
      rule: { precautions: p.rules },
      keywords: p.q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
      expect_materials_gte: 1,
    });
  }

  // 工具使用
  const toolQueries = [
    { q: '電氣施工需要什麼工具？', tools: ['測電筆', '電鑽', '鋼魚', '壓接鉗', '彎管器', '螺絲起子', '剝線鉗', '絕緣阻抗表'] },
    { q: '怎麼用測電筆？', tools: ['測電筆'], method: '觸碰導體，亮燈表示帶電' },
    { q: '絕緣電阻怎麼測？', tools: ['絕緣阻抗表(Megger)'], method: '量測電線耐壓，判斷絕緣劣化程度' },
    { q: '接地電阻怎麼測？', tools: ['接地電阻測試儀'], method: '測量接地極與大地間電阻值' },
  ];
  for (const tq of toolQueries) {
    questions.push({
      id: genId(),
      type: 'procedure',
      subtype: 'tools',
      query: tq.q,
      rule: { tools: tq.tools, method: tq.method },
      keywords: tq.tools.slice(0, 2),
      expect_materials_gte: 0,
    });
  }

  return questions;
}

// ---- 7. 故障排除題 ----
function generateTroubleshootQuestions() {
  const questions = [];

  // 跳電
  const tripQueries = [
    { q: '為什麼家裡一直跳電？', causes: ['電力過載', '電路短路', '漏電', '設備故障'] },
    { q: '跳電要怎麼處理？', steps: ['保持冷靜停止使用電器', '檢查配電箱找出跳脫開關', '排除故障源', '逐步復電'] },
    { q: 'NFB跳掉跟ELCB跳掉有什麼差別？', rule: { nfb: '過載或短路', elcb: '漏電', recovery: 'NFB直接扳回ON，ELCB先按TEST再復位' } },
    { q: '同時用很多電器就跳電正常嗎？', rule: { answer: '代表迴路過載', solution: '分散電器到不同迴路，或增設專用迴路' } },
    { q: '跳電後開關推不回去怎麼辦？', rule: { answer: '可能是短路，不要硬推', solution: '先拔掉所有電器，若仍推不回去，找電工檢查' } },
    { q: '常跳電要換配電箱嗎？', rule: { answer: '不一定', diagnosis: '先檢查是過載、漏電還是NFB老化，對症處理' } },
  ];
  for (const tq of tripQueries) {
    questions.push({
      id: genId(),
      type: 'troubleshoot',
      subtype: 'tripping',
      query: tq.q,
      rule: tq.causes ? { causes: tq.causes } : (tq.steps ? { steps: tq.steps } : tq.rule),
      keywords: ['跳電', '斷路器'],
      expect_materials_gte: 1,
    });
  }

  // 漏電
  const leakQueries = [
    { q: '怎麼知道家裡有漏電？', methods: ['測電筆碰金屬外殼亮燈', '關閉所有電器電表仍轉動', 'ELCB經常跳脫', '碰到電器微麻'] },
    { q: '漏電怎麼排查？', steps: ['關閉所有分路NFB', '逐一開啟', '觀察哪路跳脫', '縮小範圍找出漏電設備'] },
    { q: '碰到插座會麻是什麼問題？', rule: { answer: '漏電或接地不良', solution: '立即斷電，檢查接地線和漏電斷路器' } },
    { q: '浴室一直漏電跳電怎麼辦？', rule: { causes: ['潮濕環境絕緣劣化', '電熱水器漏電', '線路老化'], solution: '檢查漏電斷路器+更換老化線路' } },
  ];
  for (const lq of leakQueries) {
    questions.push({
      id: genId(),
      type: 'troubleshoot',
      subtype: 'leakage',
      query: lq.q,
      rule: lq.methods ? { methods: lq.methods } : (lq.steps ? { steps: lq.steps } : lq.rule),
      keywords: ['漏電', '檢測'],
      expect_materials_gte: 1,
    });
  }

  // 過熱
  const overheatQueries = [
    { q: '插座摸起來很燙正常嗎？', rule: { answer: '不正常', causes: ['過載', '接觸不良', '線徑不足'], action: '立即斷電檢查' } },
    { q: '電線外皮變色/變硬是什麼原因？', rule: { answer: '長期過熱導致絕緣劣化', action: '更換電線' } },
    { q: '延長線很燙怎麼辦？', rule: { answer: '過載', action: '減少使用電器數量，不要串接延長線' } },
    { q: '配電箱裡面有燒焦味？', rule: { answer: '可能是NFB或接點故障', action: '立即斷總電，找電工檢查' } },
  ];
  for (const oq of overheatQueries) {
    questions.push({
      id: genId(),
      type: 'troubleshoot',
      subtype: 'overheat',
      query: oq.q,
      rule: oq.rule,
      keywords: ['過熱', '電線'],
      expect_materials_gte: 0,
    });
  }

  // 接觸不良
  const contactQueries = [
    { q: '開關按了燈有時亮有時不亮？', rule: { cause: '接觸不良', solution: '更換開關，檢查接線端子' } },
    { q: '插頭插進去會冒火花？', rule: { cause: '接觸不良或插座鬆弛', risk: '電弧引發火災', action: '更換插座' } },
    { q: '燈泡閃爍是什麼原因？', rule: { causes: ['接觸不良', '電壓不穩', '燈泡壽命將盡', '中性線鬆脫'] } },
  ];
  for (const cq of contactQueries) {
    questions.push({
      id: genId(),
      type: 'troubleshoot',
      subtype: 'contact',
      query: cq.q,
      rule: cq.rule,
      keywords: ['接觸不良', '開關', '插座'],
      expect_materials_gte: 0,
    });
  }

  return questions;
}

// ---- 8. 回答模板題 ----
function generateTemplateQuestions() {
  const questions = [];

  // 報價回覆模板
  const quoteTemplates = [
    { q: '客戶問冷氣迴路多少錢怎麼回？', template: '分離式冷氣迴路連工帶料$3,500/台（含5.5mm²電線+2P-20A NFB+冷氣專用插座+PVC管），不含冷氣機安裝。' },
    { q: '怎麼報全室重配線的價格？', template: '全室重配線以坪數計價，約$2,500~4,000/坪（純電路），含配電箱更換+迴路配置。{坪數}坪約${低}~${高}元。不含打牆泥作。' },
    { q: '客戶問加插座多少錢怎麼回？', template: '新增110V插座$1,200~3,500/點（依走線距離），含配管配線+插座面板。如需新增迴路另計$1,500/迴。' },
    { q: '怎麼報電熱水器安裝的電路費用？', template: '電熱水器專用迴路$4,000~6,000/台（含5.5mm² XLPE線+2P-30A NFB+漏電斷路器30mA），即熱式需8mm²以上線材另計。' },
  ];
  for (const qt of quoteTemplates) {
    questions.push({
      id: genId(),
      type: 'template',
      subtype: 'quote_reply',
      query: qt.q,
      rule: { template: qt.template },
      keywords: ['報價', '回覆'],
      expect_materials_gte: 1,
    });
  }

  // 安全提醒模板
  const safetyTemplates = [
    { q: '客戶想省錢不裝漏電斷路器怎麼回？', template: '浴室/廚房/戶外插座依法規必須裝設漏電斷路器（額定6mA/0.1s），這是人身安全保護，建議不要省。ELCB費用$420~2,400/顆。' },
    { q: '客戶問舊線可以繼續用嗎？', template: '如果是20年以上老屋的1.2mm/1.6mm舊線，建議全部更換為2.0mm以上新線。PVC絕緣層隨時間劣化，有短路起火風險。' },
    { q: '客戶要自己DIY接線怎麼回？', template: '建議由持照電工施工。配電箱作業涉及帶電操作，有觸電及火災風險。法規規定電氣工程須由合格人員施作。' },
  ];
  for (const st of safetyTemplates) {
    questions.push({
      id: genId(),
      type: 'template',
      subtype: 'safety_reminder',
      query: st.q,
      rule: { template: st.template },
      keywords: ['安全', '建議'],
      expect_materials_gte: 0,
    });
  }

  // 材料清單模板
  const listTemplates = [
    { q: '冷氣迴路的材料清單怎麼列？', template: '分離式冷氣迴路材料：\n1. XLPE導線 5.5mm² - 依距離\n2. 接地線(綠) 3.5mm² - 同上\n3. 無熔絲斷路器 2P-20A - 1顆\n4. 冷氣專用插座 220V - 1個\n5. PVC導線管 22mm - 依距離\n6. CD管 22mm - 依暗管段' },
    { q: '浴室電路的材料清單？', template: '浴室配電材料：\n1. 漏電斷路器 2P-20A 30mA - 1~2顆\n2. XLPE導線 5.5mm² - 依距離（電熱水器用）\n3. PVC導線 2.0mm - 依距離（一般插座）\n4. 接地型插座 IP44 - 2~3個\n5. 防水接線盒 - 依需求' },
  ];
  for (const lt of listTemplates) {
    questions.push({
      id: genId(),
      type: 'template',
      subtype: 'material_list',
      query: lt.q,
      rule: { template: lt.template },
      keywords: ['材料清單'],
      expect_materials_gte: 2,
    });
  }

  // 解釋型模板
  const explainTemplates = [
    { q: '怎麼向客戶解釋專用迴路？', template: '專用迴路是指一台電器獨占一條電路，從配電箱直接拉線到該設備。冷氣、電熱水器、烤箱等大功率電器都需要專用迴路，避免與其他電器共用導致過載跳電。' },
    { q: '怎麼解釋110V和220V的差別？', template: '台電進戶有3條線：+110V、-110V、中性線0V。一般家電用110V（1條火線+中性線），冷氣/電熱水器等大功率設備用220V（2條反相火線），功率相同時220V電流只有110V的一半，線材可以用細一些。' },
    { q: '怎麼解釋接地的重要性？', template: '接地線（綠線）連接電器外殼到大地。萬一漏電，電流會走接地線流入大地，配合漏電斷路器迅速切斷電源，保護人不觸電。沒有接地，漏電時電流會經過人體導向大地，造成觸電危險。' },
  ];
  for (const et of explainTemplates) {
    questions.push({
      id: genId(),
      type: 'template',
      subtype: 'explanation',
      query: et.q,
      rule: { template: et.template },
      keywords: et.q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
      expect_materials_gte: 0,
    });
  }

  return questions;
}

// ========================================
// 主程式：生成 + 補數
// ========================================

function generateAll() {
  console.log('開始生成訓練資料...\n');

  const scenarioQs = generateScenarioQuestions();
  const estimationQs = generateEstimationQuestions();
  const regulationQs = generateRegulationQuestions();
  const selectionQs = generateSelectionQuestions();
  const pricingQs = generatePricingQuestions();
  const procedureQs = generateProcedureQuestions();
  const troubleshootQs = generateTroubleshootQuestions();
  const templateQs = generateTemplateQuestions();

  const allQuestions = [
    ...scenarioQs,
    ...estimationQs,
    ...regulationQs,
    ...selectionQs,
    ...pricingQs,
    ...procedureQs,
    ...troubleshootQs,
    ...templateQs,
  ];

  // 統計
  const stats = {};
  for (const q of allQuestions) {
    stats[q.type] = (stats[q.type] || 0) + 1;
  }

  console.log('生成統計：');
  for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(15)} ${count} 題`);
  }
  console.log(`  ${'─'.repeat(25)}`);
  console.log(`  ${'總計'.padEnd(13)} ${allQuestions.length} 題`);
  console.log(`  + 既有 500 題 = ${allQuestions.length + 500} 題\n`);

  // 輸出
  const output = {
    version: '3.0',
    created: new Date().toISOString().split('T')[0],
    description: 'RAG 規則型訓練資料集 — 場景推薦/估價公式/法規安全/材料選型/價格趨勢/施工工序/故障排除/回答模板',
    categories: {
      scenario: '場景→材料推薦組合',
      estimation: '估價公式/計算',
      regulation: '法規安全',
      selection: '材料選型',
      pricing: '價格趨勢/市場因素',
      procedure: '施工工序',
      troubleshoot: '故障排除',
      template: '回答模板',
    },
    stats,
    total: allQuestions.length,
    questions: allQuestions,
  };

  const outPath = join(__dirname, 'rag-training-rules.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`已輸出至：${outPath}`);
  console.log(`檔案大小：${(JSON.stringify(output).length / 1024).toFixed(0)} KB`);

  return output;
}

generateAll();

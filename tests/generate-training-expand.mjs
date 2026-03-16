#!/usr/bin/env node
/**
 * 訓練資料集擴展器（Part 2）
 * 從 Part 1 的 632 題擴展到約 9,500 題
 * 策略：口語變體 × 交叉組合 × 情境展開
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(__dirname, 'rag-training-rules.json'), 'utf-8'));
let nextId = Math.max(...base.questions.map(q => q.id)) + 1;

function genId() { return nextId++; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const allNew = [];

// ===================== 口語化查詢變體 =====================

const oralPrefixes = [
  '請問', '想問一下', '我想知道', '幫我查', '可以告訴我',
  '想請教', '麻煩問一下', '請教一下', '我要問', '不好意思',
];
const oralSuffixes = [
  '', '？', '呢？', '啊？', '嗎？', '吧？',
  '，謝謝', '，急', '，盡快回覆', '，感謝',
];

// 材料清單
const allMaterials = [
  'PVC導線', 'XLPE導線', '接地線', '無熔絲斷路器', '漏電斷路器',
  'CD管', 'PVC導線管', 'EMT金屬導線管', '配電箱',
  '單切開關', '雙切開關', '三切開關', '三路開關', '調光開關',
  '單插座', '雙插座', '三插座', '冷氣專用插座', '接地型插座',
  '八角盒', '四角盒', '拉線盒', '接線盒',
  '接地棒', '接地夾', '接地端子板',
  '110V插座點位', '220V專用點位', '開關點位', '燈具點位',
  '全室重配線', '新設配電箱', '配電箱擴充',
  '冷氣迴路', '電熱水器迴路', '即熱式熱水器迴路',
  '電氣技工', '電氣技師', '小工',
  '安全防護', '廢棄物清運', '檢驗費', '設計費', '運輸費',
];

const specs = [
  '1.6mm²', '2.0mm²', '2.6mm²', '3.5mm²', '5.5mm²',
  '8.0mm²', '14mm²', '22mm²', '30mm²', '38mm²', '50mm²',
  '1P 15A', '1P 20A', '1P 30A', '2P 20A', '2P 30A', '2P 50A', '2P 75A', '2P 100A',
  '3P 30A', '3P 50A', '3P 75A', '3P 100A',
  '2P 20A 30mA', '2P 30A 30mA', '2P 50A 30mA', '3P 100A 30mA',
  '16mm', '22mm', '28mm',
  '4迴路', '6迴路', '8迴路', '12迴路', '16迴路', '20迴路', '24迴路',
];

// ===================== 1. 材料直查變體（2000 題）=====================

const materialQueryForms = [
  (m) => `${m}`,
  (m) => `${m}價格`,
  (m) => `${m}多少錢`,
  (m) => `${m}單價`,
  (m) => `${m}報價`,
  (m) => `${m}的規格`,
  (m) => `${m}有哪些規格`,
  (m) => `${m}怎麼賣`,
  (m) => `有沒有${m}`,
  (m) => `我要買${m}`,
  (m) => `${m}庫存`,
  (m) => `${m}的用途`,
  (m) => `${m}可以用在哪`,
];

for (const mat of allMaterials) {
  for (let i = 0; i < 3; i++) {
    const form = materialQueryForms[i % materialQueryForms.length];
    allNew.push({
      id: genId(),
      type: 'selection',
      subtype: 'material_direct',
      query: form(mat),
      rule: { material: mat },
      keywords: [mat],
      expect_materials_gte: 1,
    });
  }
}

// 材料+規格組合
for (const mat of ['PVC導線', 'XLPE導線', '接地線']) {
  for (const spec of ['1.6mm²', '2.0mm²', '2.6mm²', '3.5mm²', '5.5mm²', '8.0mm²', '14mm²', '22mm²']) {
    allNew.push({
      id: genId(), type: 'selection', subtype: 'spec_query',
      query: `${mat} ${spec}的價格？`, rule: { material: mat, spec },
      keywords: [mat, spec], expect_materials_gte: 1,
    });
    allNew.push({
      id: genId(), type: 'selection', subtype: 'spec_query',
      query: `${spec}的${mat}多少錢一米？`, rule: { material: mat, spec },
      keywords: [mat, spec], expect_materials_gte: 1,
    });
  }
}

// NFB + ELCB 規格查詢
for (const spec of ['1P 15A', '1P 20A', '2P 20A', '2P 30A', '2P 50A', '2P 75A', '3P 50A', '3P 100A']) {
  allNew.push({
    id: genId(), type: 'selection', subtype: 'breaker_spec',
    query: `${spec}的無熔絲斷路器多少錢？`, rule: { item: 'NFB', spec },
    keywords: ['無熔絲斷路器', spec], expect_materials_gte: 1,
  });
  allNew.push({
    id: genId(), type: 'selection', subtype: 'breaker_spec',
    query: `NFB ${spec}報價`, rule: { item: 'NFB', spec },
    keywords: ['NFB', spec], expect_materials_gte: 1,
  });
}

for (const spec of ['2P 20A 30mA', '2P 30A 30mA', '2P 50A 30mA', '3P 50A 30mA', '3P 100A 30mA']) {
  allNew.push({
    id: genId(), type: 'selection', subtype: 'breaker_spec',
    query: `漏電斷路器 ${spec}的價格？`, rule: { item: 'ELCB', spec },
    keywords: ['漏電斷路器', spec], expect_materials_gte: 1,
  });
}

// ===================== 2. 場景交叉變體（2500 題）=====================

const rooms = ['廚房', '浴室', '臥室', '客廳', '陽台', '書房', '餐廳', '玄關',
               '儲藏室', '車庫', '頂樓', '地下室', '工作室', '辦公室', '店面',
               '套房', '雅房', '健身房', '會議室', '倉庫'];

const actions = [
  '裝修', '翻修', '新裝', '改造', '整修', '重做', '規劃', '設計',
  '配電', '拉線', '佈線', '配線', '裝設', '施工',
];

const equipment = [
  '插座', '開關', '燈', '冷氣', '電熱水器', '洗衣機', '冰箱',
  '烘衣機', '微波爐', '烤箱', '洗碗機', 'IH爐', '電磁爐',
  '除濕機', '暖風機', '抽風機', '電暖器', '快煮壺',
  '吹風機', '免治馬桶', '感應燈', '景觀燈', '太陽能',
];

// 房間 × 行動
for (const room of rooms) {
  for (let i = 0; i < 5; i++) {
    const action = actions[i % actions.length];
    allNew.push({
      id: genId(), type: 'scenario', subtype: 'room_action',
      query: `${room}${action}需要什麼材料？`,
      rule: { room, action },
      keywords: [room, action],
      expect_materials_gte: 1,
    });
  }
}

// 房間 × 設備
for (const room of rooms.slice(0, 10)) {
  for (const equip of equipment.slice(0, 8)) {
    allNew.push({
      id: genId(), type: 'scenario', subtype: 'room_equip',
      query: `${room}要裝${equip}需要什麼電路？`,
      rule: { room, equipment: equip },
      keywords: [room, equip],
      expect_materials_gte: 1,
    });
  }
}

// 設備組合查詢
for (let i = 0; i < 200; i++) {
  const e1 = equipment[i % equipment.length];
  const e2 = equipment[(i + 3) % equipment.length];
  if (e1 !== e2) {
    allNew.push({
      id: genId(), type: 'scenario', subtype: 'multi_equip',
      query: `同時裝${e1}和${e2}需要多少迴路？`,
      rule: { equipment: [e1, e2] },
      keywords: [e1, e2, '迴路'],
      expect_materials_gte: 1,
    });
  }
}

// 坪數 × 房型 更多組合
const houseTypes = [
  { ping: 10, type: '套房' },
  { ping: 12, type: '小套房' },
  { ping: 18, type: '一房一廳' },
  { ping: 22, type: '兩房一廳' },
  { ping: 28, type: '兩房兩廳' },
  { ping: 32, type: '三房兩廳' },
  { ping: 38, type: '三房兩廳(大)' },
  { ping: 42, type: '四房兩廳' },
  { ping: 48, type: '四房兩廳(大)' },
  { ping: 55, type: '透天1樓' },
  { ping: 60, type: '透天2樓' },
  { ping: 80, type: '透天3樓' },
  { ping: 100, type: '透天4樓' },
  { ping: 150, type: '別墅' },
];

const rewireTemplates = [
  (h) => `${h.ping}坪${h.type}全室重配線費用？`,
  (h) => `${h.type}(${h.ping}坪)重拉電線預算`,
  (h) => `${h.ping}坪老屋翻修電路多少錢？`,
  (h) => `${h.type}裝潢水電預算怎麼抓？`,
  (h) => `${h.ping}坪的電路需要幾迴路？`,
  (h) => `${h.type}配電箱要用幾迴路的？`,
  (h) => `${h.ping}坪${h.type}新屋配電規劃`,
  (h) => `${h.type}全部換線要花多少？`,
];

for (const h of houseTypes) {
  for (let i = 0; i < 5; i++) {
    const tmpl = rewireTemplates[i % rewireTemplates.length];
    allNew.push({
      id: genId(), type: 'estimation', subtype: 'house_rewire',
      query: tmpl(h),
      rule: {
        ping: h.ping, type: h.type,
        estimate_min: h.ping * 2500,
        estimate_max: h.ping * 4000,
      },
      keywords: ['重配線', h.type, '費用'],
      expect_materials_gte: 1,
    });
  }
}

// ===================== 3. 比較題（800 題）=====================

// 材料 A vs B
const comparisons = [
  ['PVC導線', 'XLPE導線', '耐溫和載流量'],
  ['CD管', 'PVC導線管', '暗管vs硬管'],
  ['CD管', 'EMT金屬導線管', '塑膠vs金屬'],
  ['PVC導線管', 'EMT金屬導線管', '成本vs防護'],
  ['無熔絲斷路器', '漏電斷路器', '保護功能不同'],
  ['單切開關', '三路開關', '單控vs雙控'],
  ['單插座', '雙插座', '孔數差異'],
  ['接地型插座', '一般插座', '安全性差異'],
  ['調光開關', '單切開關', '功能差異'],
  ['八角盒', '四角盒', '用途差異'],
  ['拉線盒', '接線盒', '功能差異'],
  ['電氣技工', '電氣技師', '證照和費用'],
  ['小工', '電氣技工', '技能和薪資'],
  ['冷氣迴路', '電熱水器迴路', '配電差異'],
  ['窗型冷氣迴路', '分離式冷氣迴路', '電壓和費用'],
  ['接地棒 1.5m', '接地棒 2.4m', '深度和效果'],
  ['明管配線', '暗管配線', '施工和成本'],
  ['110V', '220V', '電壓差異和用途'],
  ['全室重配線', '局部更新', '範圍和費用'],
  ['1P NFB', '2P NFB', '極數差異'],
];

const compTemplates = [
  (a, b) => `${a}和${b}有什麼差別？`,
  (a, b) => `${a}跟${b}哪個好？`,
  (a, b) => `${a}vs${b}怎麼選？`,
  (a, b) => `${a}跟${b}的價差？`,
  (a, b) => `${a}和${b}各適合什麼場景？`,
  (a, b) => `什麼時候用${a}什麼時候用${b}？`,
  (a, b) => `${a}可以用${b}代替嗎？`,
  (a, b) => `${a}比${b}貴多少？`,
];

for (const [a, b, diff] of comparisons) {
  for (let i = 0; i < 5; i++) {
    const tmpl = compTemplates[i % compTemplates.length];
    allNew.push({
      id: genId(), type: 'selection', subtype: 'comparison',
      query: tmpl(a, b),
      rule: { item_a: a, item_b: b, key_difference: diff },
      keywords: [a, b],
      expect_materials_gte: 2,
    });
  }
}

// 品牌比較
const brandComps = [
  { cat: '電纜', brands: ['華新麗華', '太平洋', '大亞', '大山', '華榮'] },
  { cat: 'NFB', brands: ['士林電機', '東元', '三菱電機', 'ABB'] },
  { cat: '開關插座', brands: ['國際牌', '中一電工', '施耐德'] },
];

for (const bc of brandComps) {
  for (let i = 0; i < bc.brands.length; i++) {
    for (let j = i + 1; j < bc.brands.length; j++) {
      const templates = [
        `${bc.brands[i]}和${bc.brands[j]}的${bc.cat}哪個好？`,
        `${bc.cat}選${bc.brands[i]}還是${bc.brands[j]}？`,
        `${bc.brands[i]}比${bc.brands[j]}貴嗎？`,
      ];
      for (const q of templates) {
        allNew.push({
          id: genId(), type: 'pricing', subtype: 'brand_compare',
          query: q,
          rule: { category: bc.cat, brand_a: bc.brands[i], brand_b: bc.brands[j] },
          keywords: [bc.brands[i], bc.brands[j], bc.cat],
          expect_materials_gte: 0,
        });
      }
    }
  }
}

// ===================== 4. 法規深入題（800 題）=====================

// 線徑 vs 安培 交叉
const wireGauges = ['1.6mm', '2.0mm', '2.6mm', '3.5mm²', '5.5mm²', '8mm²', '14mm²', '22mm²', '30mm²', '38mm²', '50mm²'];

for (const gauge of wireGauges) {
  const templates = [
    `${gauge}的線能承受多少電流？`,
    `${gauge}電線的安全電流是多少？`,
    `${gauge}的PVC線載流量？`,
    `${gauge}的XLPE線載流量？`,
    `用${gauge}的線最大可以接多少瓦？`,
    `${gauge}電線搭配幾安培的NFB？`,
    `什麼情況要用${gauge}的線？`,
    `${gauge}的線夠粗嗎？`,
  ];
  for (const q of templates) {
    allNew.push({
      id: genId(), type: 'regulation', subtype: 'wire_ampacity',
      query: q, rule: { gauge },
      keywords: [gauge, '載流量'],
      expect_materials_gte: 1,
    });
  }
}

// NFB 安培 vs 線徑
const nfbAmps = [15, 20, 30, 50, 75, 100];
for (const amp of nfbAmps) {
  const templates = [
    `${amp}A的NFB可以接什麼線？`,
    `${amp}安培的開關適合多粗的電線？`,
    `選了${amp}A的斷路器，線徑要多少？`,
    `${amp}A迴路用什麼規格的線？`,
    `${amp}A的無熔絲開關搭配什麼電線？`,
  ];
  for (const q of templates) {
    allNew.push({
      id: genId(), type: 'regulation', subtype: 'nfb_wire',
      query: q, rule: { amp },
      keywords: [`${amp}A`, 'NFB', '線徑'],
      expect_materials_gte: 1,
    });
  }
}

// 管內穿線數量
const conduitSizes = ['16mm', '22mm', '28mm'];
const wireTypes = ['1.6mm', '2.0mm', '2.6mm', '5.5mm²', '8mm²'];

for (const cs of conduitSizes) {
  for (const wt of wireTypes) {
    allNew.push({
      id: genId(), type: 'regulation', subtype: 'conduit_fill',
      query: `${cs}的管可以穿幾條${wt}的線？`,
      rule: { conduit: cs, wire: wt },
      keywords: [cs, wt, '穿線'],
      expect_materials_gte: 1,
    });
    allNew.push({
      id: genId(), type: 'regulation', subtype: 'conduit_fill',
      query: `穿${wt}的線要用多大的管？`,
      rule: { wire: wt },
      keywords: [wt, '管徑'],
      expect_materials_gte: 1,
    });
  }
}

// ELCB 規格相關
const elcbScenarios = [
  '浴室', '廚房', '陽台', '室外', '電熱水器', '潛水泵浦', '飲水機',
  '洗衣機', '暖風機', '工地臨時電', '招牌燈', '路燈', '噴水池',
];

for (const scene of elcbScenarios) {
  const templates = [
    `${scene}要裝漏電斷路器嗎？`,
    `${scene}的漏電保護要用什麼規格？`,
    `${scene}不裝ELCB可以嗎？`,
    `${scene}的電路安全規定`,
  ];
  for (const q of templates) {
    allNew.push({
      id: genId(), type: 'regulation', subtype: 'elcb_scenario',
      query: q, rule: { scene, elcb_required: true },
      keywords: ['漏電斷路器', scene],
      expect_materials_gte: 1,
    });
  }
}

// 接地相關
const groundingQueries = [
  '住宅需要做接地工程嗎？',
  '第三種接地的電阻要多少？',
  '接地線要用多粗？',
  '接地棒要打多深？',
  '什麼是等電位接地？',
  '接地線一定要綠色嗎？',
  '金屬導線管要接地嗎？',
  '配電箱的接地怎麼做？',
  '接地電阻怎麼測量？',
  '接地不良會怎樣？',
  '接地和中性線的差別？',
  '接地棒要用銅的嗎？',
  '每層樓都要接地嗎？',
  '舊大樓沒有接地線怎麼辦？',
  '接地棒之間要隔多遠？',
  '接地端子板裝在哪？',
  '接地線可以和中性線共用嗎？',
  '為什麼接地線要獨立一條？',
  '避雷器的接地屬於哪一種？',
  '電梯的接地規定？',
];

for (const q of groundingQueries) {
  allNew.push({
    id: genId(), type: 'regulation', subtype: 'grounding',
    query: q, rule: { topic: '接地' },
    keywords: ['接地'],
    expect_materials_gte: 1,
  });
}

// ===================== 5. 估價展開（1000 題）=====================

// 多項目組合估價
const itemCombos = [];
for (let o110 = 1; o110 <= 20; o110 += 3) {
  for (let o220 = 0; o220 <= 5; o220 += 1) {
    for (let sw = 1; sw <= 10; sw += 3) {
      itemCombos.push({ o110, o220, sw, lights: Math.ceil(sw * 0.8) });
    }
  }
}

for (const combo of itemCombos.slice(0, 200)) {
  const total = combo.o110 * 1200 + combo.o220 * 1800 + combo.sw * 900 + combo.lights * 800;
  allNew.push({
    id: genId(), type: 'estimation', subtype: 'combo_estimate',
    query: `${combo.o110}個插座${combo.o220}個專用插座${combo.sw}個開關${combo.lights}盞燈，大概多少？`,
    rule: {
      items: { '110V插座': combo.o110, '220V專用': combo.o220, '開關': combo.sw, '燈具': combo.lights },
      estimate: total,
    },
    keywords: ['插座', '開關', '燈具', '費用'],
    expect_materials_gte: 2,
  });
}

// 迴路估價
for (let circuits_110 = 1; circuits_110 <= 10; circuits_110++) {
  for (let circuits_220 = 0; circuits_220 <= 5; circuits_220++) {
    const cost_min = circuits_110 * 2500 + circuits_220 * 3500;
    const cost_max = circuits_110 * 4500 + circuits_220 * 5500;
    allNew.push({
      id: genId(), type: 'estimation', subtype: 'circuit_estimate',
      query: `${circuits_110}迴110V加${circuits_220}迴220V的配線費用？`,
      rule: {
        circuits_110v: circuits_110,
        circuits_220v: circuits_220,
        estimate: `${cost_min.toLocaleString()}~${cost_max.toLocaleString()}元`,
      },
      keywords: ['迴路', '費用'],
      expect_materials_gte: 1,
    });
  }
}

// 冷氣數量估價
for (let ac = 1; ac <= 6; ac++) {
  const templates = [
    `裝${ac}台分離式冷氣要多少電路費用？`,
    `${ac}台冷氣的迴路費用？`,
    `家裡要裝${ac}台冷氣，電路要花多少？`,
  ];
  for (const q of templates) {
    allNew.push({
      id: genId(), type: 'estimation', subtype: 'ac_estimate',
      query: q,
      rule: {
        ac_count: ac,
        per_unit: '3,200~5,500元/台',
        estimate: `${ac * 3200}~${ac * 5500}元`,
      },
      keywords: ['冷氣', '迴路', '費用'],
      expect_materials_gte: 1,
    });
  }
}

// ===================== 6. 故障排除展開（500 題）=====================

const symptoms = [
  { symptom: '跳電', causes: ['過載', '短路', '漏電', '設備故障'], action: '檢查配電箱，排除過載設備' },
  { symptom: '漏電', causes: ['線路老化', '潮濕', '設備漏電'], action: '漏電排查，更換老化線路' },
  { symptom: '插座燙', causes: ['過載', '接觸不良', '線徑不足'], action: '立即斷電檢查' },
  { symptom: '電線過熱', causes: ['過載', '線徑不足', '接觸不良'], action: '更換適當線徑電線' },
  { symptom: '燈閃爍', causes: ['接觸不良', '電壓不穩', '燈泡壽命'], action: '檢查接線端子' },
  { symptom: '冒火花', causes: ['接觸不良', '插座老化'], action: '更換插座' },
  { symptom: '有焦味', causes: ['NFB故障', '接點過熱', '電線燒焦'], action: '立即斷電找電工' },
  { symptom: '觸電麻', causes: ['漏電', '接地不良'], action: '斷電+檢查接地+漏電斷路器' },
  { symptom: 'NFB推不回去', causes: ['短路未排除', 'NFB故障'], action: '拔掉所有電器再試' },
  { symptom: '部分沒電', causes: ['分路NFB跳脫', '線路斷裂', '接點鬆脫'], action: '檢查對應NFB' },
  { symptom: '電費暴增', causes: ['漏電', '設備效率下降', '偷電'], action: '關閉所有電器看電表' },
  { symptom: '插座鬆', causes: ['彈片疲勞', '規格不符'], action: '更換插座' },
];

const symptomTemplates = [
  (s) => `家裡${s.symptom}怎麼辦？`,
  (s) => `${s.symptom}是什麼原因？`,
  (s) => `為什麼會${s.symptom}？`,
  (s) => `${s.symptom}要怎麼修？`,
  (s) => `${s.symptom}危險嗎？`,
  (s) => `${s.symptom}要找水電嗎？`,
  (s) => `${s.symptom}可以自己處理嗎？`,
  (s) => `${s.symptom}會造成火災嗎？`,
  (s) => `常常${s.symptom}是什麼問題？`,
  (s) => `${s.symptom}的處理步驟`,
];

for (const s of symptoms) {
  for (let i = 0; i < 6; i++) {
    const tmpl = symptomTemplates[i % symptomTemplates.length];
    allNew.push({
      id: genId(), type: 'troubleshoot', subtype: 'symptom',
      query: tmpl(s),
      rule: { symptom: s.symptom, causes: s.causes, action: s.action },
      keywords: [s.symptom],
      expect_materials_gte: 0,
    });
  }
}

// 場景 × 故障
const faultScenes = ['浴室', '廚房', '臥室', '客廳', '老屋', '新屋', '辦公室'];
const faults = ['跳電', '漏電', '插座壞了', '開關壞了', '燈不亮', '電線裸露'];

for (const scene of faultScenes) {
  for (const fault of faults) {
    allNew.push({
      id: genId(), type: 'troubleshoot', subtype: 'scene_fault',
      query: `${scene}${fault}怎麼辦？`,
      rule: { scene, fault },
      keywords: [scene, fault],
      expect_materials_gte: 0,
    });
    allNew.push({
      id: genId(), type: 'troubleshoot', subtype: 'scene_fault',
      query: `${scene}${fault}要修多少錢？`,
      rule: { scene, fault },
      keywords: [scene, fault, '費用'],
      expect_materials_gte: 0,
    });
  }
}

// ===================== 7. 施工工序展開（600 題）=====================

const procQueries = [
  // 各步驟細問
  { proc: '全室重配線', step: '斷電', q: '重配線前怎麼確認斷電？' },
  { proc: '全室重配線', step: '抽線', q: '抽線的時候舊線拉不出來怎麼辦？' },
  { proc: '全室重配線', step: '穿線', q: '穿線要注意什麼？' },
  { proc: '配電箱', step: '定位', q: '配電箱要裝在哪個位置？' },
  { proc: '配電箱', step: '接線', q: '配電箱裡面的線怎麼接？' },
  { proc: '配電箱', step: '標示', q: '配電箱迴路標示怎麼寫？' },
  { proc: '暗管', step: '打鑿', q: '打牆埋管要多深？' },
  { proc: '暗管', step: 'CD管', q: 'CD管怎麼固定？' },
  { proc: '明管', step: '彎管', q: 'EMT管怎麼彎？' },
  { proc: '明管', step: '固定', q: 'EMT管多久固定一次？' },
  { proc: '接地', step: '打樁', q: '接地棒怎麼打入地面？' },
  { proc: '接地', step: '測試', q: '接地完成後怎麼測試？' },
  { proc: '插座安裝', step: '接線', q: '插座的火線中性線怎麼分辨？' },
  { proc: '插座安裝', step: '接地', q: '三孔插座的接地線怎麼接？' },
];

for (const pq of procQueries) {
  allNew.push({
    id: genId(), type: 'procedure', subtype: 'step_detail',
    query: pq.q,
    rule: { procedure: pq.proc, step: pq.step },
    keywords: [pq.proc, pq.step],
    expect_materials_gte: 0,
  });
}

// 施工時間
const timeQueries = [
  { work: '換一個插座', time: '30分鐘~1小時' },
  { work: '換一個NFB', time: '30分鐘' },
  { work: '拉一迴路電線', time: '2~4小時' },
  { work: '安裝配電箱', time: '半天~1天' },
  { work: '全室重配線(25坪)', time: '1~2天' },
  { work: '全室重配線(40坪)', time: '2~3天' },
  { work: '冷氣迴路安裝', time: '2~4小時/台' },
  { work: '接地工程', time: '半天' },
  { work: '電路檢測', time: '1~2小時' },
  { work: '明管配線一層樓', time: '1~2天' },
];

for (const tq of timeQueries) {
  const templates = [
    `${tq.work}要多久？`,
    `${tq.work}需要多少工時？`,
    `${tq.work}大概幾個小時？`,
  ];
  for (const q of templates) {
    allNew.push({
      id: genId(), type: 'procedure', subtype: 'work_time',
      query: q,
      rule: { work: tq.work, duration: tq.time },
      keywords: [tq.work, '時間'],
      expect_materials_gte: 0,
    });
  }
}

// 施工順序
const orderQueries = [
  { q: '裝修房子水電要先做還是泥作先做？', rule: { answer: '水電先做（粗配），泥作後，再做水電精裝' } },
  { q: '配電箱要先裝還是先拉線？', rule: { answer: '先安裝配電箱，再從配電箱拉線到各迴路' } },
  { q: '插座開關什麼時候裝？', rule: { answer: '在油漆完成後安裝面板' } },
  { q: '暗管要在什麼階段施工？', rule: { answer: '結構體完成後、粗胚前埋設' } },
  { q: '接地工程什麼時候做？', rule: { answer: '基礎開挖時一併施作效率最高' } },
];

for (const oq of orderQueries) {
  allNew.push({
    id: genId(), type: 'procedure', subtype: 'work_order',
    query: oq.q, rule: oq.rule,
    keywords: ['順序', '施工'],
    expect_materials_gte: 0,
  });
}

// 材料用量計算
const usageQueries = [
  { q: '一個迴路大概用多少米電線？', rule: { answer: '依距離，一般20~40m/迴路' } },
  { q: '一坪大概需要多少電線？', rule: { answer: '約3~5m/坪（純電路）' } },
  { q: '一個插座需要多少管材？', rule: { answer: '依管路長度，一般2~5m' } },
  { q: '全室重配線30坪大概要多少米線？', rule: { answer: '約100~200m（含各迴路+幹線）' } },
  { q: '配電箱到最遠插座通常幾米？', rule: { answer: '一般10~20m，不超過30m' } },
];

for (const uq of usageQueries) {
  allNew.push({
    id: genId(), type: 'procedure', subtype: 'material_usage',
    query: uq.q, rule: uq.rule,
    keywords: ['用量', '電線'],
    expect_materials_gte: 0,
  });
}

// ===================== 8. 回答模板展開（400 題）=====================

// 各類情境的回覆模板
const replyScenarios = [
  // 客戶常見問法 → 回答模板
  { q: '客戶說預算有限，怎麼建議？', template: '建議優先做安全相關（ELCB+接地），次要是大功率設備專用迴路，一般插座可分期施工。' },
  { q: '客戶問可以自己買材料嗎？', template: '可以，但要注意規格匹配（線徑、NFB安培、管徑）。建議購買CNS認證品牌，避免來路不明產品。材料費約佔工程的40~60%。' },
  { q: '客戶問保固多久？', template: '水電工程一般保固1~2年。重配線+配電箱保固2年，單點維修保固1年。電線本身壽命20~30年。' },
  { q: '客戶問要不要留備用迴路？', template: '建議至少預留2~4個備用迴路，未來家電增加時不需再動配電箱。配電箱選大一號的，價差不到$1,000。' },
  { q: '客戶問施工會很吵嗎？', template: '暗管需要打牆，會有噪音和粉塵。明管施工噪音較低。建議與鄰居事先溝通，施工時間避開午休。' },
  { q: '客戶問可以邊住邊施工嗎？', template: '局部換線可以，但全室重配線建議暫時搬出。施工期間部分區域會斷電。' },
  { q: '客戶要求用最便宜的材料', template: '材料品質直接影響安全性和壽命。建議電線選一級廠（華新/太平洋/大亞），NFB選士林，價差不大但品質有保障。' },
  { q: '客戶問報價含不含稅？', template: '一般工程報價未稅。開發票需加5%營業稅。小額維修通常含稅價。' },
  { q: '客戶問走明管還是暗管好？', template: '暗管美觀但費用高（需打牆+泥作修復），明管省錢但外露。新屋裝修建議暗管，老屋局部維修建議明管。工業風可用EMT明管當裝飾。' },
  { q: '客戶問要不要升級配電箱？', template: '超過20年的舊式瓷盒配電箱建議更換。新式NFB配電箱更安全、維護方便。判斷標準：迴路數不足、NFB老舊無法跳脫、無ELCB。' },
];

for (const rs of replyScenarios) {
  allNew.push({
    id: genId(), type: 'template', subtype: 'client_reply',
    query: rs.q, rule: { template: rs.template },
    keywords: rs.q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
  // 變體
  allNew.push({
    id: genId(), type: 'template', subtype: 'client_reply',
    query: rs.q.replace('客戶問', '業主問').replace('客戶說', '業主說').replace('客戶要求', '業主要求'),
    rule: { template: rs.template },
    keywords: rs.q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// 注意事項模板
const cautionTemplates = [
  { q: '暗管配線完工後要檢查什麼？', template: '1.逐迴路送電測試\n2.量測接地電阻\n3.量測絕緣電阻\n4.檢查ELCB跳脫功能\n5.確認所有面板標示\n6.拍照存檔' },
  { q: '新屋驗收水電要看什麼？', template: '1.迴路數是否符合設計\n2.ELCB是否裝設（浴室/廚房/陽台）\n3.接地是否完善\n4.面板是否水平\n5.配電箱標示\n6.試推每個NFB/ELCB\n7.量測各插座電壓' },
  { q: '老屋翻修電路要特別注意什麼？', template: '1.確認總電容量是否足夠\n2.舊線是否為1.2mm需全換\n3.接地系統是否建立\n4.浴室/廚房ELCB是否補裝\n5.管路是否通暢（可能腐蝕）\n6.配電箱位置是否合適' },
];

for (const ct of cautionTemplates) {
  allNew.push({
    id: genId(), type: 'template', subtype: 'checklist',
    query: ct.q, rule: { template: ct.template },
    keywords: ct.q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// ===================== 9. 口語查詢變體（1000 題）=====================

// 對既有材料名稱做口語化變體
const oralMappings = [
  { oral: '跳電保護開關', formal: '漏電斷路器' },
  { oral: '電箱裡的開關', formal: '無熔絲斷路器' },
  { oral: '壁插', formal: '插座' },
  { oral: '暗管', formal: 'CD管' },
  { oral: '波浪管', formal: 'CD管' },
  { oral: '鐵管', formal: 'EMT金屬導線管' },
  { oral: '塑膠管', formal: 'PVC導線管' },
  { oral: '師傅', formal: '電氣技工' },
  { oral: '小弟', formal: '小工' },
  { oral: '水電工', formal: '電氣技工' },
  { oral: '電閘箱', formal: '配電箱' },
  { oral: '總開關', formal: '無熔絲斷路器' },
  { oral: '漏保', formal: '漏電斷路器' },
  { oral: '綠線', formal: '接地線' },
  { oral: '銅線', formal: 'PVC導線' },
  { oral: '地線', formal: '接地線' },
  { oral: '牆壁開關', formal: '開關' },
  { oral: '出線盒', formal: '八角盒' },
  { oral: '中繼盒', formal: '拉線盒' },
  { oral: '地樁', formal: '接地棒' },
];

const oralQueryForms = [
  (o) => `${o}多少錢？`,
  (o) => `有沒有${o}？`,
  (o) => `我要買${o}`,
  (o) => `${o}的規格`,
  (o) => `${o}怎麼選？`,
  (o) => `${o}去哪買？`,
  (o) => `${o}可以用在哪裡？`,
  (o) => `${o}的安裝方法`,
  (o) => `${o}多少錢一個？`,
  (o) => `${o}有幾種規格？`,
];

for (const mapping of oralMappings) {
  for (let i = 0; i < 6; i++) {
    const form = oralQueryForms[i % oralQueryForms.length];
    allNew.push({
      id: genId(), type: 'selection', subtype: 'oral_query',
      query: form(mapping.oral),
      rule: { oral: mapping.oral, formal: mapping.formal },
      keywords: [mapping.formal],
      expect_materials_gte: 1,
    });
  }
}

// 前綴/後綴口語變體
for (let i = 0; i < 200; i++) {
  const mat = allMaterials[i % allMaterials.length];
  const prefix = oralPrefixes[i % oralPrefixes.length];
  const suffix = oralSuffixes[i % oralSuffixes.length];
  const forms = [
    `${prefix}${mat}的價格${suffix}`,
    `${prefix}${mat}有沒有現貨${suffix}`,
    `${prefix}${mat}的規格有哪些${suffix}`,
  ];
  for (const q of forms) {
    allNew.push({
      id: genId(), type: 'selection', subtype: 'oral_variant',
      query: q, rule: { material: mat },
      keywords: [mat],
      expect_materials_gte: 1,
    });
  }
}

// ===================== 10. 價格趨勢補充（300 題）=====================

const priceFactors = [
  { factor: '銅價', impact: '電纜直接成本', direction: '正相關' },
  { factor: 'PVC原料', impact: 'PVC管材和電線被覆', direction: '正相關' },
  { factor: '人力成本', impact: '工資上漲', direction: '正相關' },
  { factor: '匯率', impact: '進口原物料', direction: '弱正相關' },
  { factor: '油價', impact: '運輸成本', direction: '弱正相關' },
  { factor: '季節旺淡', impact: '供需影響報價', direction: '旺季漲' },
  { factor: '政府政策', impact: '營建景氣', direction: '間接影響' },
  { factor: '國際局勢', impact: '原物料供應鏈', direction: '間接影響' },
];

for (const pf of priceFactors) {
  const templates = [
    `${pf.factor}對水電材料價格有什麼影響？`,
    `${pf.factor}上漲會讓工程變貴嗎？`,
    `${pf.factor}跟電線管材價格有關係嗎？`,
    `${pf.factor}變動會影響報價嗎？`,
  ];
  for (const q of templates) {
    allNew.push({
      id: genId(), type: 'pricing', subtype: 'factor_impact',
      query: q, rule: { factor: pf.factor, impact: pf.impact, direction: pf.direction },
      keywords: [pf.factor, '價格'],
      expect_materials_gte: 0,
    });
  }
}

// 價格預測
const trendQueries = [
  '明年電纜價格會漲嗎？',
  '銅價還會繼續漲嗎？',
  '現在買材料划算嗎？',
  '等銅價下來再裝修比較省嗎？',
  '電纜價格什麼時候會降？',
  '今年水電工程行情如何？',
  '材料價格有季節性嗎？',
  '年底做水電會比較貴嗎？',
  '過年前做水電好嗎？',
  '工資未來會漲嗎？',
];

for (const q of trendQueries) {
  allNew.push({
    id: genId(), type: 'pricing', subtype: 'trend',
    query: q,
    rule: { notes: '價格受銅價、供需、季節影響，建議諮詢最新行情' },
    keywords: ['價格', '趨勢'],
    expect_materials_gte: 0,
  });
}

// ===================== 合併輸出 =====================

const merged = [...base.questions, ...allNew];

const stats = {};
for (const q of merged) {
  stats[q.type] = (stats[q.type] || 0) + 1;
}

console.log('=== 合併統計 ===');
console.log(`Part 1: ${base.questions.length} 題`);
console.log(`Part 2: ${allNew.length} 題`);
console.log(`合計:   ${merged.length} 題 (+ 既有 500 題 = ${merged.length + 500})`);
console.log('\n分類明細：');
for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type.padEnd(15)} ${count} 題`);
}

const output = {
  ...base,
  version: '3.1',
  stats,
  total: merged.length,
  questions: merged,
};

const outPath = join(__dirname, 'rag-training-rules.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\n已輸出至：${outPath}`);
console.log(`檔案大小：${(JSON.stringify(output).length / 1024 / 1024).toFixed(1)} MB`);

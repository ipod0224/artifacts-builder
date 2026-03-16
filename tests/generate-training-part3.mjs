#!/usr/bin/env node
/**
 * 訓練資料集 Part 3：大規模交叉擴展
 * 目標：從 2,901 擴充到 ~9,500
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(__dirname, 'rag-training-rules.json'), 'utf-8'));
let nextId = Math.max(...base.questions.map(q => q.id)) + 1;
function genId() { return nextId++; }

const allNew = [];

// ===================== 大量場景 × 動作 × 數量組合 =====================

const rooms = ['廚房','浴室','臥室','客廳','陽台','書房','餐廳','玄關',
  '儲藏室','車庫','頂樓','地下室','工作室','辦公室','店面','套房',
  '雅房','倉庫','實驗室','機房','神明廳','洗衣間','更衣室','走廊',
  '樓梯間','電梯間','屋頂','庭院','停車場','警衛室'];

const needsQs = [
  (r) => `${r}需要幾個插座？`,
  (r) => `${r}配幾迴路夠？`,
  (r) => `${r}要裝幾個開關？`,
  (r) => `${r}建議幾盞燈？`,
  (r) => `${r}需要專用迴路嗎？`,
  (r) => `${r}要用多粗的線？`,
  (r) => `${r}要裝漏電斷路器嗎？`,
  (r) => `${r}管線用什麼材質？`,
  (r) => `${r}接地怎麼做？`,
  (r) => `${r}的電路預算？`,
  (r) => `${r}配電怎麼規劃？`,
  (r) => `${r}插座高度要多少？`,
  (r) => `${r}需要220V嗎？`,
  (r) => `${r}用PVC管還是EMT管？`,
  (r) => `${r}電路安全注意事項？`,
];

for (const room of rooms) {
  for (let i = 0; i < needsQs.length; i++) {
    allNew.push({
      id: genId(), type: 'scenario', subtype: 'room_need',
      query: needsQs[i](room),
      rule: { room }, keywords: [room],
      expect_materials_gte: 1,
    });
  }
}

// ===================== 電器 × 電路需求展開 =====================

const appliances = [
  { name: '冷氣', volt: 220, watt: 1500, wire: '5.5mm²', nfb: '2P-20A' },
  { name: '電熱水器', volt: 220, watt: 3000, wire: '5.5mm²', nfb: '2P-30A' },
  { name: '即熱式熱水器', volt: 220, watt: 8000, wire: '14mm²', nfb: '2P-50A' },
  { name: '烤箱', volt: 220, watt: 1500, wire: '5.5mm²', nfb: '2P-20A' },
  { name: 'IH爐', volt: 220, watt: 2000, wire: '5.5mm²', nfb: '2P-20A' },
  { name: '洗碗機', volt: 220, watt: 1800, wire: '5.5mm²', nfb: '2P-20A' },
  { name: '烘衣機', volt: 220, watt: 2500, wire: '5.5mm²', nfb: '2P-30A' },
  { name: '電磁爐', volt: 220, watt: 1300, wire: '5.5mm²', nfb: '2P-20A' },
  { name: '微波爐', volt: 110, watt: 1200, wire: '2.0mm', nfb: '1P-20A' },
  { name: '電鍋', volt: 110, watt: 800, wire: '2.0mm', nfb: '1P-20A' },
  { name: '冰箱', volt: 110, watt: 150, wire: '2.0mm', nfb: '1P-20A' },
  { name: '洗衣機', volt: 110, watt: 500, wire: '2.0mm', nfb: '1P-20A' },
  { name: '吹風機', volt: 110, watt: 1200, wire: '2.0mm', nfb: '1P-20A' },
  { name: '除濕機', volt: 110, watt: 300, wire: '2.0mm', nfb: '1P-20A' },
  { name: '暖風機', volt: 220, watt: 1500, wire: '5.5mm²', nfb: '2P-20A' },
  { name: '快煮壺', volt: 110, watt: 1500, wire: '2.6mm', nfb: '1P-20A' },
  { name: '電暖器', volt: 110, watt: 1200, wire: '2.0mm', nfb: '1P-20A' },
  { name: '抽油煙機', volt: 110, watt: 300, wire: '2.0mm', nfb: '1P-20A' },
  { name: '免治馬桶', volt: 110, watt: 1200, wire: '2.0mm', nfb: '1P-20A' },
  { name: '加壓泵浦', volt: 220, watt: 750, wire: '5.5mm²', nfb: '2P-20A' },
  { name: '電焊機', volt: 220, watt: 5000, wire: '8mm²', nfb: '2P-50A' },
  { name: '空壓機', volt: 220, watt: 3700, wire: '8mm²', nfb: '2P-30A' },
  { name: '充電樁', volt: 220, watt: 7000, wire: '14mm²', nfb: '2P-50A' },
  { name: '伺服器', volt: 110, watt: 500, wire: '2.0mm', nfb: '1P-20A' },
];

const appQs = [
  (a) => `${a.name}需要什麼電路？`,
  (a) => `裝${a.name}要拉什麼線？`,
  (a) => `${a.name}要用幾安培的NFB？`,
  (a) => `${a.name}用${a.volt}V嗎？`,
  (a) => `${a.name}的電線要多粗？`,
  (a) => `${a.name}需要專用迴路嗎？`,
  (a) => `${a.name}要裝漏電斷路器嗎？`,
  (a) => `${a.name}功率${a.watt}W要用什麼線？`,
  (a) => `${a.name}的安培數是多少？`,
  (a) => `安裝${a.name}的電路費用？`,
];

for (const app of appliances) {
  for (let i = 0; i < appQs.length; i++) {
    allNew.push({
      id: genId(), type: 'scenario', subtype: 'appliance_detail',
      query: appQs[i](app),
      rule: { appliance: app.name, volt: app.volt, watt: app.watt, wire: app.wire, nfb: app.nfb },
      keywords: [app.name, `${app.volt}V`],
      expect_materials_gte: 1,
    });
  }
}

// ===================== 估價：具體數量排列 =====================

// 插座 1~30 個各問一次
for (let n = 1; n <= 30; n++) {
  allNew.push({
    id: genId(), type: 'estimation', subtype: 'outlet_count',
    query: `加${n}個110V插座大概多少錢？`,
    rule: { count: n, unit_price: 1200, estimate: n * 1200 },
    keywords: ['插座', '費用'], expect_materials_gte: 1,
  });
}

// 220V 插座 1~10 個
for (let n = 1; n <= 10; n++) {
  allNew.push({
    id: genId(), type: 'estimation', subtype: 'outlet_220_count',
    query: `${n}個220V專用插座費用？`,
    rule: { count: n, unit_price: 1800, estimate: n * 1800 },
    keywords: ['220V', '插座', '費用'], expect_materials_gte: 1,
  });
}

// 開關 1~20 個
for (let n = 1; n <= 20; n++) {
  allNew.push({
    id: genId(), type: 'estimation', subtype: 'switch_count',
    query: `${n}個開關點位多少錢？`,
    rule: { count: n, unit_price: 900, estimate: n * 900 },
    keywords: ['開關', '費用'], expect_materials_gte: 1,
  });
}

// 燈具 1~20 個
for (let n = 1; n <= 20; n++) {
  allNew.push({
    id: genId(), type: 'estimation', subtype: 'light_count',
    query: `${n}盞燈的配線費用？`,
    rule: { count: n, unit_price: 800, estimate: n * 800 },
    keywords: ['燈具', '費用'], expect_materials_gte: 1,
  });
}

// 線材用量估算
const wireLengths = [5, 10, 15, 20, 25, 30, 40, 50, 80, 100];
const wireTypes = [
  { name: 'PVC導線 2.0mm²', price: 10 },
  { name: 'PVC導線 5.5mm²', price: 28 },
  { name: 'XLPE導線 5.5mm²', price: 38 },
  { name: 'XLPE導線 14mm²', price: 95 },
  { name: 'XLPE導線 22mm²', price: 145 },
  { name: '接地線 5.5mm²', price: 32 },
];

for (const wt of wireTypes) {
  for (const len of wireLengths) {
    allNew.push({
      id: genId(), type: 'estimation', subtype: 'wire_length',
      query: `${len}米${wt.name}多少錢？`,
      rule: { wire: wt.name, length: len, unit_price: wt.price, total: len * wt.price },
      keywords: [wt.name, '費用'], expect_materials_gte: 1,
    });
  }
}

// 管材用量估算
const conduitTypes = [
  { name: 'CD管 16mm', price: 12 },
  { name: 'CD管 22mm', price: 18 },
  { name: 'PVC管 22mm', price: 22 },
  { name: 'EMT管 22mm', price: 60 },
  { name: 'EMT管 28mm', price: 85 },
];

for (const ct of conduitTypes) {
  for (const len of [5, 10, 20, 30, 50]) {
    allNew.push({
      id: genId(), type: 'estimation', subtype: 'conduit_length',
      query: `${len}米${ct.name}多少錢？`,
      rule: { conduit: ct.name, length: len, unit_price: ct.price, total: len * ct.price },
      keywords: [ct.name, '費用'], expect_materials_gte: 1,
    });
  }
}

// ===================== 法規：更多 Q&A =====================

// 電氣安全知識
const safetyKnowledge = [
  { q: '電線走天花板需要用管嗎？', a: '是，必須使用導線管保護' },
  { q: '電線可以直接埋在水泥裡嗎？', a: '不可以，必須用管保護（CD管或PVC管）' },
  { q: '照明迴路用1.6mm夠嗎？', a: '法規最低標準，建議用2.0mm增加安全裕度' },
  { q: '一個20A迴路最多接幾個插座？', a: '建議不超過6個，總負載不超過16A（80%）' },
  { q: '110V和220V可以共用管嗎？', a: '不建議，不同電壓迴路應分管' },
  { q: '接地線可以用白色的嗎？', a: '不可以，法規規定接地線必須為綠色或綠黃條紋' },
  { q: '電線接頭可以藏在牆裡嗎？', a: '不建議，接頭應在接線盒/出線盒內，便於檢修' },
  { q: '浴室可以裝一般插座嗎？', a: '不可以，必須裝設防水型插座且加裝ELCB' },
  { q: '延長線可以埋在牆裡嗎？', a: '絕對不可以，延長線非固定配線用途' },
  { q: '電熱水器不接地可以嗎？', a: '不可以，強制要求接地+ELCB雙重保護' },
  { q: '管內電線可以有接頭嗎？', a: '不建議，管內導線應為連續不中斷' },
  { q: 'NFB要多久更換？', a: '建議10~15年更換' },
  { q: '電線的壽命有多長？', a: 'PVC電線壽命約20~30年，XLPE約30~40年' },
  { q: '為什麼配電箱要標示迴路名稱？', a: '便於故障排查和維護，法規要求' },
  { q: '可以用鋁線代替銅線嗎？', a: '住宅一般不建議，鋁線連接處容易氧化，火災風險高' },
  { q: '什麼是安全電流？', a: '電線在額定溫度下可長時間安全承載的最大電流' },
  { q: '過載保護是什麼？', a: 'NFB在電流超過額定值時自動跳脫，防止電線過熱' },
  { q: '短路保護是什麼？', a: 'NFB在極大電流（短路）時瞬間跳脫，防止火災' },
  { q: '漏電保護原理？', a: 'ELCB偵測火線和中性線電流差值，超過靈敏度即跳脫' },
  { q: '什麼叫做跳脫容量（IC）？', a: 'NFB能安全切斷的最大短路電流，kA單位' },
  { q: '住宅NFB的IC夠用嗎？', a: '一般住宅5~10kA即足夠（士林BH/BHU）' },
  { q: '什麼是AF框架電流？', a: 'NFB的物理框體最大電流容量，AT為跳脫額定值' },
  { q: '電線顏色有規定嗎？', a: '火線：紅/黑/藍，中性線：白，接地線：綠/綠黃' },
  { q: '三相電和單相電的差別？', a: '住宅用單相3線式（110/220V），工業用三相3線或4線式' },
  { q: '什麼是接地故障？', a: '電流經由非預期路徑流入大地，通常由絕緣破損造成' },
  { q: '電弧故障是什麼？', a: '接觸不良產生高溫電弧，是電氣火災主因之一' },
  { q: '什麼是安全距離？', a: '帶電導體與可觸及金屬間的最小絕緣間距' },
  { q: '配電箱門要可以鎖嗎？', a: '住宅不強制，但學校/公共場所建議加鎖' },
  { q: '什麼是迴路平衡？', a: '將110V負載平均分配給兩條火線，避免中性線過載' },
  { q: '中性線過載會怎樣？', a: '中性線過熱，嚴重時燒毀，且NFB不會跳脫' },
];

for (const sk of safetyKnowledge) {
  allNew.push({
    id: genId(), type: 'regulation', subtype: 'safety_qa',
    query: sk.q, rule: { answer: sk.a },
    keywords: sk.q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// 各種「可以嗎/行不行」問題
const canQueries = [
  { q: '2.0mm的線拉冷氣可以嗎？', a: '不夠，冷氣需5.5mm²以上' },
  { q: '1P NFB接220V可以嗎？', a: '不可以，220V必須用2P' },
  { q: '不同廠牌的NFB混裝可以嗎？', a: '同一配電箱建議用同品牌，確保相容' },
  { q: '把漏電斷路器當總開關用可以嗎？', a: '不建議，ELCB壽命較短且價格高' },
  { q: 'CD管露在外面可以嗎？', a: '不可以，CD管只能預埋在RC結構內' },
  { q: 'PVC管用在戶外可以嗎？', a: '不建議，PVC不耐UV和衝擊，戶外用EMT' },
  { q: '沒有接地棒用水管接地可以嗎？', a: '不建議，水管可能被更換為PVC，失去接地效果' },
  { q: '一個ELCB保護全屋可以嗎？', a: '不建議，單一ELCB跳脫時全屋斷電' },
  { q: '用15A的NFB接2.6mm的線可以嗎？', a: '可以但浪費，2.6mm可承載24A，建議用20A NFB' },
  { q: '接地線和中性線只在分電箱接可以嗎？', a: '不可以，只能在總電箱相接' },
  { q: '舊管路抽換新線可以不換管嗎？', a: '管路通暢就可以，但建議檢查管路狀況' },
  { q: '不同線徑的線穿同一管可以嗎？', a: '可以，但須注意佔積率不超過40%' },
  { q: '電線可以接太長嗎？', a: '太長有電壓降問題，一般迴路不超過30m' },
  { q: '二手NFB可以用嗎？', a: '不建議，NFB壽命有限，二手可能跳脫不正常' },
  { q: '可以把兩條線綁在一起當一條用嗎？', a: '不可以，應選用適當線徑的單條線' },
];

for (const cq of canQueries) {
  allNew.push({
    id: genId(), type: 'regulation', subtype: 'can_or_not',
    query: cq.q, rule: { answer: cq.a },
    keywords: cq.q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// ===================== 施工大量展開 =====================

// 各種「怎麼做」問題
const howToQueries = [
  { q: '電線怎麼穿管？', topic: '穿線' },
  { q: '怎麼用鋼魚引線？', topic: '穿線工具' },
  { q: '怎麼判斷線路是否老化？', topic: '線路檢查' },
  { q: '怎麼測試漏電斷路器？', topic: 'ELCB測試' },
  { q: '怎麼分辨火線和中性線？', topic: '線路辨識' },
  { q: '電表怎麼看用電量？', topic: '電表讀取' },
  { q: '怎麼量電壓？', topic: '電壓量測' },
  { q: '怎麼量電流？', topic: '電流量測' },
  { q: '怎麼壓接端子？', topic: '端子壓接' },
  { q: '怎麼彎EMT管？', topic: 'EMT彎管' },
  { q: '怎麼用電鑽打牆？', topic: '打鑿' },
  { q: '怎麼固定管線？', topic: '管線固定' },
  { q: '怎麼量絕緣電阻？', topic: '絕緣測試' },
  { q: '怎麼標示配電箱？', topic: '配電箱標示' },
  { q: '怎麼計算電線長度？', topic: '材料估算' },
  { q: '怎麼剝電線皮？', topic: '剝線' },
  { q: '怎麼接地線？', topic: '接地接線' },
  { q: '怎麼安裝出線盒？', topic: '出線盒' },
  { q: '怎麼拆舊的配電箱？', topic: '拆除' },
  { q: '怎麼做迴路標記？', topic: '標記方法' },
  { q: '怎麼防止施工觸電？', topic: '施工安全' },
  { q: '怎麼做臨時電？', topic: '臨時供電' },
  { q: '怎麼測試新拉的線是否通？', topic: '導通測試' },
  { q: '怎麼判斷管路是否堵塞？', topic: '管路檢查' },
  { q: '怎麼做電線標記？', topic: '線號標記' },
];

for (const htq of howToQueries) {
  allNew.push({
    id: genId(), type: 'procedure', subtype: 'how_to',
    query: htq.q, rule: { topic: htq.topic },
    keywords: [htq.topic], expect_materials_gte: 0,
  });
  // 口語變體
  allNew.push({
    id: genId(), type: 'procedure', subtype: 'how_to',
    query: htq.q.replace('怎麼', '如何'),
    rule: { topic: htq.topic },
    keywords: [htq.topic], expect_materials_gte: 0,
  });
  allNew.push({
    id: genId(), type: 'procedure', subtype: 'how_to',
    query: htq.q.replace('怎麼', '要怎樣'),
    rule: { topic: htq.topic },
    keywords: [htq.topic], expect_materials_gte: 0,
  });
}

// 施工問題排列
const procScenarios = [
  '新屋', '老屋', '辦公室', '店面', '工廠', '倉庫',
  '透天', '公寓', '大樓', '別墅', '套房', '頂樓加蓋',
];
const procActions = [
  '重配線', '加插座', '加迴路', '換配電箱', '裝冷氣', '裝電熱水器',
  '做接地', '裝照明', '換開關', '修漏電', '換NFB', '加燈',
];

for (const scene of procScenarios) {
  for (const action of procActions) {
    allNew.push({
      id: genId(), type: 'procedure', subtype: 'scene_action',
      query: `${scene}${action}的施工步驟？`,
      rule: { scene, action },
      keywords: [scene, action], expect_materials_gte: 1,
    });
    allNew.push({
      id: genId(), type: 'procedure', subtype: 'scene_action',
      query: `${scene}${action}要注意什麼？`,
      rule: { scene, action },
      keywords: [scene, action], expect_materials_gte: 0,
    });
  }
}

// ===================== 回答模板大量展開 =====================

// 具體場景的報價模板
const quoteScenarios = [
  { scene: '套房全室重配線', items: '配電箱+8迴路+全部換線', price: '40,000~60,000' },
  { scene: '三房兩廳全室重配線', items: '配電箱+20迴路+全部換線', price: '80,000~120,000' },
  { scene: '廚房增設專用迴路', items: '2P-20A NFB+5.5mm²線+插座', price: '3,500~5,500/迴' },
  { scene: '浴室安全升級', items: 'ELCB+防水插座+接地', price: '3,000~8,000' },
  { scene: '冷氣迴路×3台', items: '3組專用迴路+NFB+插座', price: '10,500~16,500' },
  { scene: '辦公室配電', items: '配電箱+20個插座+照明', price: '50,000~80,000' },
  { scene: '店面電路', items: '配電箱+招牌電路+插座+照明', price: '40,000~70,000' },
  { scene: '頂樓加蓋水電', items: '獨立配電箱+10迴路', price: '50,000~80,000' },
  { scene: '老屋配電箱更換', items: '新配電箱+NFB全換+ELCB', price: '15,000~30,000' },
  { scene: '電熱水器迴路', items: '5.5mm²線+2P-30A NFB+ELCB', price: '4,000~6,000' },
  { scene: '即熱式熱水器', items: '14mm²線+2P-50A NFB+ELCB', price: '5,500~8,000' },
  { scene: '充電樁電路', items: '14mm²線+2P-50A NFB+ELCB', price: '8,000~15,000' },
];

for (const qs of quoteScenarios) {
  const templates = [
    `${qs.scene}怎麼報價？`,
    `${qs.scene}的報價模板`,
    `客戶問${qs.scene}多少錢怎麼回？`,
    `${qs.scene}的費用怎麼估？`,
    `${qs.scene}的標準報價`,
  ];
  for (const q of templates) {
    allNew.push({
      id: genId(), type: 'template', subtype: 'quote_template',
      query: q,
      rule: { scene: qs.scene, items: qs.items, price: qs.price },
      keywords: [qs.scene, '報價'], expect_materials_gte: 1,
    });
  }
}

// 客戶溝通模板
const clientQAs = [
  { q: '客戶嫌太貴怎麼回？', template: '可以調整項目優先順序：先做安全（ELCB/接地）和必需迴路，一般插座日後擴充。也可建議明管方案省去打牆費用。' },
  { q: '客戶要求保證最低價？', template: '我們的報價是以CNS認證材料+合格工法為基準。低於市場行情的報價可能使用非認證材料或偷工減料，安全沒有保障。' },
  { q: '客戶問為什麼比上次貴？', template: '銅價每月波動，2026年銅價年漲超過40%，電纜成本大幅上升。工資也因缺工持續上漲。' },
  { q: '客戶想分期施工？', template: '可以分期，建議先做配電箱和主幹線（避免重複施工），再依優先順序分批增設迴路和點位。' },
  { q: '客戶問可以用更便宜的線嗎？', template: '電線是長期使用的安全設備，建議選用CNS認證一級廠（華新/太平洋/大亞）。非認證線材導體不足、絕緣差，有火災風險。' },
  { q: '客戶問工期要多久？', template: '純電路更換：套房1天/三房2天。若含打牆泥作：加2~3天。冷氣迴路：半天/台。' },
  { q: '客戶問施工後牆壁要修嗎？', template: '暗管需打牆，完工後需泥作批土+油漆修復，費用另計。明管不需修復牆面。' },
  { q: '客戶問用料會不會偷工減料？', template: '所有材料可提供出貨明細+CNS認證標籤核對。施工完成後提供竣工照片和迴路配置圖。' },
  { q: '客戶要求出工程圖？', template: '簡易迴路配置圖$500，含竣工標示。正式電路設計圖$1,000~2,000，依複雜度。' },
  { q: '客戶問有沒有保固？', template: '水電工程保固1~2年。全室重配線保固2年。電線材料本身壽命20~30年。保固期內免費修復施工造成的問題。' },
];

for (const cqa of clientQAs) {
  allNew.push({
    id: genId(), type: 'template', subtype: 'client_communication',
    query: cqa.q, rule: { template: cqa.template },
    keywords: ['客戶', '溝通'], expect_materials_gte: 0,
  });
}

// 維修報價模板
const repairQuotes = [
  { work: '換一個插座', price: '500~1,000', includes: '工資+插座面板' },
  { work: '換一個開關', price: '500~800', includes: '工資+開關面板' },
  { work: '換一顆NFB', price: '300~500', includes: '工資+NFB' },
  { work: '換一顆ELCB', price: '800~1,500', includes: '工資+ELCB' },
  { work: '修一個漏電迴路', price: '1,500~3,000', includes: '檢測+維修' },
  { work: '通一條堵塞的管', price: '1,000~2,000', includes: '工資+材料' },
  { work: '接地不良維修', price: '2,000~5,000', includes: '檢測+接地棒+施工' },
  { work: '配電箱內部整理', price: '2,000~5,000', includes: '重新接線+標示' },
  { work: '電路檢測（全屋）', price: '1,500~3,000', includes: '迴路測試+報告' },
  { work: '緊急漏電修繕', price: '2,000~5,000', includes: '出勤費+檢修' },
];

for (const rq of repairQuotes) {
  const templates = [
    `${rq.work}多少錢？`,
    `${rq.work}的維修費用？`,
    `請問${rq.work}報價？`,
    `${rq.work}要花多少？`,
  ];
  for (const q of templates) {
    allNew.push({
      id: genId(), type: 'template', subtype: 'repair_quote',
      query: q,
      rule: { work: rq.work, price: rq.price, includes: rq.includes },
      keywords: [rq.work, '費用'], expect_materials_gte: 0,
    });
  }
}

// ===================== 價格趨勢擴展 =====================

// 各材料類別的漲跌
const priceCategories = [
  { cat: '電纜', trend: '跟隨銅價，2026年漲幅超40%', driver: '銅價' },
  { cat: 'NFB/斷路器', trend: '穩定微漲5~10%/年', driver: '製造成本' },
  { cat: '導線管PVC', trend: '穩定，跟隨PVC原料', driver: 'PVC原料' },
  { cat: '導線管EMT', trend: '跟隨鋼價，微漲', driver: '鋼價' },
  { cat: '開關插座', trend: '穩定，品牌定價', driver: '品牌策略' },
  { cat: '配電箱', trend: '穩定微漲', driver: '鋼板+加工費' },
  { cat: '工資', trend: '持續上漲，年漲5~8%', driver: '缺工' },
  { cat: '五金配件', trend: '穩定', driver: '穩定供給' },
];

for (const pc of priceCategories) {
  const templates = [
    `${pc.cat}最近有漲價嗎？`,
    `${pc.cat}的價格走勢？`,
    `${pc.cat}未來會漲嗎？`,
    `${pc.cat}漲價的原因？`,
    `${pc.cat}什麼時候買最划算？`,
    `${pc.cat}的價格穩定嗎？`,
  ];
  for (const q of templates) {
    allNew.push({
      id: genId(), type: 'pricing', subtype: 'category_trend',
      query: q,
      rule: { category: pc.cat, trend: pc.trend, driver: pc.driver },
      keywords: [pc.cat, '價格'], expect_materials_gte: 0,
    });
  }
}

// 通路比價
const channelQueries = [
  { q: '材料去哪裡買比較便宜？', a: '水電材料行>五金行>電商平台>零售店' },
  { q: '網路買電料可以嗎？', a: '可以，但注意確認CNS認證和退換貨政策' },
  { q: '大量採購有折扣嗎？', a: '是，量大可議價5~15%，或直接向經銷商叫貨' },
  { q: '水電材料行和五金行差在哪？', a: '水電行專業+品項齊+量大折扣，五金行方便+零售' },
  { q: '經銷商和零售的價差多少？', a: '經銷商通常便宜20~40%，但有最低訂量' },
  { q: '叫貨和現場買差多少？', a: '叫貨依折數表計價，比現場零售便宜10~30%' },
];

for (const cq of channelQueries) {
  allNew.push({
    id: genId(), type: 'pricing', subtype: 'channel',
    query: cq.q, rule: { answer: cq.a },
    keywords: ['購買', '通路'], expect_materials_gte: 0,
  });
}

// ===================== 故障排除擴展 =====================

// 電器故障 × 電路問題
const appFaults = [
  { appliance: '冷氣', faults: ['不會啟動', '跳電', '電壓不足', '線路過熱'] },
  { appliance: '電熱水器', faults: ['漏電跳ELCB', '不加熱', '線路燒焦'] },
  { appliance: '微波爐', faults: ['用了就跳電', '插座發燙'] },
  { appliance: '洗衣機', faults: ['漏電', '插座不夠力'] },
  { appliance: '烘衣機', faults: ['跳電', '電壓不對'] },
  { appliance: '除濕機', faults: ['一直跳電', '插座壞了'] },
  { appliance: '充電樁', faults: ['安裝後跳電', '充電速度慢'] },
];

for (const af of appFaults) {
  for (const fault of af.faults) {
    allNew.push({
      id: genId(), type: 'troubleshoot', subtype: 'appliance_fault',
      query: `${af.appliance}${fault}怎麼辦？`,
      rule: { appliance: af.appliance, fault },
      keywords: [af.appliance, fault], expect_materials_gte: 0,
    });
    allNew.push({
      id: genId(), type: 'troubleshoot', subtype: 'appliance_fault',
      query: `${af.appliance}${fault}是電路問題嗎？`,
      rule: { appliance: af.appliance, fault },
      keywords: [af.appliance, fault], expect_materials_gte: 0,
    });
  }
}

// 老屋常見問題
const oldHouseProblems = [
  { problem: '配電箱老舊', age: '30年以上', solution: '更換新式NFB配電箱' },
  { problem: '電線太細', age: '20年以上', solution: '全室重配線升級至2.0mm以上' },
  { problem: '沒有接地線', age: '所有老屋', solution: '補裝接地系統' },
  { problem: '沒有漏電斷路器', age: '20年以上', solution: '浴室廚房補裝ELCB' },
  { problem: '迴路不足', age: '15年以上', solution: '擴充配電箱迴路' },
  { problem: '插座不夠', age: '10年以上', solution: '增設插座點位' },
  { problem: '管路腐蝕', age: '30年以上', solution: '重新配管' },
  { problem: 'NFB經常跳脫', age: '15年以上', solution: '更換NFB+檢查過載' },
];

for (const ohp of oldHouseProblems) {
  const templates = [
    `老屋${ohp.problem}怎麼處理？`,
    `${ohp.age}的房子${ohp.problem}危險嗎？`,
    `${ohp.problem}需要整個換嗎？`,
    `${ohp.problem}維修費用大概多少？`,
  ];
  for (const q of templates) {
    allNew.push({
      id: genId(), type: 'troubleshoot', subtype: 'old_house',
      query: q,
      rule: { problem: ohp.problem, age: ohp.age, solution: ohp.solution },
      keywords: ['老屋', ohp.problem], expect_materials_gte: 0,
    });
  }
}

// ===================== 合併輸出 =====================

const merged = [...base.questions, ...allNew];

const stats = {};
const subtypeStats = {};
for (const q of merged) {
  stats[q.type] = (stats[q.type] || 0) + 1;
  const key = `${q.type}/${q.subtype}`;
  subtypeStats[key] = (subtypeStats[key] || 0) + 1;
}

console.log('=== 最終合併統計 ===');
console.log(`Part 1+2: ${base.questions.length} 題`);
console.log(`Part 3:   ${allNew.length} 題`);
console.log(`合計:     ${merged.length} 題 (+ 既有 500 題 = ${merged.length + 500})`);
console.log('\n分類明細：');
for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type.padEnd(15)} ${count} 題`);
}

const output = {
  ...base,
  version: '3.2',
  stats,
  total: merged.length,
  questions: merged,
};

const outPath = join(__dirname, 'rag-training-rules.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\n已輸出至：${outPath}`);
console.log(`檔案大小：${(JSON.stringify(output).length / 1024 / 1024).toFixed(1)} MB`);

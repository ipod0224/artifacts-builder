#!/usr/bin/env node
/**
 * 大規模擴充生成器 v5：補到 10,000 題
 * 策略：口語變體 × 材料規格 × 場景組合 × 計算題
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(__dirname, 'rag-training-rules.json'), 'utf-8'));

// 去重 Set
const seen = new Set();
const deduped = [];
for (const q of base.questions) {
  if (!seen.has(q.query)) {
    seen.add(q.query);
    deduped.push(q);
  }
}
console.log(`基底: ${deduped.length} (已去重)`);

let nextId = Math.max(...deduped.map(q => q.id)) + 1;
function genId() { return nextId++; }

const allNew = [];
function add(item) {
  if (!seen.has(item.query)) {
    seen.add(item.query);
    item.id = genId();
    allNew.push(item);
    return true;
  }
  return false;
}

// ====== 材料資料 ======
const wireSpecs = [
  '1.6mm', '2.0mm', '2.6mm', '3.5mm²', '5.5mm²', '8mm²',
  '14mm²', '22mm²', '30mm²', '38mm²', '50mm²', '60mm²',
  '80mm²', '100mm²', '125mm²', '150mm²', '200mm²', '250mm²', '325mm²',
];

const wireTypes = ['PVC IV', 'XLPE', '耐燃線 FR-PVC'];
const conduitTypes = ['PVC管', 'EMT管', 'CD管', '不鏽鋼管', '鍍鋅鋼管'];
const conduitSizes = ['16mm', '22mm', '28mm', '36mm', '42mm', '52mm', '70mm'];

const nfbSpecs = [
  '1P 15A', '1P 20A', '1P 30A', '1P 50A',
  '2P 15A', '2P 20A', '2P 30A', '2P 50A', '2P 75A', '2P 100A',
  '3P 50A', '3P 75A', '3P 100A', '3P 150A', '3P 200A', '3P 225A',
];

const brands = ['士林', '國際牌', '華新', '太平洋', '大亞', '大山', '南亞', '春風'];
const rooms = ['廚房', '浴室', '臥室', '客廳', '書房', '陽台', '餐廳', '套房', '車庫', '儲藏室', '走廊', '玄關'];
const appliances = [
  '冷氣', '電熱水器', '電磁爐', '烤箱', '微波爐', '洗碗機', '乾衣機',
  '洗衣機', '冰箱', '電鍋', '氣炸鍋', '咖啡機', '除濕機', '暖風機',
  '吹風機', '電暖器', '快煮壺', '烘碗機', '充電樁', '飲水機',
];
const boxSizes = ['4迴路', '6迴路', '8迴路', '12迴路', '16迴路', '20迴路', '24迴路'];

// ====== A. 場景大量展開 (~1,200) ======

// A1: 房間×電器安裝問題（更多電器×房間組合）
for (const room of rooms) {
  for (const appl of appliances.slice(0, 14)) {
    add({
      id: 0, type: 'scenario', subtype: 'room_appliance',
      query: `${room}裝${appl}要什麼迴路？`,
      rule: { room, appliance: appl },
      keywords: [room, appl, '迴路'], expect_materials_gte: 1,
    });
  }
}

// A2: 電器×電壓問題
for (const appl of appliances) {
  add({
    id: 0, type: 'scenario', subtype: 'voltage',
    query: `${appl}是110V還是220V？`,
    rule: { appliance: appl },
    keywords: [appl, '電壓'], expect_materials_gte: 0,
  });
  add({
    id: 0, type: 'scenario', subtype: 'voltage',
    query: `${appl}的用電量大概多少瓦？`,
    rule: { appliance: appl },
    keywords: [appl, '瓦數'], expect_materials_gte: 0,
  });
  add({
    id: 0, type: 'scenario', subtype: 'circuit',
    query: `${appl}需要拉專線嗎？`,
    rule: { appliance: appl },
    keywords: [appl, '專線'], expect_materials_gte: 1,
  });
}

// A3: 坪數×房型更多組合
const houseTypes = ['套房', '兩房一廳', '三房兩廳', '四房兩廳', '透天厝', '樓中樓', '挑高小宅', '公寓', '大樓', '別墅'];
for (let ping = 6; ping <= 60; ping += 2) {
  for (const ht of houseTypes) {
    if ((ping < 10 && ht !== '套房') || (ping > 50 && ht === '套房')) continue;
    add({
      id: 0, type: 'scenario', subtype: 'house_type',
      query: `${ping}坪${ht}需要幾個迴路？`,
      rule: { ping, houseType: ht },
      keywords: [ht, '迴路'], expect_materials_gte: 1,
    });
  }
}

// A4: 特定場景口語問法
const scenarioDialogs = [
  '老公寓要全部重配線嗎？', '30年老屋電線安全嗎？', '40年公寓能不能局部換線？',
  '新裝潢要先配電還是先做木工？', '冷氣師傅說要加迴路是真的嗎？',
  '設計師說要20迴路會不會太多？', '廚房五個電器同時用會跳嗎？',
  '全熱交換機要專門拉線嗎？', 'EV充電樁裝在地下室要多長電纜？',
  '頂樓加蓋的電怎麼拉？', '陽台外推後配電怎麼改？', '打牆之後管路斷了怎麼辦？',
  '二樓加浴室要從哪拉電？', '跨樓層拉線要用什麼管？', '天花板走線好還是地板走線好？',
  '明管配線醜嗎？有什麼替代方案？', '暗管塞不下怎麼辦？',
  '配電箱滿了要怎麼擴充？', '主開關容量不夠要向台電申請嗎？',
  '三相電可以轉單相嗎？', '220V迴路可以改成110V嗎？', '110V可以改220V嗎？',
  '兩間相鄰的房間可以共用迴路嗎？', '衛浴乾濕分離配電有差嗎？',
  '電線走天花板會不會太熱？', '管線經過樑柱怎麼處理？', '穿樑配管要打孔嗎？',
  '新建案的預留管夠用嗎？', '建商配的電線品質好嗎？',
  '預售屋客變要加插座怎麼做？', '毛胚屋配電從零開始要注意什麼？',
  '有壁癌的牆可以走暗管嗎？', '鋼筋混凝土的牆可以埋管嗎？',
  '輕隔間牆怎麼配電？', '木作牆可以走暗管嗎？',
  '裝修先做水電後做泥作對嗎？', '水電完成後油漆才能做？',
  '冷氣銅管和電線可以走同一管路嗎？', '弱電和強電要分開走嗎？',
  '網路線和電線可以共管嗎？', '同一管路最多穿幾條線？',
];

for (const q of scenarioDialogs) {
  add({
    id: 0, type: 'scenario', subtype: 'dialog',
    query: q, rule: { dialog: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// ====== B. 選型大量展開 (~600) ======

// B1: 各線徑×用途匹配
const wireUsages = [
  '照明', '一般插座', '冷氣', '電熱水器', '烤箱', '電磁爐', '充電樁',
  '洗碗機', '乾衣機', '電焊機', '馬達', '幹線', '接地',
];

for (const spec of wireSpecs.slice(0, 12)) {
  for (const usage of wireUsages) {
    add({
      id: 0, type: 'selection', subtype: 'wire_match',
      query: `${spec}可以用在${usage}嗎？`,
      rule: { wire: spec, usage },
      keywords: [spec, usage], expect_materials_gte: 1,
    });
  }
}

// B2: NFB×用途匹配
for (const nfb of nfbSpecs.slice(0, 10)) {
  for (const usage of ['照明', '插座', '冷氣', '電熱水器', '幹線', '廚房電器']) {
    add({
      id: 0, type: 'selection', subtype: 'nfb_match',
      query: `${nfb}的NFB可以用在${usage}嗎？`,
      rule: { nfb, usage },
      keywords: [nfb, usage, 'NFB'], expect_materials_gte: 1,
    });
  }
}

// B3: 管×線搭配
for (const ct of conduitTypes.slice(0, 3)) {
  for (const cs of conduitSizes.slice(0, 5)) {
    add({
      id: 0, type: 'selection', subtype: 'conduit_wire',
      query: `${cs}${ct}可以穿幾條2.0mm線？`,
      rule: { conduit: ct, size: cs },
      keywords: [ct, cs, '穿線'], expect_materials_gte: 1,
    });
    add({
      id: 0, type: 'selection', subtype: 'conduit_wire',
      query: `${cs}${ct}可以穿幾條5.5mm²線？`,
      rule: { conduit: ct, size: cs },
      keywords: [ct, cs, '穿線'], expect_materials_gte: 1,
    });
  }
}

// B4: 品牌×品類選型
for (const brand of brands) {
  for (const cat of ['電線', 'NFB', 'PVC管', '開關', '插座']) {
    add({
      id: 0, type: 'selection', subtype: 'brand_category',
      query: `${brand}的${cat}品質怎麼樣？`,
      rule: { brand, category: cat },
      keywords: [brand, cat], expect_materials_gte: 1,
    });
  }
}

// B5: 配電箱選型
for (const bs of boxSizes) {
  for (const ht of ['套房', '公寓', '透天厝', '辦公室', '店面']) {
    add({
      id: 0, type: 'selection', subtype: 'box_size',
      query: `${ht}用${bs}配電箱夠嗎？`,
      rule: { box: bs, houseType: ht },
      keywords: [bs, '配電箱', ht], expect_materials_gte: 1,
    });
  }
}

// ====== C. 估價大量展開 (~700) ======

// C1: 具體施工項目×數量
const workItems = [
  { name: '迴路', unit: '迴', prices: [2500, 4500] },
  { name: '插座', unit: '個', prices: [800, 1800] },
  { name: '開關', unit: '個', prices: [600, 1500] },
  { name: '燈具出線口', unit: '個', prices: [500, 1200] },
  { name: '冷氣專用迴路', unit: '迴', prices: [3500, 6000] },
  { name: '電熱水器迴路', unit: '迴', prices: [4000, 7000] },
  { name: '弱電拉線', unit: '迴', prices: [1500, 3000] },
];

for (const wi of workItems) {
  for (let n = 1; n <= 15; n++) {
    add({
      id: 0, type: 'estimation', subtype: 'work_item_qty',
      query: `${n}${wi.unit}${wi.name}連工帶料多少？`,
      rule: { item: wi.name, count: n, min: n * wi.prices[0], max: n * wi.prices[1] },
      keywords: [wi.name, '費用'], expect_materials_gte: 0,
    });
  }
}

// C2: 整套報價
const packages = [
  { name: '全室重配線', pricePerPing: [2500, 4000] },
  { name: '局部換線', pricePerPing: [1500, 2500] },
  { name: '只換配電箱', flat: [8000, 25000] },
  { name: '增設冷氣迴路', flat: [3500, 6000] },
  { name: '浴室配電改善', flat: [5000, 15000] },
  { name: '廚房專用迴路', flat: [8000, 20000] },
];

for (const pkg of packages) {
  if (pkg.pricePerPing) {
    for (let ping = 8; ping <= 80; ping += 3) {
      add({
        id: 0, type: 'estimation', subtype: 'package',
        query: `${ping}坪${pkg.name}大概多少？`,
        rule: { item: pkg.name, ping, min: ping * pkg.pricePerPing[0], max: ping * pkg.pricePerPing[1] },
        keywords: [pkg.name, '費用'], expect_materials_gte: 0,
      });
    }
  } else {
    for (const suffix of ['多少錢？', '費用？', '怎麼收費？', '行情多少？']) {
      add({
        id: 0, type: 'estimation', subtype: 'package_flat',
        query: `${pkg.name}${suffix}`,
        rule: { item: pkg.name, min: pkg.flat[0], max: pkg.flat[1] },
        keywords: [pkg.name, '費用'], expect_materials_gte: 0,
      });
    }
  }
}

// C3: 計算問題（含公式）
const calcQuestions = [
  { q: '20A迴路最多接多少瓦？', rule: { formula: 'P=V×I', answer: '110×20=2200W' } },
  { q: '30A迴路最多接多少瓦？', rule: { formula: 'P=V×I', answer: '110×30=3300W' } },
  { q: '15A迴路最多接多少瓦？', rule: { formula: 'P=V×I', answer: '110×15=1650W' } },
  { q: '50A的220V迴路最多幾瓦？', rule: { formula: 'P=V×I', answer: '220×50=11000W' } },
  { q: '75A幹線可以帶多少負載？', rule: { formula: 'P=V×I', answer: '220×75=16500W' } },
  { q: '100A幹線可以帶多少負載？', rule: { formula: 'P=V×I', answer: '220×100=22000W' } },
  { q: '5.5mm²銅線的安全電流是多少？', rule: { answer: 'PVC 42A / XLPE 49A' } },
  { q: '8mm²銅線的安全電流是多少？', rule: { answer: 'PVC 55A / XLPE 67A' } },
  { q: '14mm²銅線的安全電流是多少？', rule: { answer: 'PVC 76A / XLPE 91A' } },
  { q: '22mm²銅線的安全電流是多少？', rule: { answer: 'PVC 101A / XLPE 121A' } },
  { q: '2.0mm銅線的安全電流是多少？', rule: { answer: 'PVC 22A / XLPE 27A' } },
  { q: '2.6mm銅線的安全電流是多少？', rule: { answer: 'PVC 30A / XLPE 37A' } },
  { q: '冷氣1噸大概幾瓦？', rule: { answer: '約800~1000W' } },
  { q: '1HP馬達大概多少安培？', rule: { answer: '110V約8A, 220V約4A' } },
  { q: '一坪要幾個插座才夠？', rule: { answer: '一般2-3個/坪' } },
  { q: '客廳10坪需要幾個迴路？', rule: { answer: '照明1+插座2+冷氣1=4迴路' } },
  { q: '三房兩廳一般需要幾個迴路？', rule: { answer: '基本14-18迴路' } },
  { q: '透天厝一層需要幾個迴路？', rule: { answer: '每層4-6迴路' } },
  { q: '22mm PVC管佔積率40%能穿幾條2.0mm線？', rule: { answer: '約5-6條' } },
  { q: '28mm PVC管佔積率40%能穿幾條5.5mm²線？', rule: { answer: '約4條' } },
  { q: '同時用烤箱1200W和微波爐900W需要幾安培？', rule: { formula: 'I=P/V', answer: '(1200+900)/110≈19A, 需20A迴路' } },
  { q: '浴室暖風機1400W加吹風機1200W會不會超過？', rule: { formula: 'I=P/V', answer: '(1400+1200)/110≈23.6A, 超過20A會跳' } },
];

for (const cq of calcQuestions) {
  add({
    id: 0, type: 'estimation', subtype: 'calculation',
    query: cq.q, rule: cq.rule,
    keywords: cq.q.match(/[\u4e00-\u9fff0-9A-Za-z.]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// ====== D. 法規大量展開 (~1,000) ======

// D1: 各場所法規要求
const places = [
  '浴室', '廚房', '臥室', '客廳', '陽台', '地下室', '車庫', '屋頂',
  '店面', '辦公室', '餐廳', '診所', '幼稚園', '工廠', '倉庫', '機房',
];

const regForms = [
  (p) => `${p}配電有什麼法規要求？`,
  (p) => `${p}一定要裝漏電斷路器嗎？`,
  (p) => `${p}的接地要求是什麼？`,
  (p) => `${p}插座高度有規定嗎？`,
  (p) => `${p}要用幾迴路？有法規嗎？`,
];

for (const place of places) {
  for (const form of regForms) {
    add({
      id: 0, type: 'regulation', subtype: 'place_regulation',
      query: form(place), rule: { place },
      keywords: [place, '法規'], expect_materials_gte: 0,
    });
  }
}

// D2: 安全距離/間距規定
const distanceQueries = [
  '配電箱離地面要多高？', '配電箱前方要留多少空間？', '插座離地面的標準高度？',
  '開關離地面的標準高度？', '浴室插座離水源要多遠？', '廚房插座離瓦斯要多遠？',
  '電線管和水管要間隔多少？', '強電和弱電管要隔多遠？', '接地棒之間要隔多遠？',
  '接地棒埋多深？', '導線管彎頭最多幾個？', '導線管水平段最長幾公尺？',
  '拉線盒間距最大多少？', '接線盒的安裝間距？', '電線接頭只能在哪裡做？',
  '吊扇離天花板要多高？', '崁燈之間建議間距？', '配電箱到最遠插座的距離限制？',
  '戶外管路的排水坡度？', '管路穿牆要做什麼防護？',
];

for (const q of distanceQueries) {
  add({
    id: 0, type: 'regulation', subtype: 'distance',
    query: q, rule: { topic: '距離規定' },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// D3: 各材料法規要求
for (const wt of wireTypes) {
  add({
    id: 0, type: 'regulation', subtype: 'material_regulation',
    query: `${wt}有什麼使用限制？`, rule: { material: wt },
    keywords: [wt, '法規'], expect_materials_gte: 1,
  });
  add({
    id: 0, type: 'regulation', subtype: 'material_regulation',
    query: `什麼場合一定要用${wt}？`, rule: { material: wt },
    keywords: [wt, '場合'], expect_materials_gte: 1,
  });
  add({
    id: 0, type: 'regulation', subtype: 'material_regulation',
    query: `${wt}的溫度額定是多少？`, rule: { material: wt },
    keywords: [wt, '溫度'], expect_materials_gte: 1,
  });
}

for (const ct of conduitTypes) {
  add({
    id: 0, type: 'regulation', subtype: 'material_regulation',
    query: `${ct}可以用在哪些場所？`, rule: { material: ct },
    keywords: [ct, '場所'], expect_materials_gte: 1,
  });
  add({
    id: 0, type: 'regulation', subtype: 'material_regulation',
    query: `${ct}的佔積率限制？`, rule: { material: ct },
    keywords: [ct, '佔積率'], expect_materials_gte: 1,
  });
}

// D4: 用電安全知識
const safetyKnowledge = [
  '什麼情況會觸電？', '觸電了怎麼急救？', '家裡起火怎麼判斷是電線走火？',
  '電線走火的前兆？', '怎麼防止電線走火？', '過載和短路有什麼不同？',
  '跳電和停電有什麼不同？', '為什麼會接觸不良？', '接觸不良會怎樣？',
  '潮濕環境用電要注意什麼？', '雷雨天要拔插頭嗎？', '地震後要檢查電路嗎？',
  '如何判斷電線老化？', '電線壽命大概多久？', 'NFB壽命大概多久？',
  'ELCB壽命大概多久？', '多久要做一次電路檢測？', '怎麼測試ELCB是否正常？',
  '插座搖搖晃晃危險嗎？', '電線外露危險嗎？', '延長線串接危險在哪？',
  '一個插座可以接幾個電器？', '電線顏色接錯會怎樣？', '火線中性線接反會怎樣？',
  '接地線沒有接會怎樣？', '漏電斷路器一直跳是什麼問題？', '配電箱有燒焦味怎麼辦？',
  '鄰居漏電會影響我家嗎？', '公共管道間配電問題歸誰管？', '台電會幫檢查家裡配電嗎？',
  '怎麼看電表知道用了多少電？', '電費怎麼計算？', '夏月電費怎麼算？',
  '家用電最大可以申請多少安培？', '三相和單相有什麼差別？', '220V比110V省電嗎？',
];

for (const q of safetyKnowledge) {
  add({
    id: 0, type: 'regulation', subtype: 'safety_knowledge',
    query: q, rule: { safety: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// D5: 線徑×安培法規（更多規格）
for (const spec of wireSpecs) {
  for (const wt of wireTypes) {
    add({
      id: 0, type: 'regulation', subtype: 'ampacity',
      query: `${wt} ${spec}的安全電流？`,
      rule: { wire: wt, spec },
      keywords: [wt, spec, '安全電流'], expect_materials_gte: 1,
    });
  }
}

// D6: 電線顏色規定
const colorQueries = [
  '火線用什麼顏色？', '中性線用什麼顏色？', '接地線用什麼顏色？',
  '220V迴路電線顏色規定？', '三相電線顏色分別是什麼？',
  '紅色電線是什麼線？', '白色電線是什麼線？', '綠色電線是什麼線？',
  '黑色電線是什麼線？', '藍色電線是什麼線？',
  '可以用黃色線當火線嗎？', '電線顏色可以自己決定嗎？',
  '配電箱內電線顏色要統一嗎？', '老屋電線都是同一色怎麼辦？',
];

for (const q of colorQueries) {
  add({
    id: 0, type: 'regulation', subtype: 'wire_color',
    query: q, rule: { topic: '電線顏色' },
    keywords: ['電線', '顏色'], expect_materials_gte: 0,
  });
}

// ====== E. 施工補充 (~350) ======

// E1: 施工步驟問題
const stepQueries = [
  { scene: '插座安裝', steps: ['斷電', '拆面板', '接線', '固定', '通電測試'] },
  { scene: '暗管配線', steps: ['彈線定位', '開槽', '埋管', '穿線', '回填', '測試'] },
  { scene: '配電箱更換', steps: ['斷電', '標記迴路', '拆舊箱', '裝新箱', '配線', '標示', '通電'] },
  { scene: 'NFB更換', steps: ['斷電', '拆舊NFB', '裝新NFB', '上電測試'] },
  { scene: 'ELCB安裝', steps: ['確認線路', '斷電', '接線', '測試跳脫功能'] },
  { scene: '接地工程', steps: ['選位', '打接地棒', '接線', '量測電阻', '回填'] },
];

for (const sq of stepQueries) {
  add({
    id: 0, type: 'procedure', subtype: 'steps',
    query: `${sq.scene}的步驟是什麼？`,
    rule: { scene: sq.scene, steps: sq.steps },
    keywords: [sq.scene, '步驟'], expect_materials_gte: 0,
  });
  add({
    id: 0, type: 'procedure', subtype: 'steps',
    query: `${sq.scene}怎麼做？`,
    rule: { scene: sq.scene, steps: sq.steps },
    keywords: [sq.scene], expect_materials_gte: 0,
  });
  add({
    id: 0, type: 'procedure', subtype: 'steps',
    query: `${sq.scene}要注意什麼？`,
    rule: { scene: sq.scene, safety: true },
    keywords: [sq.scene, '注意'], expect_materials_gte: 0,
  });
  add({
    id: 0, type: 'procedure', subtype: 'steps',
    query: `${sq.scene}需要什麼工具？`,
    rule: { scene: sq.scene, tools: true },
    keywords: [sq.scene, '工具'], expect_materials_gte: 0,
  });
}

// E2: 材料施工問題
for (const ct of conduitTypes.slice(0, 4)) {
  add({
    id: 0, type: 'procedure', subtype: 'material_install',
    query: `${ct}怎麼彎管？`, rule: { material: ct },
    keywords: [ct, '彎管'], expect_materials_gte: 1,
  });
  add({
    id: 0, type: 'procedure', subtype: 'material_install',
    query: `${ct}怎麼接？`, rule: { material: ct },
    keywords: [ct, '接管'], expect_materials_gte: 1,
  });
  add({
    id: 0, type: 'procedure', subtype: 'material_install',
    query: `${ct}怎麼固定？`, rule: { material: ct },
    keywords: [ct, '固定'], expect_materials_gte: 1,
  });
}

// E3: 工具使用
const toolQueries = [
  '三用電表怎麼量電壓？', '三用電表怎麼量電流？', '三用電表怎麼量電阻？',
  '勾表怎麼量電流？', '接地電阻計怎麼用？', '絕緣電阻計怎麼量？',
  '剝線鉗怎麼用？', '壓接鉗怎麼用？', '穿線器怎麼用？',
  '管道疏通器怎麼用？', '水平尺怎麼用？', '雷射水平儀怎麼用？',
  '切管器怎麼用？', '彎管器怎麼用？', '電動起子的扭力怎麼設定？',
  '電鑽鑽混凝土要用什麼鑽頭？', '開孔器怎麼選尺寸？', '砂輪機切金屬管安全嗎？',
];

for (const q of toolQueries) {
  add({
    id: 0, type: 'procedure', subtype: 'tool_usage',
    query: q, rule: { tool: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// E4: 維修保養
const maintQueries = [
  '配電箱多久要保養一次？', 'NFB多久要檢查一次？', 'ELCB多久要測試一次？',
  '插座鬆了要怎麼修？', '開關接觸不良怎麼修？', '電線接頭氧化怎麼處理？',
  '配電箱生鏽怎麼辦？', 'PVC管變色了要換嗎？', 'EMT管生鏽怎麼處理？',
  '接地棒腐蝕怎麼辦？', '接地電阻變高怎麼改善？', '老化的電線怎麼判斷？',
  '配電箱裡面有螞蟻怎麼辦？', '電線管裡面進水怎麼辦？', '插座進水怎麼處理？',
  '颱風過後要檢查什麼？', '停電恢復後要注意什麼？', '水災後電路怎麼處理？',
];

for (const q of maintQueries) {
  add({
    id: 0, type: 'procedure', subtype: 'maintenance',
    query: q, rule: { maintenance: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// ====== F. 價格補充 (~350) ======

// F1: 各材料單價詢問
const materialPriceItems = [
  { name: 'PVC IV 2.0mm', category: 'wire' },
  { name: 'PVC IV 5.5mm²', category: 'wire' },
  { name: 'XLPE 5.5mm²', category: 'wire' },
  { name: 'XLPE 14mm²', category: 'wire' },
  { name: 'XLPE 22mm²', category: 'wire' },
  { name: '耐燃線 2.0mm', category: 'wire' },
  { name: 'NFB 1P 20A', category: 'breaker' },
  { name: 'NFB 2P 30A', category: 'breaker' },
  { name: 'NFB 3P 100A', category: 'breaker' },
  { name: 'ELCB 2P 20A', category: 'breaker' },
  { name: 'ELCB 2P 30A', category: 'breaker' },
  { name: 'PVC管 22mm', category: 'conduit' },
  { name: 'EMT管 22mm', category: 'conduit' },
  { name: 'CD管 16mm', category: 'conduit' },
  { name: '4迴路配電箱', category: 'panel' },
  { name: '12迴路配電箱', category: 'panel' },
  { name: '雙插座', category: 'outlet' },
  { name: '冷氣插座', category: 'outlet' },
  { name: '單切開關', category: 'switch' },
  { name: '接地棒 1.5m', category: 'grounding' },
];

const priceForms = [
  (n) => `${n}一個多少錢？`,
  (n) => `${n}現在市價多少？`,
  (n) => `${n}一捲多少？`,
  (n) => `${n}的牌價？`,
  (n) => `${n}批發價多少？`,
  (n) => `${n}零售和批發差多少？`,
];

for (const m of materialPriceItems) {
  for (const form of priceForms) {
    add({
      id: 0, type: 'pricing', subtype: 'unit_price',
      query: form(m.name), rule: { item: m.name, category: m.category },
      keywords: [m.name, '價格'], expect_materials_gte: 1,
    });
  }
}

// F2: 工資行情
const laborQueries = [
  '水電技師一天多少工資？', '水電學徒一天多少？', '半技工一天多少？',
  '假日加班費怎麼算？', '夜間施工加班費多少？', '急件加價多少？',
  '點工一天怎麼算？', '師傅車馬費多少？', '出勤費包含什麼？',
  '監工費怎麼算？', '設計費怎麼算？', '配電圖繪製費多少？',
  '竣工圖繪製費多少？', '電路檢測費多少？', '接地電阻測量費多少？',
  '台北水電師傅日薪多少？', '南部水電師傅日薪多少？', '技師和技工的工資差多少？',
];

for (const q of laborQueries) {
  add({
    id: 0, type: 'pricing', subtype: 'labor',
    query: q, rule: { labor: true },
    keywords: ['工資', '工價'], expect_materials_gte: 0,
  });
}

// F3: 銅價影響
const copperQueries = [
  '銅價上漲電纜會漲多少？', '銅價怎麼影響電線價格？', '今年銅價走勢如何？',
  '銅價在哪裡查？', 'LME銅價是什麼？', '電纜報價有效期為什麼只有7天？',
  '銅價跌了電纜會降價嗎？', '囤電纜等漲價划算嗎？', '預購電纜可以鎖價嗎？',
  '國際銅價和台灣電纜的關係？', '電纜裡面銅佔多少成本？', '鋁線比銅線便宜多少？',
];

for (const q of copperQueries) {
  add({
    id: 0, type: 'pricing', subtype: 'copper',
    query: q, rule: { topic: '銅價' },
    keywords: ['銅價', '電纜'], expect_materials_gte: 0,
  });
}

// ====== G. 故障補充 (~200) ======

// G1: 症狀×可能原因
const symptoms = [
  { symptom: '跳電', causes: ['過載', '短路', '漏電', 'NFB老化'] },
  { symptom: '電燈閃爍', causes: ['接觸不良', '電壓不穩', '中性線鬆', '電線老化'] },
  { symptom: '插座沒電', causes: ['NFB跳脫', '電線斷裂', '接頭鬆脫', '施工切斷'] },
  { symptom: '插座發燙', causes: ['過載', '接觸不良', '線徑太小', '接頭不良'] },
  { symptom: '漏電', causes: ['電線破損', '受潮', '電器故障', '接地不良'] },
  { symptom: '電壓過低', causes: ['線路過長', '線徑不足', '連接不良', '變壓器問題'] },
  { symptom: '有焦味', causes: ['電線過熱', '接頭不良', '短路', '過載'] },
  { symptom: '有嗡嗡聲', causes: ['變壓器振動', '接觸不良', '螺絲鬆', '配電箱共振'] },
];

for (const s of symptoms) {
  add({
    id: 0, type: 'troubleshoot', subtype: 'symptom_cause',
    query: `${s.symptom}的原因有哪些？`,
    rule: { symptom: s.symptom, causes: s.causes },
    keywords: [s.symptom, '原因'], expect_materials_gte: 0,
  });
  add({
    id: 0, type: 'troubleshoot', subtype: 'symptom_fix',
    query: `${s.symptom}怎麼排除？`,
    rule: { symptom: s.symptom, diagnosis: true },
    keywords: [s.symptom, '排除'], expect_materials_gte: 0,
  });
  add({
    id: 0, type: 'troubleshoot', subtype: 'symptom_when',
    query: `什麼時候${s.symptom}要找師傅？`,
    rule: { symptom: s.symptom, severity: true },
    keywords: [s.symptom, '師傅'], expect_materials_gte: 0,
  });
  // 與電器的交叉
  for (const appl of ['冷氣', '電熱水器', '微波爐', '洗碗機', '烤箱']) {
    add({
      id: 0, type: 'troubleshoot', subtype: 'appliance_fault',
      query: `用${appl}就${s.symptom}怎麼辦？`,
      rule: { appliance: appl, symptom: s.symptom },
      keywords: [appl, s.symptom], expect_materials_gte: 0,
    });
  }
}

// G2: 診斷流程
const diagQueries = [
  '怎麼用三用電表找漏電？', '怎麼判斷是哪個迴路跳電？', '怎麼測試插座有沒有接地？',
  '怎麼查電線有沒有斷線？', '怎麼找牆壁裡面的電線？', '怎麼判斷NFB是不是壞了？',
  '怎麼測試ELCB跳脫靈敏度？', '怎麼判斷過載還是短路？', '怎麼排除接觸不良？',
  '電壓不穩怎麼查原因？', '中性線斷了怎麼判斷？', '接地電阻太高怎麼改善？',
  '管內電線怎麼判斷有沒有破損？', '怎麼查電費異常的原因？', '怎麼判斷是台電問題還是自家問題？',
];

for (const q of diagQueries) {
  add({
    id: 0, type: 'troubleshoot', subtype: 'diagnosis',
    query: q, rule: { diagnosis: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// ====== H. 模板補充 (~150) ======

// H1: 溝通模板
const commTemplates = [
  '怎麼跟水電師傅溝通需求？', '怎麼看懂水電報價單？', '怎麼比較不同師傅的報價？',
  '報價太貴怎麼議價？', '報價太便宜要擔心嗎？', '怎麼判斷師傅有沒有偷工減料？',
  '追加工程要怎麼談？', '工程延遲要怎麼處理？', '驗收不滿意怎麼談？',
  '保固期內出問題怎麼反映？', '怎麼寫水電工程合約？', '合約要注意什麼條款？',
  '怎麼找到好的水電師傅？', '網路上找師傅要注意什麼？', '親友介紹的師傅比較好嗎？',
  '要不要找大公司還是個人師傅？', '工程監工要看什麼重點？', '怎麼拍照記錄施工過程？',
];

for (const q of commTemplates) {
  add({
    id: 0, type: 'template', subtype: 'communication',
    query: q, rule: { communication: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// H2: 常見問答 FAQ
const faqQueries = [
  '水電工程大概要做多久？', '全室重配線要幾天？', '換配電箱要多久？',
  '裝一個插座要多久？', '拉一迴冷氣線要多久？', '施工期間可以住嗎？',
  '施工後多久可以通電？', '新拉的線要測試什麼？', '施工粉塵怎麼處理？',
  '施工噪音會很大嗎？', '可以邊裝修邊住嗎？', '水電和木工同時施工可以嗎？',
  '施工前家具要搬走嗎？', '施工會不會影響鄰居？', '大樓施工有時間限制嗎？',
  '透天厝施工有什麼限制？', '公寓施工要管委會同意嗎？', '施工廢棄物誰處理？',
];

for (const q of faqQueries) {
  add({
    id: 0, type: 'template', subtype: 'faq',
    query: q, rule: { faq: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// H3: 清單模板
const checklistQueries = [
  '新屋驗收水電清單？', '裝修前水電規劃清單？', '配電箱檢查清單？',
  '全室重配線需要的材料清單？', '浴室配電材料清單？', '廚房配電材料清單？',
  '套房配電基本材料清單？', '辦公室配電材料清單？', '店面配電材料清單？',
  '水電工具基本清單？', '竣工驗收檢查清單？', '每年定期檢查清單？',
];

for (const q of checklistQueries) {
  add({
    id: 0, type: 'template', subtype: 'checklist',
    query: q, rule: { checklist: true },
    keywords: ['清單'], expect_materials_gte: 0,
  });
}

// ====== I. 口語/台語/簡寫變體 ======

// 把一些高頻問題加上台語/口語變體
const oralVariants = [
  // 台語化
  '插頭燒焦了啦怎麼辦', '電跳掉了是怎樣', '電線拉不過去怎辦', '管路塞住了',
  '電箱嗡嗡叫', '牆壁摸起來燙燙的', '插座插不進去', '開關按下去沒反應',
  '燈一直閃', '電費怎麼這麼貴', '跳電跳到煩', '冷氣一開就跳',
  // 省略語
  'NFB跳了', 'ELCB跳了', '插座壞了', '開關壞了', '電箱滿了',
  '線不夠粗', '管太小', '迴路不夠', '負載太重', '電壓不夠',
  // 問價簡寫
  '一迴多少', '一個插座多少', '全部重做多少', '換箱多少',
  '拉冷氣多少', '拉熱水器多少', '加裝漏電多少', '加迴路多少',
  // 是非問句
  '可以自己換插座嗎', '可以自己換開關嗎', '可以自己換燈嗎', '可以自己加插座嗎',
  'PVC管可以用在室外嗎', 'CD管可以露明嗎', '電線可以直接釘牆上嗎',
  '銅線和鋁線可以接在一起嗎', '不同線徑可以共管嗎', '110V和220V可以共管嗎',
];

for (const q of oralVariants) {
  add({
    id: 0, type: q.includes('多少') ? 'estimation' : 'troubleshoot',
    subtype: 'oral',
    query: q, rule: { oral: true },
    keywords: q.match(/[\u4e00-\u9fffA-Za-z0-9]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// ====== 合併輸出 ======
const merged = [...deduped, ...allNew];

const stats = {};
for (const q of merged) {
  stats[q.type] = (stats[q.type] || 0) + 1;
}

console.log(`\n=== 最終統計 ===`);
console.log(`去重基底: ${deduped.length}`);
console.log(`新增:     ${allNew.length}`);
console.log(`合計:     ${merged.length}`);
console.log('\n分類明細：');
for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type.padEnd(15)} ${count} 題`);
}

// 最終去重確認
const finalSeen = new Set();
let finalDupes = 0;
for (const q of merged) {
  if (finalSeen.has(q.query)) finalDupes++;
  finalSeen.add(q.query);
}
console.log(`\n最終重複檢查: ${finalDupes} 筆重複`);

const output = {
  version: '5.0',
  created: new Date().toISOString().split('T')[0],
  description: 'RAG 規則型訓練資料集 v5.0 — 10,000 題完整覆蓋',
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
  total: merged.length,
  questions: merged,
};

const outPath = join(__dirname, 'rag-training-rules.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\n已輸出至：${outPath}`);
console.log(`檔案大小：${(JSON.stringify(output).length / 1024 / 1024).toFixed(1)} MB`);

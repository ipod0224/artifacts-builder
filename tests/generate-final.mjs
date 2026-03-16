#!/usr/bin/env node
/**
 * 最終生成器：去重 + 補齊到 ~9,500 題
 * 讀取現有資料 → 去重 → 新增不重複題目 → 輸出
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(__dirname, 'rag-training-rules.json'), 'utf-8'));

// 去重
const seen = new Set();
const deduped = [];
for (const q of base.questions) {
  if (!seen.has(q.query)) {
    seen.add(q.query);
    deduped.push(q);
  }
}
console.log(`去重前: ${base.questions.length} → 去重後: ${deduped.length} (移除 ${base.questions.length - deduped.length})`);

let nextId = Math.max(...deduped.map(q => q.id)) + 1;
function genId() { return nextId++; }

function addUnique(arr, item) {
  if (!seen.has(item.query)) {
    seen.add(item.query);
    item.id = genId();
    arr.push(item);
    return true;
  }
  return false;
}

const allNew = [];

// ===================== 補充策略 =====================
// 目標分佈（含去重後 4,131 + 新增 ~5,400 = ~9,500）
// scenario:    ~2,500  (需 ~1,200)
// selection:   ~1,800  (需 ~700)
// estimation:  ~1,600  (需 ~1,000)
// regulation:  ~1,500  (需 ~1,150)
// procedure:   ~800    (需 ~350)
// pricing:     ~600    (需 ~400)
// troubleshoot:~400    (需 ~160)
// template:    ~300    (需 ~155)

// ========= A. 場景補充 (1200) =========

// A1: 房間×人數/坪數/屋齡/預算 組合
const conditions = [
  '預算有限', '預算充足', '屋齡10年', '屋齡20年', '屋齡30年', '屋齡40年',
  '2人住', '4人住', '6人住', '獨居', '有小孩', '有長輩',
  '租屋', '自住', '新成屋', '中古屋', '毛胚屋',
];
const rooms = ['廚房','浴室','臥室','客廳','書房','陽台','餐廳','套房','辦公室','店面','地下室','頂樓'];

for (const room of rooms) {
  for (const cond of conditions) {
    addUnique(allNew, {
      id: 0, type: 'scenario', subtype: 'conditional',
      query: `${cond}的${room}配電怎麼規劃？`,
      rule: { room, condition: cond },
      keywords: [room, cond], expect_materials_gte: 1,
    });
  }
}

// A2: 具體數量需求
for (let n = 1; n <= 8; n++) {
  for (const item of ['插座','冷氣','燈','開關']) {
    addUnique(allNew, {
      id: 0, type: 'scenario', subtype: 'quantity_need',
      query: `要裝${n}個${item}需要什麼材料？`,
      rule: { item, count: n },
      keywords: [item], expect_materials_gte: 1,
    });
    addUnique(allNew, {
      id: 0, type: 'scenario', subtype: 'quantity_need',
      query: `${n}個${item}的電路怎麼配？`,
      rule: { item, count: n },
      keywords: [item, '電路'], expect_materials_gte: 1,
    });
  }
}

// A3: 特殊需求場景
const specialNeeds = [
  '家裡養魚缸需要什麼電路？', '陽台種菜要拉電嗎？', '屋頂裝太陽能板的配電？',
  '居家辦公需要幾個迴路？', '直播工作室的配電規劃？', '美髮店的電路配置？',
  '咖啡店需要多少插座？', '小吃店的220V需求？', '診所的配電要求？',
  '幼稚園的電路安全規範？', '健身房的電路負載？', '按摩店的電路規劃？',
  '民宿每間房的配電標準？', '共享辦公空間的插座密度？', '網咖的電路規劃？',
  '餐廳廚房的專用迴路？', '超商的配電需求？', '加油站的電路安全？',
  '洗車場的電路配置？', '自助洗衣店的配電？', '停車場照明電路？',
  '倉庫的基本照明迴路？', '工廠的三相電需求？', '實驗室的接地要求？',
  '電腦機房的UPS配電？', '冷凍庫的專用電路？', '游泳池的電路安全？',
  '露營地的臨時電配置？', '攤位的電源怎麼拉？', '市場攤位的用電規劃？',
  '夜市攤位需要多大的電？', '貨櫃屋的配電方式？', '組合屋的電路規劃？',
  '鐵皮屋的配電安全？', '木屋的配電注意事項？', '農舍的電路配置？',
  '雞舍的照明電路？', '溫室的加熱電路？', '監視器需要什麼電路？',
  '電動門需要什麼電路？', '對講機需要拉電嗎？', '門禁系統的電源？',
  '車庫捲門的電路需求？', '電動窗簾需要什麼電源？', '智慧家居的配電？',
  '全屋智慧開關需要改線嗎？', 'WiFi插座需要改電路嗎？', '家庭劇院的電路？',
  '音響系統需要專用迴路嗎？', '投影機需要什麼電源？', '電動升降桌的電源？',
];

for (const q of specialNeeds) {
  addUnique(allNew, {
    id: 0, type: 'scenario', subtype: 'special',
    query: q, rule: { special: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 1,
  });
}

// A4: 房間×設備安裝位置
const positions = ['天花板', '牆壁', '地板', '檯面上方', '床頭', '門口', '窗邊', '角落'];
for (const room of rooms.slice(0, 6)) {
  for (const pos of positions) {
    addUnique(allNew, {
      id: 0, type: 'scenario', subtype: 'position',
      query: `${room}的${pos}要裝插座嗎？`,
      rule: { room, position: pos },
      keywords: [room, pos, '插座'], expect_materials_gte: 1,
    });
  }
}

// ========= B. 選型補充 (700) =========

// B1: 「哪個好」系列
const whichBetter = [
  '1.6mm和2.0mm哪個好？', '2.0mm和2.6mm哪個安全？', '5.5mm²和8mm²差多少？',
  '16mm管和22mm管怎麼選？', '22mm管和28mm管差在哪？',
  '4迴路和8迴路配電箱怎麼選？', '12迴路和16迴路哪個夠用？', '20迴路和24迴路差多少錢？',
  '15A和20A的NFB哪個好？', '20A和30A的NFB怎麼選？', '50A和75A的NFB差在哪？',
  '單切和雙切開關差在哪？', '雙切和三路開關一樣嗎？',
  '單插座和雙插座哪個實用？', '雙插座和三插座怎麼選？',
  '1.5m和2.4m接地棒哪個好？', '銅質和鍍鋅接地棒差別？',
  '八角盒和四角盒怎麼選？', '拉線盒和接線盒差在哪？',
  'PVC線和XLPE線哪個耐用？', '國產線和進口線差很多嗎？',
  '士林BH和BHU差在哪？', '士林BHU和BHH怎麼選？',
  '國際牌星光和全彩差多少？', '國際牌和中一電工哪個好？',
  '南亞PVC管和春風PVC管有差嗎？',
];

for (const q of whichBetter) {
  addUnique(allNew, {
    id: 0, type: 'selection', subtype: 'which_better',
    query: q, rule: { comparison: true },
    keywords: q.match(/[\u4e00-\u9fff0-9A-Za-z.]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 1,
  });
}

// B2: 「夠不夠」系列
for (const gauge of ['1.6mm', '2.0mm', '2.6mm', '5.5mm²', '8mm²', '14mm²']) {
  for (const load of ['照明', '一般插座', '冷氣', '電熱水器', '烤箱', '洗碗機', '充電樁']) {
    addUnique(allNew, {
      id: 0, type: 'selection', subtype: 'enough',
      query: `${gauge}的線拉${load}夠嗎？`,
      rule: { gauge, load },
      keywords: [gauge, load], expect_materials_gte: 1,
    });
  }
}

// B3: 「推薦」系列
const recScenarios = [
  '小坪數套房', '30坪三房', '透天厝', '辦公室', '店面', '工廠',
  '預算有限', '注重安全', '追求品質', '工業風裝潢', '極簡裝潢',
];

for (const s of recScenarios) {
  for (const item of ['電線', 'NFB', '管材', '配電箱', '開關插座']) {
    addUnique(allNew, {
      id: 0, type: 'selection', subtype: 'recommend',
      query: `${s}推薦用什麼${item}？`,
      rule: { scenario: s, item },
      keywords: [s, item], expect_materials_gte: 1,
    });
  }
}

// ========= C. 估價補充 (1000) =========

// C1: 「多少錢」口語大量展開
const priceItems = [
  '一個插座', '一個開關', '一盞燈', '一個220V插座', '一迴路', '一個冷氣迴路',
  '一個電熱水器迴路', '一個漏電斷路器', '一顆NFB', '一個配電箱',
  '重拉一迴電線', '換一個面板', '接地工程', '電路檢測', '配電設計',
  '一米PVC管', '一米EMT管', '一米CD管', '一米電線', '一米接地線',
  '出勤費', '材料運費', '廢棄物清運', '安全防護', '竣工檢驗',
];

const priceQuestionForms = [
  (i) => `${i}多少錢？`,
  (i) => `${i}要花多少？`,
  (i) => `${i}大概幾塊？`,
  (i) => `${i}的行情價？`,
  (i) => `${i}連工帶料多少？`,
  (i) => `裝${i}要多少預算？`,
  (i) => `${i}的市場價格？`,
  (i) => `${i}怎麼算費用？`,
];

for (const item of priceItems) {
  for (let i = 0; i < priceQuestionForms.length; i++) {
    const form = priceQuestionForms[i];
    addUnique(allNew, {
      id: 0, type: 'estimation', subtype: 'price_inquiry',
      query: form(item), rule: { item },
      keywords: [item, '費用'], expect_materials_gte: 0,
    });
  }
}

// C2: 總預算估算（更多坪數×屋型）
for (let ping = 8; ping <= 120; ping += 4) {
  addUnique(allNew, {
    id: 0, type: 'estimation', subtype: 'budget',
    query: `${ping}坪全室重配線預算？`,
    rule: { ping, min: ping * 2500, max: ping * 4000 },
    keywords: ['重配線', '預算'], expect_materials_gte: 1,
  });
}

// C3: 比較費用
const costComparisons = [
  '明管和暗管費用差多少？', '新拉線和抽換線費用差異？', '重配線和局部換線哪個划算？',
  '用PVC管和EMT管費用差多少？', '用國產線和進口線差多少錢？',
  '請技工和技師的費用差異？', '點工計價和總包哪個便宜？',
  '自己買料請師傅裝和全包差多少？', '白天施工和夜間施工費用差？',
  '平日和假日施工費用差多少？', '急件加價通常多少？',
  '北部和南部工程價差？', '小案和大案的單價差？',
];

for (const q of costComparisons) {
  addUnique(allNew, {
    id: 0, type: 'estimation', subtype: 'cost_compare',
    query: q, rule: { comparison: true },
    keywords: ['費用', '比較'], expect_materials_gte: 0,
  });
}

// C4: 材料數量×價格
const matPrices = [
  { name: '無熔絲斷路器 1P 20A', price: 130 },
  { name: '無熔絲斷路器 2P 30A', price: 350 },
  { name: '漏電斷路器 2P 20A', price: 595 },
  { name: '雙插座', price: 120 },
  { name: '三插座', price: 180 },
  { name: '冷氣專用插座', price: 250 },
  { name: '單切開關', price: 60 },
  { name: '三路開關', price: 100 },
  { name: '調光開關', price: 350 },
  { name: '接地棒 1.5m', price: 280 },
  { name: '接地棒 2.4m', price: 420 },
  { name: '接地端子板', price: 150 },
  { name: '接線盒', price: 60 },
  { name: '八角盒', price: 45 },
  { name: '四角盒', price: 35 },
];

for (const m of matPrices) {
  for (let n = 1; n <= 10; n++) {
    addUnique(allNew, {
      id: 0, type: 'estimation', subtype: 'quantity_price',
      query: `${n}個${m.name}多少錢？`,
      rule: { item: m.name, count: n, unit_price: m.price, total: n * m.price },
      keywords: [m.name, '費用'], expect_materials_gte: 1,
    });
  }
}

// ========= D. 法規補充 (1150) =========

// D1: 「規定」系列
const regulationTopics = [
  '配電箱的安裝規定', '插座的安裝高度規定', '開關的安裝高度規定',
  '浴室配電的法規要求', '廚房配電的法規要求', '陽台配電的法規要求',
  '接地工程的法規標準', '導線管的佔積率規定', '電線顏色的規定',
  '漏電斷路器的規格要求', 'NFB的選用原則', '配線的溫度修正',
  '多導線的降載規定', '電壓降的容許範圍', '照明迴路的法規要求',
  '插座迴路的法規要求', '專用迴路的法規定義', '接地電阻的量測標準',
  '施工人員的資格要求', '竣工檢驗的項目', '配電圖的繪製規定',
  '緊急照明的法規要求', '消防設備的配電規定', '避雷設備的接地要求',
];

for (const topic of regulationTopics) {
  const forms = [
    `${topic}是什麼？`, `${topic}怎麼規定的？`, `${topic}在哪條法規？`,
    `請問${topic}`, `台灣的${topic}`,
  ];
  for (const q of forms) {
    addUnique(allNew, {
      id: 0, type: 'regulation', subtype: 'topic',
      query: q, rule: { topic },
      keywords: topic.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
      expect_materials_gte: 0,
    });
  }
}

// D2: 「為什麼」系列
const whyQueries = [
  '為什麼要用銅線不用鋁線？', '為什麼接地線要綠色？', '為什麼需要漏電斷路器？',
  '為什麼冷氣要專用迴路？', '為什麼電熱水器要接地？', '為什麼要分迴路？',
  '為什麼NFB會跳？', '為什麼管內不能塞太滿？', '為什麼要做佔積率限制？',
  '為什麼XLPE比PVC好？', '為什麼EMT管比PVC管貴？', '為什麼CD管不能露明？',
  '為什麼火線要接在開關上？', '為什麼要做負載平衡？', '為什麼中性線不能斷？',
  '為什麼要定期測試ELCB？', '為什麼NFB有壽命限制？', '為什麼電線有溫度額定？',
  '為什麼配電箱要標示？', '為什麼接頭不能藏在管內？', '為什麼老屋要全面換線？',
  '為什麼不能用延長線當固定配線？', '為什麼三孔插座一定要接地？',
  '為什麼220V設備要用2P NFB？', '為什麼浴室插座要裝高一點？',
  '為什麼建議用CNS認證材料？', '為什麼不同電壓不能共管？',
  '為什麼暗管要用管保護？', '為什麼電線不能直接埋在水泥裡？',
  '為什麼戶外要用EMT管？', '為什麼NFB額定不能超過電線容量？',
];

for (const q of whyQueries) {
  addUnique(allNew, {
    id: 0, type: 'regulation', subtype: 'why',
    query: q, rule: { explanation: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// D3: CNS 標準相關
const cnsQueries = [
  'CNS認證的電線怎麼辨識？', 'CNS標誌在電線上哪裡看？', '沒有CNS認證的線可以用嗎？',
  '電線的CNS標準是幾號？', 'NFB有CNS認證嗎？', 'PVC管要看什麼認證？',
  'EMT管有國家標準嗎？', '開關插座需要認證嗎？', '配電箱有什麼認證要求？',
  '什麼是商品檢驗標誌？', '電器商品強制檢驗的項目？', '違規使用非認證電料會怎樣？',
];

for (const q of cnsQueries) {
  addUnique(allNew, {
    id: 0, type: 'regulation', subtype: 'cns',
    query: q, rule: { topic: 'CNS' },
    keywords: ['CNS', '認證'], expect_materials_gte: 0,
  });
}

// D4: 證照相關
const licenseQueries = [
  '水電施工需要什麼證照？', '甲種電匠和乙種差在哪？', '室內配線丙級有用嗎？',
  '自己換插座需要證照嗎？', '自己裝燈需要證照嗎？', '動到配電箱需要證照嗎？',
  '大電工程需要什麼資格？', '用電設備檢驗需要什麼證照？', '電氣技術士有幾級？',
  '水電行需要什麼執照？', '承攬電氣工程需要什麼資格？', '怎麼查師傅有沒有證照？',
];

for (const q of licenseQueries) {
  addUnique(allNew, {
    id: 0, type: 'regulation', subtype: 'license',
    query: q, rule: { topic: '證照' },
    keywords: ['證照', '資格'], expect_materials_gte: 0,
  });
}

// ========= E. 施工補充 (350) =========

// E1: DIY 相關
const diyQueries = [
  '自己換插座面板怎麼做？', '自己換開關安全嗎？', '自己換燈泡需要斷電嗎？',
  '自己裝吊扇怎麼接線？', '自己裝崁燈可以嗎？', '自己測漏電怎麼做？',
  '自己換NFB危險嗎？', '自己拉網路線要注意什麼？', '自己裝監視器要拉電嗎？',
  '自己裝USB插座怎麼接？', '自己換插座要準備什麼工具？', '自己裝調光開關難嗎？',
  '什麼電氣工作可以自己做？', '什麼電氣工作一定要找師傅？', 'DIY換插座的風險？',
  '不懂電可以自己換開關嗎？', '換開關面板需要工具嗎？', '拆開關面板會觸電嗎？',
];

for (const q of diyQueries) {
  addUnique(allNew, {
    id: 0, type: 'procedure', subtype: 'diy',
    query: q, rule: { diy: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// E2: 驗收相關
const inspectionQueries = [
  '水電驗收要看哪些項目？', '新屋交屋水電怎麼驗？', '裝修完工電路怎麼驗收？',
  '怎麼測試各迴路是否正常？', '怎麼確認接地有做好？', '怎麼測ELCB是否正常？',
  '驗收時要帶什麼工具？', '配電箱驗收要看什麼？', '插座驗收要測什麼？',
  '電壓量起來多少算正常？', '接地電阻多少算合格？', '絕緣電阻多少算合格？',
  '驗收不合格怎麼辦？', '水電保固期內出問題找誰？', '竣工圖要包含什麼？',
];

for (const q of inspectionQueries) {
  addUnique(allNew, {
    id: 0, type: 'procedure', subtype: 'inspection',
    query: q, rule: { inspection: true },
    keywords: ['驗收', '檢查'], expect_materials_gte: 0,
  });
}

// E3: 施工準備
const prepQueries = [
  '水電施工前要準備什麼？', '施工前要跟鄰居說嗎？', '施工前要先斷電嗎？',
  '暗管施工前要先畫圖嗎？', '配電箱安裝前要先確認什麼？', '施工安全防護有哪些？',
  '施工現場要準備什麼工具？', '重配線前要先拍照記錄嗎？', '拆除前要注意什麼？',
  '施工噪音有時間限制嗎？', '假日可以施工嗎？', '施工要申請什麼許可嗎？',
];

for (const q of prepQueries) {
  addUnique(allNew, {
    id: 0, type: 'procedure', subtype: 'preparation',
    query: q, rule: { preparation: true },
    keywords: ['施工', '準備'], expect_materials_gte: 0,
  });
}

// ========= F. 價格補充 (400) =========

// F1: 省錢技巧
const savingQueries = [
  '水電工程怎麼省錢？', '裝修省電路預算的方法？', '哪些電路可以先不做？',
  '明管比暗管省多少？', '自己買料能省多少？', '淡季施工能便宜多少？',
  '一次做比分次做省嗎？', '團購材料有折扣嗎？', '用國產線能省多少？',
  '不裝調光開關省多少？', '用單插座比雙插座省嗎？', '配電箱買小的省錢嗎？',
  '省錢但不能省的項目？', '哪些安全設備不能省？', '便宜的材料安全嗎？',
];

for (const q of savingQueries) {
  addUnique(allNew, {
    id: 0, type: 'pricing', subtype: 'saving',
    query: q, rule: { topic: '省錢' },
    keywords: ['省錢', '預算'], expect_materials_gte: 0,
  });
}

// F2: 各城市行情
const cities = ['台北', '新北', '桃園', '台中', '台南', '高雄', '新竹', '彰化'];
for (const city of cities) {
  addUnique(allNew, {
    id: 0, type: 'pricing', subtype: 'regional',
    query: `${city}水電施工行情多少？`, rule: { city },
    keywords: [city, '行情'], expect_materials_gte: 0,
  });
  addUnique(allNew, {
    id: 0, type: 'pricing', subtype: 'regional',
    query: `${city}的水電工價格？`, rule: { city },
    keywords: [city, '工價'], expect_materials_gte: 0,
  });
  addUnique(allNew, {
    id: 0, type: 'pricing', subtype: 'regional',
    query: `${city}換配電箱多少錢？`, rule: { city },
    keywords: [city, '配電箱'], expect_materials_gte: 1,
  });
}

// F3: 歷年漲幅
const yearQueries = [
  '去年電纜漲了多少？', '今年銅價走勢如何？', '電纜價格每年都在漲嗎？',
  '工資每年漲多少？', '過去5年電料漲了多少？', '材料價格和10年前比差多少？',
  '2025年到2026年電纜漲幅？', 'PVC管有漲價嗎？', 'EMT管最近有調價嗎？',
  '士林NFB有漲價嗎？', '開關插座價格穩定嗎？', '配電箱最近有調價嗎？',
];

for (const q of yearQueries) {
  addUnique(allNew, {
    id: 0, type: 'pricing', subtype: 'historical',
    query: q, rule: { trend: true },
    keywords: ['價格', '趨勢'], expect_materials_gte: 0,
  });
}

// ========= G. 故障補充 (160) =========

// G1: 具體場景故障
const faultDetails = [
  '冷氣開了5分鐘就跳電', '同時用微波爐和快煮壺跳電', '下雨天就漏電跳電',
  '插座插了就冒火花', '開關按下去有啪的聲音', 'NFB推上去馬上又跳',
  '某個房間完全沒電', '全屋突然停電但鄰居有電', '電燈越來越暗',
  '插座發出嗡嗡聲', '牆壁發燙', '聞到燒焦味但找不到在哪',
  '新裝的ELCB一直跳', '剛換的NFB跳了', '充電樁裝了老跳電',
  '電器用久了插頭很燙', '延長線很燙但電器沒幾個', '配電箱有燒焦痕跡',
  '電線外皮裂開了', '牆壁插座黑黑的', '開關面板變色了',
  '浴室燈突然不亮', '陽台插座泡水了', '地下室電路潮濕問題',
  '老屋電線抽出來都黑了', '管路堵住穿不了線', '接地棒打了但電阻太高',
];

for (const q of faultDetails) {
  addUnique(allNew, {
    id: 0, type: 'troubleshoot', subtype: 'specific',
    query: q + '怎麼辦？', rule: { specific: true },
    keywords: q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [],
    expect_materials_gte: 0,
  });
}

// ========= H. 模板補充 (155) =========

// H1: 施工說明模板
const constructionTemplates = [
  { q: '怎麼跟客戶說明暗管施工流程？', topic: '暗管施工' },
  { q: '怎麼跟客戶解釋迴路平衡？', topic: '迴路平衡' },
  { q: '怎麼跟客戶說明NFB的選擇？', topic: 'NFB選用' },
  { q: '怎麼解釋為什麼要裝ELCB？', topic: 'ELCB必要性' },
  { q: '怎麼說明配電箱升級的好處？', topic: '配電箱升級' },
  { q: '怎麼解釋電線線徑的重要性？', topic: '線徑安全' },
  { q: '怎麼說明接地的重要性？', topic: '接地保護' },
  { q: '怎麼跟客戶解釋佔積率？', topic: '佔積率' },
  { q: '怎麼說明為什麼要專用迴路？', topic: '專用迴路' },
  { q: '怎麼解釋電壓降問題？', topic: '電壓降' },
  { q: '怎麼跟客戶說明材料等級差異？', topic: '材料等級' },
  { q: '怎麼解釋銅價對報價的影響？', topic: '銅價影響' },
];

for (const ct of constructionTemplates) {
  addUnique(allNew, {
    id: 0, type: 'template', subtype: 'explanation_template',
    query: ct.q, rule: { topic: ct.topic },
    keywords: [ct.topic], expect_materials_gte: 0,
  });
  addUnique(allNew, {
    id: 0, type: 'template', subtype: 'explanation_template',
    query: ct.q.replace('客戶', '業主'),
    rule: { topic: ct.topic },
    keywords: [ct.topic], expect_materials_gte: 0,
  });
}

// H2: 報價單項目說明
const invoiceItems = [
  '報價單上的「迴路」是什麼？', '報價單上的「點位」是什麼？',
  '報價單上的「管銷」是什麼？', '報價單上的「五金」包含什麼？',
  '報價單上的「連工帶料」是什麼意思？', '報價單上的「一式」是什麼意思？',
  '報價單的項目順序通常怎麼排？', '報價單需要附材料明細嗎？',
  '報價有效期限通常多久？', '報價和合約金額會不一樣嗎？',
  '追加工程怎麼報價？', '變更設計怎麼計費？',
];

for (const q of invoiceItems) {
  addUnique(allNew, {
    id: 0, type: 'template', subtype: 'invoice',
    query: q, rule: { invoice: true },
    keywords: ['報價單'], expect_materials_gte: 0,
  });
}

// ===================== 合併輸出 =====================

const merged = [...deduped, ...allNew];

const stats = {};
for (const q of merged) {
  stats[q.type] = (stats[q.type] || 0) + 1;
}

console.log(`\n=== 最終統計 ===`);
console.log(`去重基底: ${deduped.length}`);
console.log(`新增:     ${allNew.length}`);
console.log(`合計:     ${merged.length} (+ 既有 500 題 = ${merged.length + 500})`);
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
  version: '4.0',
  created: new Date().toISOString().split('T')[0],
  description: 'RAG 規則型訓練資料集 v4.0 — 去重 + 8 大類完整覆蓋',
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

#!/usr/bin/env node
/**
 * 最後衝刺 v7：補到 10,000+ 題
 * 重點：交叉組合 + 更多口語 + 長尾問法
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(__dirname, 'rag-training-rules.json'), 'utf-8'));

const seen = new Set();
const deduped = [];
for (const q of base.questions) {
  if (!seen.has(q.query)) { seen.add(q.query); deduped.push(q); }
}
console.log(`基底: ${deduped.length}`);

let nextId = Math.max(...deduped.map(q => q.id)) + 1;
const allNew = [];
function add(type, subtype, query, rule, keywords, matGte = 0) {
  if (!seen.has(query)) {
    seen.add(query);
    allNew.push({ id: nextId++, type, subtype, query, rule, keywords, expect_materials_gte: matGte });
    return true;
  }
  return false;
}

// ====== 資料 ======
const rooms = ['廚房','浴室','臥室','客廳','書房','陽台','餐廳','玄關','走廊','儲藏室','神明廳','嬰兒房','更衣室','工作室'];
const appliances = ['冷氣','電熱水器','電磁爐','烤箱','微波爐','洗碗機','乾衣機','洗衣機','冰箱','除濕機','暖風機','充電樁','吹風機','電暖器','快煮壺','飲水機','烘碗機','氣炸鍋','咖啡機','吸塵器','電動牙刷','按摩椅','跑步機','電動升降桌'];
const wireGauges = ['1.6mm','2.0mm','2.6mm','5.5mm²','8mm²','14mm²','22mm²','38mm²','60mm²','100mm²'];
const nfbAmps = ['15A','20A','30A','50A','75A','100A','150A','225A'];

// ====== A. 場景：更多生活問題 (~300) ======

// 裝修情境對話
const renovQueries = [];
for (let ping = 10; ping <= 50; ping += 5) {
  for (const age of ['新成屋','5年','10年','20年','30年','40年']) {
    renovQueries.push(`${ping}坪${age}的房子要不要全面重配線？`);
  }
}
for (const q of renovQueries) {
  add('scenario', 'renovation_age', q, { renovation: true },
    q.match(/[\u4e00-\u9fff0-9]+/g)?.slice(0, 3) || [], 0);
}

// 電器組合問題
const applPairs = [];
for (let i = 0; i < appliances.length; i++) {
  for (let j = i + 1; j < Math.min(i + 6, appliances.length); j++) {
    applPairs.push([appliances[i], appliances[j]]);
  }
}
for (const [a, b] of applPairs.slice(0, 60)) {
  add('scenario', 'combo', `${a}和${b}可以共用迴路嗎？`,
    { appliances: [a, b] }, [a, b, '迴路'], 0);
}

// 特定生活情境
const lifeScenarios = [
  '家裡有新生兒水電安全要注意什麼？', '家裡有養貓電線要怎麼保護？',
  '家裡有養狗插座要裝高一點嗎？', '養魚需要多少插座？', '養爬蟲需要什麼電源？',
  '在家工作需要多少迴路？', '直播主需要什麼配電？', 'YouTuber工作室電路規劃？',
  '陽台改成洗衣間配電要怎麼改？', '房間改成辦公室要加迴路嗎？',
  '車庫改成工作間配電要改嗎？', '頂樓加蓋當曬衣間要拉電嗎？',
  '出租套房每間要獨立迴路嗎？', '分租套房電表怎麼分？',
  '隔成兩間臥室電路怎麼分？', '打通兩間房配電要重做嗎？',
  '開放式廚房配電和封閉式有差嗎？', '吧台要預留什麼電源？',
  '中島需要地板插座嗎？', '書桌區要幾個插座？',
  '化妝台需要什麼插座？', '鞋櫃要預留插座嗎？', '餐櫃要預留插座嗎？',
  '衣櫃要裝燈嗎需要配電嗎？', '浴室鏡櫃有燈要另外拉線嗎？',
  '窗簾盒需要預留電源嗎？', '電動窗簾的電源怎麼預留？',
  '掃地機器人充電座要預留插座嗎？', '智慧音箱需要特別配電嗎？',
  '過年大掃除後電器都啟動會跳嗎？', '夏天同時開多台冷氣會跳嗎？',
];
for (const q of lifeScenarios) {
  add('scenario', 'life', q, { life: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== B. 選型：規格對照 (~250) ======

// 線徑→安培→NFB 完整對照
for (const gauge of wireGauges) {
  add('selection', 'gauge_nfb', `${gauge}的線要配幾A的NFB？`,
    { gauge }, [gauge, 'NFB'], 1);
  add('selection', 'gauge_use', `${gauge}的線可以接多少瓦？`,
    { gauge }, [gauge, '瓦數'], 1);
}

for (const amp of nfbAmps) {
  add('selection', 'amp_wire', `${amp}的NFB要搭多粗的線才安全？`,
    { amp }, [amp, '線徑'], 1);
  add('selection', 'amp_load', `${amp}的迴路最多可以接多少電器？`,
    { amp }, [amp, '電器'], 0);
}

// 材料替代方案
const alternatives = [
  ['PVC管', 'CD管', '暗管'],
  ['PVC管', 'EMT管', '明管'],
  ['PVC IV', 'XLPE', '電纜'],
  ['一般插座', '防水插座', '浴室'],
  ['單切開關', '感應開關', '走廊'],
  ['傳統NFB', '智慧斷路器', '配電'],
  ['銅線', '鋁線', '幹線'],
  ['實心線', '絞線', '長距離'],
];
for (const [a, b, ctx] of alternatives) {
  add('selection', 'alternative', `${ctx}用${a}還是${b}比較好？`,
    { optionA: a, optionB: b, context: ctx }, [a, b, ctx], 1);
  add('selection', 'alternative', `${a}換成${b}可以嗎？`,
    { optionA: a, optionB: b }, [a, b], 1);
}

// 各房間推薦配置
for (const room of rooms.slice(0, 10)) {
  add('selection', 'room_config', `${room}建議裝幾個插座？`,
    { room }, [room, '插座'], 1);
  add('selection', 'room_config', `${room}需要幾個照明迴路？`,
    { room }, [room, '照明'], 1);
  add('selection', 'room_config', `${room}需要專用迴路嗎？`,
    { room }, [room, '專用迴路'], 0);
}

// ====== C. 估價：更多具體場景 (~300) ======

// 加裝×數量×房間
for (const room of rooms.slice(0, 8)) {
  for (let n = 1; n <= 5; n++) {
    add('estimation', 'room_outlet_cost', `${room}加裝${n}個插座連工帶料多少？`,
      { room, count: n }, [room, '插座', '費用'], 1);
  }
}

// 配電箱升級方案
for (const from of ['4迴路','6迴路','8迴路']) {
  for (const to of ['12迴路','16迴路','20迴路','24迴路']) {
    if (parseInt(from) < parseInt(to)) {
      add('estimation', 'panel_upgrade', `配電箱從${from}升級到${to}多少錢？`,
        { from, to }, ['配電箱', '升級', '費用'], 1);
    }
  }
}

// 各種工程項目費用（更多問法）
const projectCosts = [
  { item: '全室重配線20坪', range: [50000, 80000] },
  { item: '全室重配線30坪', range: [75000, 120000] },
  { item: '全室重配線40坪', range: [100000, 160000] },
  { item: '浴室加裝暖風機迴路', range: [3500, 6000] },
  { item: '廚房加三個專用迴路', range: [10000, 18000] },
  { item: '陽台拉一迴電', range: [2500, 5000] },
  { item: '車庫裝充電樁配電', range: [15000, 35000] },
  { item: '主臥加裝雙切開關', range: [1500, 3000] },
  { item: '增設接地系統', range: [5000, 12000] },
  { item: '更換全屋NFB', range: [8000, 15000] },
  { item: '安裝全屋ELCB', range: [5000, 10000] },
  { item: '管路全部換新', range: [30000, 60000] },
  { item: '天花板照明迴路', range: [2000, 4000] },
  { item: '走廊感應燈安裝', range: [1500, 3000] },
  { item: '電表遷移', range: [5000, 10000] },
];
for (const pc of projectCosts) {
  add('estimation', 'project_cost', `${pc.item}大概多少錢？`,
    { item: pc.item, min: pc.range[0], max: pc.range[1] },
    [pc.item, '費用'], 0);
  add('estimation', 'project_cost', `${pc.item}的費用怎麼算？`,
    { item: pc.item, min: pc.range[0], max: pc.range[1] },
    [pc.item, '費用'], 0);
}

// ====== D. 法規：更多安全和標準 (~300) ======

// 各電器的安裝法規
for (const appl of appliances.slice(0, 16)) {
  add('regulation', 'install_reg', `安裝${appl}有什麼法規限制？`,
    { appliance: appl }, [appl, '法規'], 0);
}

// 各房間插座/開關高度
for (const room of rooms.slice(0, 8)) {
  add('regulation', 'height', `${room}插座裝多高？`,
    { room, item: '插座' }, [room, '插座', '高度'], 0);
  add('regulation', 'height', `${room}開關裝多高？`,
    { room, item: '開關' }, [room, '開關', '高度'], 0);
}

// 消防和逃生相關
const fireQueries = [
  '住宅需要緊急照明嗎？', '逃生指示燈的配電？', '消防排煙機的電路？',
  '火警受信總機的配電？', '灑水頭需要配電嗎？', '消防栓加壓馬達的電路？',
  '防火門磁力鎖的配電？', '消防設備要接在哪個迴路？', '消防迴路需要獨立電源嗎？',
  '住家安裝火災警報器要拉線嗎？', '一氧化碳偵測器需要配電嗎？', '煙霧偵測器用電池還是接電？',
  '逃生梯照明的配電要求？', '停電時消防設備怎麼供電？', '發電機和UPS的差別？',
];
for (const q of fireQueries) {
  add('regulation', 'fire_safety', q, { fire: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// 節能相關法規
const energyQueries = [
  '住宅用電效率有規定嗎？', '節能燈具有什麼要求？', 'LED驅動器需要什麼認證？',
  '太陽能板接電有什麼規定？', '儲能電池的安裝規範？', '電動車充電設施的法規？',
  '智慧電表的安裝規定？', '用電管理系統有什麼規範？', '節能開關有補助嗎？',
  '家用太陽能賣電怎麼接？', '台電契約容量的分級？', '時間電價怎麼配合配電？',
];
for (const q of energyQueries) {
  add('regulation', 'energy', q, { energy: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// 更多「可以嗎/合法嗎」
const canIQueries = [
  '自己接220V插座合法嗎？', '自己裝配電箱合法嗎？', '房客可以改電路嗎？',
  '租屋處可以加插座嗎？', '二樓可以接一樓的電嗎？', '頂樓違建可以申請電嗎？',
  '鐵皮屋可以走暗管嗎？', '木造房可以用PVC管嗎？', '磚牆可以開橫槽嗎？',
  'RC牆可以開超過60cm的橫槽嗎？', '剪力牆可以打洞走管嗎？', '樓板可以開孔穿管嗎？',
  '公共區域可以自己拉線嗎？', '社區機電室自己可以進去嗎？',
  '台電的電表箱可以自己打開嗎？', '自己改電表的位置可以嗎？',
  '二手材料可以裝在新工程嗎？', '沒有CNS的材料可以用嗎？',
  '大陸製的電線可以用嗎？', '水貨NFB可以用嗎？',
];
for (const q of canIQueries) {
  add('regulation', 'legality', q, { legal: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== E. 施工和工序補充 (~200) ======

// 各空間施工注意事項
for (const room of rooms.slice(0, 10)) {
  add('procedure', 'room_work', `${room}配電施工要注意什麼？`,
    { room }, [room, '施工'], 0);
  add('procedure', 'room_work', `${room}拉線有什麼技巧？`,
    { room }, [room, '拉線'], 0);
}

// 問題排除流程
const troubleFlows = [
  { trigger: '跳電', steps: ['關閉所有電器', '逐迴路測試', '找出問題迴路', '測試該迴路電器', '判斷原因'] },
  { trigger: '漏電', steps: ['關閉總開關', '測試各迴路絕緣', '找出漏電迴路', '斷開負載測管線', '修復或更換'] },
  { trigger: '電壓低', steps: ['量測入戶電壓', '量測配電箱電壓', '量測末端電壓', '計算壓降', '找出瓶頸'] },
  { trigger: '過熱', steps: ['關閉電源', '找出發熱源', '檢查接頭', '檢查線徑', '修復'] },
];
for (const tf of troubleFlows) {
  add('procedure', 'trouble_flow', `${tf.trigger}排除的SOP？`,
    { trigger: tf.trigger, steps: tf.steps }, [tf.trigger, 'SOP'], 0);
  add('procedure', 'trouble_flow', `${tf.trigger}要怎麼一步一步排除？`,
    { trigger: tf.trigger, steps: tf.steps }, [tf.trigger, '排除'], 0);
}

// 緊急處理
const emergencyQueries = [
  '電線起火怎麼處理？', '觸電怎麼急救？', '配電箱冒煙怎麼辦？',
  '插座爆炸怎麼辦？', '電器泡水怎麼處理？', '聞到電線燒焦味怎麼辦？',
  '停電時怎麼安全操作？', '停電後恢復供電要注意什麼？', '雷擊後要檢查什麼？',
  '地震後配電箱要檢查什麼？', '水災後復電前要做什麼？', '電弧閃絡怎麼應對？',
];
for (const q of emergencyQueries) {
  add('procedure', 'emergency', q, { emergency: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== F. 更多故障排除 (~150) ======

// NFB 相關故障
for (const amp of ['15A','20A','30A','50A','75A','100A']) {
  add('troubleshoot', 'nfb_trip', `${amp}的NFB一直跳怎麼辦？`,
    { amp }, [amp, 'NFB', '跳電'], 1);
  add('troubleshoot', 'nfb_trip', `${amp}的NFB推不上去是壞了嗎？`,
    { amp }, [amp, 'NFB'], 1);
}

// 特定品牌故障
for (const brand of ['士林','國際牌','東元','富士']) {
  add('troubleshoot', 'brand_fault', `${brand}NFB跳電頻繁正常嗎？`,
    { brand }, [brand, 'NFB', '跳電'], 1);
}

// 季節×故障
const seasonFaults = [
  '夏天冷氣全開就跳電', '冬天電暖器開了跳電', '下雨天浴室ELCB就跳',
  '潮濕天配電箱有水珠', '颱風天電壓忽高忽低', '雷雨天電器燒壞',
  '梅雨季插座有水氣', '回南天電線管路結露', '高溫天電線發燙',
  '冬天開暖氣跳電原因', '夏天電費暴增原因', '春天返潮電路問題',
];
for (const q of seasonFaults) {
  add('troubleshoot', 'season', q, { season: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== G. 價格更多組合 (~150) ======

// 各品牌×材料價格
for (const brand of ['華新','太平洋','大亞','大山']) {
  for (const spec of ['2.0mm','5.5mm²','14mm²','22mm²']) {
    add('pricing', 'brand_wire_price', `${brand} ${spec}電線一米多少？`,
      { brand, spec }, [brand, spec, '價格'], 1);
  }
}

for (const brand of ['士林','國際牌']) {
  for (const type of ['NFB 2P 30A','NFB 3P 100A','ELCB 2P 20A','ELCB 2P 30A']) {
    add('pricing', 'brand_nfb_price', `${brand}${type}多少錢？`,
      { brand, type }, [brand, type], 1);
  }
}

// 折數和折扣
const discountQueries = [
  '電纜牌價和實售價差多少？', '水電行買材料有折扣嗎？', '大量採購電線折扣多少？',
  '電料行和五金行價差多少？', '網購電料比實體店便宜嗎？', '水電材料去哪買最便宜？',
  '電料批發價大概打幾折？', '建材展的折扣力度如何？', '電纜牌價每月會變嗎？',
  '不同品牌電線折數差多少？', 'NFB牌價打幾折是合理的？', '配電箱有折扣嗎？',
  '工程報價材料費通常加多少利潤？', '師傅買材料的價格比零售低多少？', '材料費佔工程款多少比例？',
];
for (const q of discountQueries) {
  add('pricing', 'discount', q, { discount: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== H. 模板最後補充 (~100) ======

// 比喻/類比解釋
const analogyQueries = [
  '迴路就像什麼？怎麼跟外行人解釋？', 'NFB就像什麼？怎麼解釋給不懂電的人？',
  '漏電斷路器用什麼比喻好理解？', '電壓和電流用什麼比喻？',
  '佔積率用什麼比喻好懂？', '接地用什麼比喻解釋？',
  '幹線和分路用什麼比喻？', '配電箱用什麼比喻好理解？',
  '電線線徑用什麼比喻？', '過載用什麼比喻解釋？',
];
for (const q of analogyQueries) {
  add('template', 'analogy', q, { analogy: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// 常見迷思
const mythQueries = [
  '用220V比110V省電是迷思嗎？', '電線越粗越安全嗎？',
  'NFB越大越好嗎？', '多裝幾個ELCB更安全嗎？',
  '名牌材料一定比較好嗎？', '新的一定比舊的安全嗎？',
  'EMT管一定比PVC管好嗎？', 'XLPE一定比PVC線好嗎？',
  '暗管一定比明管好嗎？', '獨立迴路越多越好嗎？',
  '配電箱越大越好嗎？', '接地棒越長越好嗎？',
  '最貴的就是最好的嗎？', '日本進口一定比台灣製好嗎？',
  '有CNS認證就一定安全嗎？', '電線有壽命限制嗎？不是銅做的嗎？',
];
for (const q of mythQueries) {
  add('template', 'myth', q, { myth: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// 入門知識系列
const beginnerQueries = [
  '水電入門要先學什麼？', '看懂配電圖需要什麼基礎？', '水電DIY入門書推薦？',
  '家用電的基本概念？', '電力系統的組成？', '配電系統怎麼運作？',
  '家裡的電是怎麼來的？', '電表到配電箱之間是什麼？', '為什麼台灣用110V？',
  '美國120V和台灣110V一樣嗎？', '日本100V的電器在台灣能用嗎？',
  '歐洲220V的電器在台灣怎麼用？', '變壓器可以轉換電壓嗎？',
  '穩壓器和UPS差在哪？', '延長線和排插有什麼不同？',
  '什麼是斷路器？跟保險絲有什麼不同？', '以前的保險絲現在還能用嗎？',
  '配電箱裡面每個開關控制什麼？', '家裡總開關在哪裡？', '怎麼找到對應的NFB？',
];
for (const q of beginnerQueries) {
  add('template', 'beginner', q, { beginner: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== 合併輸出 ======
const merged = [...deduped, ...allNew];
const stats = {};
for (const q of merged) { stats[q.type] = (stats[q.type] || 0) + 1; }

console.log(`\n=== 最終統計 ===`);
console.log(`去重基底: ${deduped.length}`);
console.log(`新增:     ${allNew.length}`);
console.log(`合計:     ${merged.length}`);
console.log('\n分類明細：');
for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type.padEnd(15)} ${count} 題`);
}

const finalSeen = new Set();
let finalDupes = 0;
for (const q of merged) {
  if (finalSeen.has(q.query)) finalDupes++;
  finalSeen.add(q.query);
}
console.log(`\n最終重複檢查: ${finalDupes} 筆重複`);

if (merged.length >= 10000) {
  console.log(`\n✅ 已達成 10,000 題目標！`);
} else {
  console.log(`\n⚠️ 距離 10,000 題還差 ${10000 - merged.length} 題`);
}

const output = {
  version: '7.0',
  created: new Date().toISOString().split('T')[0],
  description: `RAG 規則型訓練資料集 v7.0 — ${merged.length} 題完整覆蓋`,
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

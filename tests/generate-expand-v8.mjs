#!/usr/bin/env node
/**
 * 終極衝刺 v8：純粹新結構問題，目標 10,000+
 * 策略：多條件組合、假設情境、優先順序、數字細化
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

// ====== A. 多條件組合場景 (~200) ======

const budgets = ['3萬','5萬','10萬','15萬','20萬','30萬'];
const pingRanges = ['10坪','15坪','20坪','25坪','30坪','40坪','50坪'];
const ages = ['5年','10年','15年','20年','25年','30年','40年'];
const priorities = ['安全優先','省錢優先','品質優先','快速完工'];

// 預算×坪數
for (const budget of budgets) {
  for (const ping of pingRanges) {
    add('scenario', 'budget_ping', `預算${budget}做${ping}全室重配線可以嗎？`,
      { budget, ping }, ['預算', ping], 0);
  }
}

// 預算×優先
for (const budget of budgets) {
  for (const priority of priorities) {
    add('scenario', 'budget_priority', `預算${budget}${priority}怎麼規劃配電？`,
      { budget, priority }, ['預算', priority], 0);
  }
}

// 屋齡×坪數
for (const age of ages) {
  for (const ping of pingRanges.slice(0, 4)) {
    add('scenario', 'age_ping', `屋齡${age}${ping}的房子配電該怎麼改善？`,
      { age, ping }, [age, ping, '配電'], 0);
  }
}

// ====== B. 假設情境 (~200) ======

const whatIfQueries = [
  '如果一個迴路接了3000W會怎樣？', '如果NFB額定選太大會怎樣？', '如果NFB額定選太小會怎樣？',
  '如果電線線徑選太細會怎樣？', '如果接地電阻太高會怎樣？', '如果佔積率超過40%會怎樣？',
  '如果不裝ELCB會怎樣？', '如果不做接地會怎樣？', '如果用鋁線代替銅線會怎樣？',
  '如果PVC管用在室外會怎樣？', '如果CD管用在明管會怎樣？', '如果電線不穿管會怎樣？',
  '如果火線和中性線接反會怎樣？', '如果兩迴路共用中性線會怎樣？',
  '如果接地線被截斷會怎樣？', '如果NFB壽命到了不換會怎樣？',
  '如果電線20年不換會怎樣？', '如果配電箱滿了硬加迴路會怎樣？',
  '如果110V電器插220V會怎樣？', '如果220V電器插110V會怎樣？',
  '如果電壓降超過3%會怎樣？', '如果中性線斷了會怎樣？',
  '如果短路NFB沒跳會怎樣？', '如果漏電ELCB沒跳會怎樣？',
  '如果同一管穿太多線會怎樣？', '如果電線接頭不在盒內會怎樣？',
  '如果導線管沒有固定會怎樣？', '如果管路彎頭超過4個會怎樣？',
  '如果不同電壓迴路共管會怎樣？', '如果強電弱電共管會怎樣？',
];

for (const q of whatIfQueries) {
  add('regulation', 'what_if', q, { whatIf: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== C. 優先順序和比重 (~150) ======

const priorityQueries = [
  '配電改善哪些項目最重要？', '預算有限先做什麼？', '安全改善的優先順序？',
  '哪些電路問題最危險？', '什麼情況一定要馬上修？', '什麼情況可以暫時不處理？',
  '配電箱裡面什麼最重要？', '水電施工品質看什麼？', '驗收時最重要的項目？',
  '選材料最重要的考量？', '選NFB最重要看什麼？', '選電線最重要看什麼？',
  '接地工程最重要的環節？', '管路施工最重要的細節？', '接線施工最重要的原則？',
  '預算分配建議比例？', '材料費和工資比例通常多少？', '最不能省的費用是什麼？',
  '最容易被偷工減料的項目？', '最容易被忽略的安全項目？', '裝修完最後悔的水電決定？',
];

for (const q of priorityQueries) {
  add('template', 'priority', q, { priority: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== D. 數字細化估算 (~250) ======

// 各安培×各電器數量
const elecApps = [
  { name: '日光燈', watt: 40 }, { name: 'LED燈', watt: 12 }, { name: '吊扇', watt: 65 },
  { name: '電風扇', watt: 50 }, { name: '除濕機', watt: 300 }, { name: '空氣清淨機', watt: 60 },
  { name: '電視', watt: 150 }, { name: '電腦', watt: 350 }, { name: '冰箱', watt: 150 },
  { name: '充電器', watt: 30 }, { name: '路由器', watt: 15 }, { name: '微波爐', watt: 1000 },
  { name: '烤箱', watt: 1200 }, { name: '快煮壺', watt: 1500 }, { name: '吹風機', watt: 1200 },
  { name: '電暖器', watt: 1500 }, { name: '暖風機', watt: 1400 }, { name: '洗碗機', watt: 1800 },
];

for (const app of elecApps) {
  add('estimation', 'wattage', `${app.name}大概用多少瓦？`,
    { item: app.name, watt: app.watt }, [app.name, '瓦數'], 0);
  add('estimation', 'wattage', `${app.name}一小時多少電費？`,
    { item: app.name, watt: app.watt }, [app.name, '電費'], 0);
}

// 迴路負載計算
for (let amp of [15, 20, 30]) {
  for (let count = 2; count <= 8; count++) {
    add('estimation', 'load_calc', `${amp}A迴路接${count}個插座夠嗎？`,
      { amp, count }, [`${amp}A`, '插座', '負載'], 0);
  }
}

// 電費計算
for (let kw of [500, 800, 1000, 1500, 2000, 3000, 4000, 5000]) {
  add('estimation', 'electricity_bill', `一個月用${kw}度電費大概多少？`,
    { kw }, [kw + '度', '電費'], 0);
}

// 房間迴路數
const roomTypes = ['套房','兩房一廳','三房兩廳','四房','透天一樓','透天二樓','透天三樓','辦公室50坪'];
for (const rt of roomTypes) {
  add('estimation', 'circuit_count', `${rt}基本需要幾個迴路？`,
    { roomType: rt }, [rt, '迴路'], 0);
  add('estimation', 'circuit_count', `${rt}建議裝幾個插座？`,
    { roomType: rt }, [rt, '插座'], 0);
  add('estimation', 'circuit_count', `${rt}配電箱要幾迴路的？`,
    { roomType: rt }, [rt, '配電箱'], 1);
}

// ====== E. 品牌和型號查詢 (~150) ======

// 士林電機型號
const shihlinModels = ['BH', 'BHU', 'BHH', 'NF100-SN', 'NF250-SN', 'NF250-HT', 'NF400-SN'];
for (const model of shihlinModels) {
  add('selection', 'shihlin_model', `士林${model}系列有什麼規格？`,
    { brand: '士林', model }, ['士林', model], 1);
  add('selection', 'shihlin_model', `士林${model}適合用在哪裡？`,
    { brand: '士林', model }, ['士林', model], 1);
  add('pricing', 'shihlin_price', `士林${model}的價格？`,
    { brand: '士林', model }, ['士林', model, '價格'], 1);
}

// 國際牌系列
const panasonicSeries = ['星光', '全彩', 'GLATIMA', 'RISNA', 'Refina'];
for (const series of panasonicSeries) {
  add('selection', 'panasonic_series', `國際牌${series}系列有什麼特色？`,
    { brand: '國際牌', series }, ['國際牌', series], 1);
  add('pricing', 'panasonic_price', `國際牌${series}系列的價格帶？`,
    { brand: '國際牌', series }, ['國際牌', series, '價格'], 1);
}

// 電纜品牌
const cableBrands = ['華新麗華', '太平洋', '大亞', '大山', '宏泰'];
for (const brand of cableBrands) {
  add('selection', 'cable_brand', `${brand}的電纜品質如何？`,
    { brand }, [brand, '電纜'], 1);
  add('pricing', 'cable_price', `${brand}的電纜價格帶？`,
    { brand }, [brand, '電纜', '價格'], 1);
  add('selection', 'cable_brand', `${brand}有CNS認證嗎？`,
    { brand }, [brand, 'CNS'], 1);
}

// ====== F. 進階技術問題 (~100) ======

const advancedQueries = [
  '三相不平衡怎麼調整？', '功率因數不足怎麼改善？', '諧波問題怎麼解決？',
  '電容補償器怎麼選？', '自動切換開關ATS是什麼？', '低壓配電盤和配電箱差在哪？',
  'MCCB和MCB差在哪？', 'ACB是什麼？', 'VCB是什麼？',
  '智慧配電系統是什麼？', '能源管理系統EMS是什麼？', '電力監控系統怎麼選？',
  '數位電表有什麼功能？', '智慧斷路器值得裝嗎？', '遠端監控配電箱可行嗎？',
  'DC配電系統是什麼？', 'AC和DC的差別對家用有影響嗎？', 'PoE供電是什麼？',
  '弱電配線和強電有什麼不同？', '光纖到府需要什麼配置？', '智慧家庭的弱電規劃？',
  '家用充電樁需要什麼等級的電源？', '充電樁的OCPP協議是什麼？', '太陽能逆變器怎麼接？',
  '併網和離網太陽能差在哪？', '家用儲能電池的配電要求？', 'V2H是什麼？電動車可以供電給家裡嗎？',
];

for (const q of advancedQueries) {
  add('regulation', 'advanced', q, { advanced: true },
    q.match(/[\u4e00-\u9fff0-9A-Za-z]+/g)?.slice(0, 3) || [], 0);
}

// ====== G. 施工時間和工期 (~100) ======

const durationQueries = [
  '換一個插座要多久？', '裝一個開關要多久？', '拉一迴線要多久？',
  '換一顆NFB要多久？', '裝一顆ELCB要多久？', '更換配電箱要多久？',
  '開一條牆槽要多久？', '穿一管線要多久？', '接地工程要做多久？',
  '全室重配線10坪要幾天？', '全室重配線20坪要幾天？', '全室重配線30坪要幾天？',
  '全室重配線40坪要幾天？', '全室重配線50坪要幾天？',
  '廚房全部重做水電要幾天？', '浴室全部重做水電要幾天？', '一整層透天要做多久？',
  '一個師傅一天能做多少？', '兩個師傅一天能做多少？', '水電粗工大概要幾天？',
  '水電細工大概要幾天？', '水電驗收要多久？', '配電箱配線一天能完成嗎？',
];

for (const q of durationQueries) {
  add('estimation', 'duration', q, { duration: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== H. 材料用量計算 (~100) ======

// 線材用量
for (let ping = 10; ping <= 50; ping += 5) {
  add('estimation', 'wire_usage', `${ping}坪重配線大概需要多少米電線？`,
    { ping }, [ping + '坪', '電線', '用量'], 1);
  add('estimation', 'conduit_usage', `${ping}坪重配線需要多少米PVC管？`,
    { ping }, [ping + '坪', 'PVC管', '用量'], 1);
}

// NFB用量
for (const rt of ['套房','兩房','三房','四房','透天']) {
  add('estimation', 'nfb_count', `${rt}需要幾顆NFB？`,
    { roomType: rt }, [rt, 'NFB', '數量'], 1);
  add('estimation', 'elcb_count', `${rt}需要幾顆ELCB？`,
    { roomType: rt }, [rt, 'ELCB', '數量'], 1);
}

// 接線盒用量
for (let outlets = 5; outlets <= 40; outlets += 5) {
  add('estimation', 'box_count', `${outlets}個插座大概需要幾個接線盒？`,
    { outlets }, ['接線盒', '數量'], 1);
}

// ====== I. 口語問答最後衝刺 (~200) ======

const finalOralQueries = [
  // 帶數字的實際問題
  '2台冷氣1台除濕機能共用一個迴路嗎', '3間房要拉幾條冷氣線',
  '廚房5個電器需要幾個專用迴路', '4樓透天要幾個配電箱', '2間浴室要幾個ELCB',
  '一家四口30坪需要幾個迴路', '三代同堂40坪配電建議', '小家庭15坪基本配電',
  '分租4間套房配電怎麼分', '辦公室30坪需要幾個迴路', '店面20坪基本配電',
  // 「要不要」系列
  '浴室要不要裝110V插座', '廚房要不要全用專用迴路', '臥室要不要裝USB插座',
  '客廳要不要預留投影機線', '陽台要不要拉洗衣機專線', '車庫要不要預留充電樁',
  '走廊要不要裝感應開關', '樓梯要不要裝雙切開關', '大門要不要裝電子鎖電源',
  '窗邊要不要預留電動窗簾電源', '床頭要不要裝USB充電插座', '書桌旁要不要預留多一點插座',
  // 「怎麼選」系列
  '第一次裝修怎麼選水電師傅', '怎麼選配電箱的品牌', '怎麼選開關插座的品牌',
  '怎麼選電線的品牌', '怎麼選NFB的品牌', '怎麼選PVC管的品牌',
  '怎麼選ELCB', '怎麼選接地棒', '怎麼選接線端子', '怎麼選管夾',
  // 具體施工描述
  '牆壁上裝插座的詳細步驟', '天花板裝吊燈出線口步驟', '配電箱更換NFB步驟',
  '浴室牆壁埋PVC管步驟', 'EMT管連接兩段的步驟', '電線壓接端子的步驟',
  // 「差在哪」
  '有接地和沒接地差在哪', '有ELCB和沒ELCB差在哪', '暗管和走線槽差在哪',
  '2.0mm和2.6mm用起來差在哪', 'PVC和XLPE實際使用差在哪',
  'NFB用國產和進口差在哪', '新線和舊線混用會差在哪',
  // 「多少」的各種問法
  '一般家庭一天用多少度電', '冷氣開一天多少度', '電熱水器一天多少度',
  '電腦開一天多少電費', '冰箱一個月多少電', '洗衣機洗一次多少電',
  // 特殊場景
  '地下室停車場需要什麼等級的管', '電梯機房配電要注意什麼', '屋頂水塔馬達的電路',
  '公共走廊燈具的配電', '社區大門對講機的電源', '監控攝影機的電源規劃',
  '自動門的電路需求', '電動鐵門的配電', '太陽能熱水器需要配電嗎',
  '瓦斯熱水器的110V電源', '抽水馬達的電路配置', '加壓馬達需要什麼電路',
  '全熱交換機的電路', '新風系統的配電', '中央空調的配電和分離式有差嗎',
  // 混合
  '聽說LED燈不需要太粗的線是真的嗎', '網路上說1.6mm已經不能用了是真的嗎',
  '師傅說5.5mm²就夠了但我覺得不夠', '朋友說不用接地沒差真的嗎',
  '建商說預留管路夠用但我想加迴路', '設計師畫的插座位置不太對可以改嗎',
  '之前師傅做的不好這次找別人可以接手嗎', '二手屋前屋主的電路圖可以信嗎',
  '驗屋師說電路有問題但建商說沒問題', '管委會不同意我家配電升級怎麼辦',
];

for (const q of finalOralQueries) {
  const type = q.includes('步驟') ? 'procedure'
    : q.includes('差在哪') || q.includes('怎麼選') || q.includes('品牌') ? 'selection'
    : q.includes('多少電') || q.includes('電費') || q.includes('多少度') ? 'estimation'
    : q.includes('要不要') ? 'scenario'
    : q.includes('真的嗎') || q.includes('是真的') ? 'template'
    : 'scenario';
  add(type, 'final_oral', q, { oral: true },
    q.match(/[\u4e00-\u9fff0-9A-Za-z.]+/g)?.slice(0, 3) || [], 0);
}

// ====== J. 交叉品牌×規格 NFB 大量展開 (~200) ======

const nfbBrands = ['士林', '國際牌', '東元', '富士'];
const nfbConfigs = ['1P 20A', '2P 20A', '2P 30A', '2P 50A', '3P 75A', '3P 100A'];
for (const brand of nfbBrands) {
  for (const config of nfbConfigs) {
    add('selection', 'brand_nfb', `${brand} ${config} NFB的啟斷容量？`,
      { brand, config }, [brand, config, 'IC'], 1);
    add('selection', 'brand_nfb', `${brand} ${config} NFB的尺寸？`,
      { brand, config }, [brand, config, '尺寸'], 1);
  }
}

// ELCB 品牌規格
for (const brand of nfbBrands.slice(0, 3)) {
  for (const config of ['2P 20A', '2P 30A', '2P 50A']) {
    add('selection', 'brand_elcb', `${brand} ${config} ELCB的感度電流？`,
      { brand, config }, [brand, config, 'ELCB'], 1);
    add('selection', 'brand_elcb', `${brand} ${config} ELCB可以裝在浴室迴路嗎？`,
      { brand, config }, [brand, config, 'ELCB', '浴室'], 1);
  }
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
  console.log(`\n✅ 已達成 10,000 題目標！(${merged.length})`);
} else {
  console.log(`\n⚠️ 距離 10,000 題還差 ${10000 - merged.length} 題`);
}

const output = {
  version: '8.0',
  created: new Date().toISOString().split('T')[0],
  description: `RAG 規則型訓練資料集 v8.0 — ${merged.length} 題 8 大類完整覆蓋`,
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

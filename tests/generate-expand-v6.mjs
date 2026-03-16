#!/usr/bin/env node
/**
 * 擴充 v6：衝刺到 10,000 題
 * 更細粒度的組合 + 完全不同的問法 + 情境對話
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(__dirname, 'rag-training-rules.json'), 'utf-8'));

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
const allNew = [];
function add(type, subtype, query, rule, keywords, matGte = 0) {
  if (!seen.has(query)) {
    seen.add(query);
    allNew.push({ id: nextId++, type, subtype, query, rule, keywords, expect_materials_gte: matGte });
    return true;
  }
  return false;
}

// === 資料 ===
const rooms = ['廚房','浴室','臥室','客廳','書房','陽台','餐廳','玄關','走廊','儲藏室','車庫','頂樓'];
const appliances = ['冷氣','電熱水器','電磁爐','烤箱','微波爐','洗碗機','乾衣機','洗衣機','冰箱','除濕機','暖風機','充電樁','吹風機','電暖器','快煮壺','飲水機','烘碗機','氣炸鍋','咖啡機','吸塵器'];
const wireSpecs = ['1.6mm','2.0mm','2.6mm','3.5mm²','5.5mm²','8mm²','14mm²','22mm²','30mm²','38mm²','50mm²','60mm²','80mm²','100mm²'];
const wireTypes = ['PVC IV','XLPE','耐燃線'];
const conduits = ['PVC管','EMT管','CD管'];
const conduitSizes = ['16mm','22mm','28mm','36mm','42mm','52mm'];
const nfbs = ['1P 15A','1P 20A','1P 30A','2P 15A','2P 20A','2P 30A','2P 50A','2P 75A','2P 100A','3P 100A','3P 150A','3P 225A'];
const brands = ['士林','國際牌','華新','太平洋','大亞','大山','南亞','春風','中一電工','朝日'];
const actions = ['增設','更換','移位','拆除','維修','檢查','升級','加裝'];

// ====== A. 場景：行動×房間×物件 (~500) ======
for (const room of rooms) {
  for (const action of actions) {
    for (const obj of ['插座','開關','燈','冷氣迴路','配電箱']) {
      add('scenario', 'action', `${room}${action}${obj}要怎麼做？`,
        { room, action, object: obj }, [room, action, obj], 1);
    }
  }
}

// ====== B. 場景：裝修階段問題 (~200) ======
const stages = ['拆除','水電粗工','泥作','木作','油漆','水電細工','清潔','驗收'];
const stageQueries = [
  (s) => `${s}階段水電要做什麼？`,
  (s) => `${s}階段水電師傅需要到場嗎？`,
  (s) => `${s}和水電的先後順序？`,
];
for (const stage of stages) {
  for (const form of stageQueries) {
    add('scenario', 'stage', form(stage), { stage }, [stage, '水電'], 0);
  }
}

// 裝修衝突問題
const conflictQueries = [
  '水電和冷氣管路衝突怎麼辦？', '電線管路經過樑怎麼處理？',
  '配電箱位置和裝潢衝突怎麼辦？', '插座位置和家具衝突怎麼辦？',
  '管線走天花板還是地板？各優缺點？', '暗管還是明管？怎麼選？',
  '木作封板後還能改電嗎？', '磁磚貼好了還能加插座嗎？',
  '天花板封了還能走線嗎？', '地板鋪好了還能埋管嗎？',
  '水電完工後發現插座少了怎麼辦？', '設計圖和現場不符怎麼處理？',
  '結構牆不能打洞怎麼配管？', '管道間太擠走不了管怎麼辦？',
  '消防管路和電力管路交叉怎麼處理？', '排水管和電力管重疊怎麼辦？',
];
for (const q of conflictQueries) {
  add('scenario', 'conflict', q, { conflict: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== C. 選型：更多規格搭配 (~400) ======

// 電線×管徑匹配查詢
for (const w of wireSpecs.slice(0, 8)) {
  for (const c of conduits) {
    add('selection', 'wire_conduit', `${w}的線要用多大的${c}？`,
      { wire: w, conduit: c }, [w, c], 1);
  }
}

// NFB×電線搭配
for (const nfb of nfbs.slice(0, 8)) {
  add('selection', 'nfb_wire', `${nfb}的NFB要搭配多粗的線？`,
    { nfb }, [nfb, '電線'], 1);
  add('selection', 'nfb_wire', `${nfb}的NFB安全載流量是多少？`,
    { nfb }, [nfb, '安全'], 1);
}

// 電器→所需線徑和NFB
for (const appl of appliances) {
  add('selection', 'appliance_spec', `${appl}要用多粗的線？`,
    { appliance: appl }, [appl, '線徑'], 1);
  add('selection', 'appliance_spec', `${appl}要配多大的NFB？`,
    { appliance: appl }, [appl, 'NFB'], 1);
  add('selection', 'appliance_spec', `${appl}要用什麼管？`,
    { appliance: appl }, [appl, '管'], 1);
}

// 開關面板選型
const switchTypes = ['單切','雙切','三路','四路','調光','定時','感應','觸控','智慧'];
for (const st of switchTypes) {
  add('selection', 'switch_type', `${st}開關適合用在哪裡？`,
    { switchType: st }, [st, '開關'], 1);
  add('selection', 'switch_type', `${st}開關的接線方式？`,
    { switchType: st }, [st, '接線'], 1);
}

// 插座類型選型
const outletTypes = ['單插座','雙插座','三插座','USB插座','Type-C插座','防水插座','地板插座','冷氣插座','220V插座','專用插座'];
for (const ot of outletTypes) {
  add('selection', 'outlet_type', `什麼場合要用${ot}？`,
    { outletType: ot }, [ot], 1);
  add('selection', 'outlet_type', `${ot}的價格？`,
    { outletType: ot }, [ot, '價格'], 1);
}

// ====== D. 估價：更具體的施工估算 (~400) ======

// 各房間整套配電費用
for (const room of rooms) {
  add('estimation', 'room_budget', `${room}全部重做水電多少錢？`,
    { room }, [room, '費用'], 0);
  add('estimation', 'room_budget', `${room}配電改善大概多少錢？`,
    { room }, [room, '預算'], 0);
  add('estimation', 'room_budget', `${room}加裝插座一個多少？`,
    { room }, [room, '插座', '費用'], 1);
}

// 線材長度×價格
for (const w of ['1.6mm','2.0mm','2.6mm','5.5mm²','8mm²','14mm²','22mm²']) {
  for (const wt of wireTypes) {
    for (const len of [10, 50, 100]) {
      add('estimation', 'wire_length_price', `${wt} ${w} ${len}米多少錢？`,
        { wire: wt, spec: w, length: len }, [wt, w, '費用'], 1);
    }
  }
}

// 管材長度×價格
for (const c of conduits) {
  for (const s of conduitSizes.slice(0, 4)) {
    for (const len of [10, 50, 100]) {
      add('estimation', 'conduit_price', `${s}${c} ${len}米多少錢？`,
        { conduit: c, size: s, length: len }, [c, s, '費用'], 1);
    }
  }
}

// 點位計價
for (let points = 5; points <= 100; points += 5) {
  add('estimation', 'point_price', `${points}個點位大概多少錢？`,
    { points, min: points * 800, max: points * 1800 }, ['點位', '費用'], 0);
}

// ====== E. 法規：更多細節問題 (~500) ======

// 電器安規問題
for (const appl of appliances.slice(0, 15)) {
  add('regulation', 'appliance_safety', `${appl}的用電安全注意事項？`,
    { appliance: appl }, [appl, '安全'], 0);
  add('regulation', 'appliance_safety', `${appl}需要接地嗎？`,
    { appliance: appl }, [appl, '接地'], 0);
}

// 各場所漏電斷路器要求
for (const room of rooms) {
  add('regulation', 'elcb_required', `${room}的漏電斷路器怎麼選？`,
    { room }, [room, 'ELCB'], 1);
}

// 各種安裝方式的法規
const installMethods = ['明管','暗管','電纜架','線槽','吊架','地板管路','天花板走線'];
for (const method of installMethods) {
  add('regulation', 'install_method', `${method}有什麼施工規範？`,
    { method }, [method, '規範'], 0);
  add('regulation', 'install_method', `${method}可以用在哪些場所？`,
    { method }, [method, '場所'], 0);
  add('regulation', 'install_method', `${method}的優缺點？`,
    { method }, [method], 0);
}

// 負載計算法規
const loadCalcQueries = [
  '住宅用電負載怎麼計算？', '商業空間用電負載怎麼算？', '工業用電負載怎麼計算？',
  '契約容量怎麼決定？', '需量反應是什麼？', '功率因數要求是多少？',
  '電壓降計算公式是什麼？', '電壓降容許值是多少？', '短路電流怎麼計算？',
  '保護協調是什麼意思？', 'NFB啟斷容量怎麼選？', '幹線大小怎麼決定？',
  '主開關容量怎麼計算？', '需量因數怎麼用？', '同時使用率怎麼估？',
  '照明密度怎麼算？', '插座負載密度怎麼算？', '安全係數要留多少？',
  '台電申請容量怎麼算？', '三相不平衡度的規定？', '接地系統的種類？',
  'TT接地和TN接地差在哪？', '系統接地和設備接地差在哪？',
];
for (const q of loadCalcQueries) {
  add('regulation', 'load_calc', q, { technical: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// 各年代房屋的配電特點
const eras = ['民國60年代','民國70年代','民國80年代','民國90年代','100年以後'];
for (const era of eras) {
  add('regulation', 'era', `${era}的房子電路有什麼特點？`,
    { era }, [era, '電路'], 0);
  add('regulation', 'era', `${era}蓋的房子配電安全嗎？`,
    { era }, [era, '安全'], 0);
  add('regulation', 'era', `${era}的房子需要重新配電嗎？`,
    { era }, [era, '重配線'], 0);
}

// ====== F. 施工：更多工法問題 (~300) ======

// 管路施工技巧
const pipeTechniques = [
  'PVC管怎麼用膠黏？', 'PVC管怎麼套接？', 'EMT管怎麼用壓接方式？',
  'EMT管怎麼用螺紋接頭？', 'CD管怎麼接？', 'CD管轉彎用什麼配件？',
  '管路出牆面怎麼收尾？', '管路進入配電箱怎麼接？', '管路經過防火區怎麼處理？',
  '管路跨樓層要做什麼防火處理？', '管路穿越伸縮縫怎麼做？', '管路支撐間距多少？',
  'PVC管支撐間距多少？', 'EMT管支撐間距多少？', '管路彎頭角度有什麼限制？',
  '管路在混凝土裡面怎麼保護？', '管路埋在牆壁裡面要多深？', '管路轉角怎麼做才好穿線？',
];
for (const q of pipeTechniques) {
  add('procedure', 'pipe_technique', q, { technique: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 1);
}

// 接線技巧
const wiringTechniques = [
  '電線怎麼剝皮？不同粗細的剝法？', '銅線壓接要用什麼端子？',
  '鎖接端子和壓接端子哪個好？', '電線怎麼做分歧接頭？',
  '電線扭接牢不牢？要加焊錫嗎？', '接線盒裡面怎麼整理線路？',
  '配電箱接線的順序？', '火線進NFB要接上端還是下端？',
  'ELCB接線要注意什麼？', '接地線要怎麼接？',
  '多芯線怎麼壓接？', '線耳怎麼選？', '端子台怎麼選？',
  '軟線和硬線的接法不同嗎？', '不同線徑的線怎麼接在一起？',
  '絞接要繞幾圈？', '壓接鉗要選幾號？', '熱縮管怎麼用？',
];
for (const q of wiringTechniques) {
  add('procedure', 'wiring', q, { technique: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// 各品牌施工差異
for (const brand of brands.slice(0, 6)) {
  add('procedure', 'brand_install', `${brand}的NFB怎麼裝？`,
    { brand }, [brand, 'NFB', '安裝'], 1);
  add('procedure', 'brand_install', `${brand}的開關面板怎麼拆？`,
    { brand }, [brand, '面板', '拆'], 1);
}

// ====== G. 價格：市場和趨勢 (~200) ======

// 各品牌定價策略
for (const brand of brands.slice(0, 6)) {
  add('pricing', 'brand_pricing', `${brand}的價格屬於哪個等級？`,
    { brand }, [brand, '價格'], 0);
  add('pricing', 'brand_pricing', `${brand}比其他牌子貴多少？`,
    { brand }, [brand, '比較'], 0);
}

// 報價學問
const quotationQueries = [
  '水電報價通常怎麼報？', '點工和包工差在哪？', '連工帶料和工料分離哪個好？',
  '報價有效期限一般多久？', '追加工程佔比通常多少？', '水電報價含稅嗎？',
  '水電報價要含保固嗎？', '保固期一般多久？', '保固範圍包含什麼？',
  '不同師傅報價差很多正常嗎？', '報價差一倍是什麼原因？', '最低價的師傅能選嗎？',
  '怎麼判斷報價是否合理？', '報價看不懂的項目可以問嗎？', '報價單應該包含哪些項目？',
  '工程未完成可以只付一部分嗎？', '分期付款怎麼安排？', '定金通常付多少？',
  '尾款什麼時候付？', '驗收不過可以扣尾款嗎？',
];
for (const q of quotationQueries) {
  add('pricing', 'quotation', q, { quotation: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// 季節和時機
const timingQueries = [
  '什麼季節做水電最便宜？', '過年前做水電會比較貴嗎？', '旺季和淡季工資差多少？',
  '農曆七月可以做水電嗎？', '梅雨季適合做水電嗎？', '颱風季做水電有影響嗎？',
  '年底做水電師傅難找嗎？', '暑假是水電旺季嗎？', '什麼時候材料最便宜？',
  '電纜什麼時候會調價？', '每年幾月銅價最低？', '建材展買材料真的便宜嗎？',
];
for (const q of timingQueries) {
  add('pricing', 'timing', q, { timing: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== H. 故障排除更多組合 (~200) ======

// 房間×故障
const faults = ['跳電','沒電','電燈閃爍','插座發燙','有焦味','漏電'];
for (const room of rooms.slice(0, 8)) {
  for (const fault of faults) {
    add('troubleshoot', 'room_fault', `${room}${fault}怎麼辦？`,
      { room, fault }, [room, fault], 0);
  }
}

// 天氣×故障
const weatherFaults = [
  '下雨天跳電是漏電嗎？', '雷雨過後電器壞了怎麼辦？', '颱風過後插座沒電正常嗎？',
  '冬天暖氣開了就跳電？', '天氣熱NFB一直跳？', '潮濕天氣插座冒火花？',
  '結露會導致漏電嗎？', '地下室返潮電路怎麼辦？', '海邊住家電線容易壞嗎？',
  '高樓層風大影響配電嗎？', '地震後要檢查哪些電路？', '水災後多久可以恢復供電？',
];
for (const q of weatherFaults) {
  add('troubleshoot', 'weather', q, { weather: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// 舊屋常見問題
const oldHouseQueries = [
  '30年老屋電線抽出來是黑的正常嗎？', '老屋配電箱裡面沒有ELCB正常嗎？',
  '老屋只有4迴路夠用嗎？', '老屋的電線是實心線還是絞線？',
  '老屋管路都是鐵管可以繼續用嗎？', '老屋電線有2.0mm可以接冷氣嗎？',
  '老屋接地線只有一條夠嗎？', '老屋NFB都是無熔絲開關嗎？',
  '老屋配電箱是金屬的好嗎？', '老屋換線一定要敲牆嗎？',
  '老屋管路穿不過去要怎麼辦？', '老屋沒有管路的電線怎麼換？',
  '老屋升級配電不想大動工怎麼做？', '老屋只想加冷氣迴路可以嗎？',
  '老屋電纜入戶線要不要換？', '老屋電表可以升級安培數嗎？',
];
for (const q of oldHouseQueries) {
  add('troubleshoot', 'old_house', q, { oldHouse: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== I. 模板補充 (~200) ======

// 給屋主的建議模板
const adviceTemplates = [
  '新手屋主裝修水電注意事項？', '租屋改電路可以嗎？', '二手屋買來第一件事水電檢查？',
  '毛胚屋水電規劃建議？', '預售屋客變水電要注意什麼？', '公寓大樓水電共用問題？',
  '社區大樓水電維修權責？', '頂樓漏水和水電有關嗎？',
  '怎麼準備水電裝修的預算？', '水電佔裝修預算多少比例？',
  '水電做完才做裝潢對嗎？', '水電和設計師的溝通重點？',
  '找水電前要先想好什麼？', '水電施工要多久完成？',
  '施工中發現問題怎麼處理？', '工程追加費用合理嗎？',
];
for (const q of adviceTemplates) {
  add('template', 'advice', q, { advice: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// 專業術語解釋
const termQueries = [
  '什麼是迴路？', '什麼是幹線？', '什麼是分路？', '什麼是接地？',
  '什麼是漏電？', '什麼是短路？', '什麼是過載？', '什麼是跳脫？',
  '什麼是佔積率？', '什麼是電壓降？', '什麼是安全電流？', '什麼是額定電流？',
  '什麼是啟斷容量？', '什麼是感度電流？', '什麼是接地電阻？', '什麼是絕緣電阻？',
  '什麼是功率因數？', '什麼是需量因數？', '什麼是負載率？', '什麼是過流保護？',
  'AT是什麼？', 'AF是什麼？', 'IC是什麼意思？', 'kA是什麼單位？',
  'VA和W有什麼不同？', 'kW和kVA差在哪？', 'AWG和mm²怎麼換算？',
  '單芯線和多芯線差在哪？', '絞線和實心線差在哪？', '電纜和電線差在哪？',
  '什麼是N相？', '什麼是R相S相T相？', '什麼是三相四線式？',
  '什麼是接地故障？', '什麼是電弧故障？', '什麼是AFCI？',
];
for (const q of termQueries) {
  add('template', 'terminology', q, { term: true },
    q.match(/[\u4e00-\u9fff0-9A-Za-z]+/g)?.slice(0, 3) || [], 0);
}

// 情境對話模板（模擬真實用戶問答）
const dialogTemplates = [
  '師傅說要換整個配電箱是不是被坑？', '裝潢公司報的水電費合理嗎？',
  '師傅說管路太舊要全換是真的嗎？', '師傅說NFB跳是線路問題不是電器問題？',
  '隔壁鄰居裝修為什麼我家也跳電？', '房東說電路沒問題但一直跳電？',
  '新買的冷氣裝了就跳電是冷氣壞了嗎？', '插座面板歪了是水電施工品質問題嗎？',
  '朋友說接地不重要是真的嗎？', '網路上說延長線很危險是真的嗎？',
  '廣告說某品牌電線最安全是真的嗎？', '師傅說一定要用某品牌是不是抽佣？',
  '裝潢快好了才發現插座不夠怎麼辦？', '交屋後發現水電跟約定的不一樣？',
  '保固期過了一個月就壞了還能找師傅嗎？', '水電完工後發現牆壁裡面有水聲？',
];
for (const q of dialogTemplates) {
  add('template', 'dialog', q, { dialog: true },
    q.match(/[\u4e00-\u9fff]+/g)?.slice(0, 3) || [], 0);
}

// ====== J. 更多口語變體和錯別字容錯 ======
const oralExpansion = [
  // 略語
  '冷氣線要多粗', '熱水器線要多粗', '烤箱線要多粗', '充電樁線要多粗',
  '插座怎麼接', '開關怎麼接', '三路怎麼接', 'ELCB怎麼接',
  '配電箱怎麼配', '迴路怎麼分', '接地怎麼做', '穿線怎麼穿',
  // 生活化
  '裝修水電第一步做什麼', '拉電到陽台要多少錢', '車庫加個插座行不行',
  '門口裝個感應燈要多少', '床頭加開關要拉線嗎', '天花板走線要拆嗎',
  '配電箱太吵怎麼處理', '電表一直轉很快正常嗎', '被電到是什麼感覺',
  '電線皮破了用膠帶纏可以嗎', 'DIY配電合法嗎', '無照水電師傅能做嗎',
  // 比較
  '華新和太平洋哪個好', '大亞和大山哪個便宜', '士林和國際牌NFB比較',
  '南亞PVC和春風PVC差多少', '國產線和日本線差在哪', '台製和陸製差在哪',
  // 搜尋式
  '2.0mm電線價格', '5.5平方電線價格', '22mm PVC管價格',
  '配電箱12迴路價格', 'NFB 2P 30A價格', 'ELCB 2P 20A價格',
  '國際牌插座價格', '士林開關價格', 'EMT管22mm價格',
  // 分類搜尋
  '水電材料有哪些', '配電箱裡面有什麼', '接地需要什麼材料',
  '拉一迴路需要什麼', '一個插座需要什麼材料', '冷氣迴路需要什麼',
];
for (const q of oralExpansion) {
  const type = q.includes('價') || q.includes('多少') || q.includes('錢') ? 'estimation'
    : q.includes('怎麼接') || q.includes('怎麼做') || q.includes('怎麼穿') || q.includes('怎麼配') ? 'procedure'
    : q.includes('哪個好') || q.includes('比較') || q.includes('差') ? 'selection'
    : q.includes('需要什麼') || q.includes('有哪些') ? 'selection'
    : 'scenario';
  add(type, 'oral_v2', q, { oral: true },
    q.match(/[\u4e00-\u9fff0-9A-Za-z.]+/g)?.slice(0, 3) || [], 0);
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

const output = {
  version: '6.0',
  created: new Date().toISOString().split('T')[0],
  description: 'RAG 規則型訓練資料集 v6.0 — 10,000 題完整覆蓋',
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

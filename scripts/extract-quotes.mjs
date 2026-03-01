#!/usr/bin/env node
/**
 * 從 Obsidian vault 擷取語錄 → public/data/quotes.json
 *
 * 來源：
 *   1. Daily Notes/語錄歷史/YYYY-MM/YYYY-MM-DD.md（三餐格式）
 *   2. Knowledge/Other/Books/*.md（書籍金句 — ### 「...」 格式）
 *   3. Knowledge/斡旋/*讀書筆記.md（談判類 — blockquote 格式）
 *
 * 用法：node scripts/extract-quotes.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, basename } from 'path'

const VAULT_PATH = '/Volumes/SupabaseData/ObsidianPKM'
const QUOTE_HISTORY_DIR = join(VAULT_PATH, 'Daily Notes', '語錄歷史')
const BOOKS_DIR = join(VAULT_PATH, 'Knowledge', 'Other', 'Books')
const NEGOTIATION_DIR = join(VAULT_PATH, 'Knowledge', '斡旋')
const OUTPUT_FILE = join(import.meta.dirname, '..', 'public', 'data', 'quotes.json')

const MEAL_MAP = { '晨讀': 'morning', '午學': 'noon', '夕省': 'evening' }
const MEALS = ['晨讀', '午學', '夕省']

// ── 六大書籍分類 ──
const CATEGORIES = {
  negotiation: '談判策略',
  communication: '溝通與調解',
  persuasion: '說服與行為',
  pricing: '定價與銷售',
  business: '創業與經營',
  wisdom: '人生智慧'
}

// ── 完整書籍清單（43 本）──
const BOOK_CATALOG = {
  // ═══ 談判策略（9 本）═══
  'getting-to-yes': {
    title: 'Getting to Yes',
    titleZh: '哈佛談判力',
    author: 'Roger Fisher & William Ury',
    description: '不要在立場上討價還價——用原則式談判（principled negotiation）：對事強硬、對人溫柔，基於利益而非立場來解決分歧。哈佛談判專案的奠基之作。',
    files: ['Getting to Yes 讀書筆記.md'],
    dir: 'negotiation',
    category: 'negotiation',
    lang: 'en'
  },
  'never-split': {
    title: 'Never Split the Difference',
    titleZh: 'FBI 談判聖經',
    author: 'Chris Voss',
    description: '前 FBI 首席國際綁架談判專家教你：談判不是理性的問題解決，而是情緒驅動的人際互動——透過戰術同理心，在不妥協的情況下達成比折中更好的結果。',
    files: ['Never Split the Difference 讀書筆記.md'],
    dir: 'negotiation',
    category: 'negotiation',
    lang: 'en'
  },
  'art-of-strategy': {
    title: 'The Art of Strategy',
    titleZh: '策略的藝術',
    author: 'Avinash K. Dixit & Barry J. Nalebuff',
    description: '賽局理論實戰指南——從囚徒困境到承諾裝置，教你在商業、政治和日常生活中做出最優策略選擇。',
    files: ['Art of Strategy 讀書筆記.md'],
    dir: 'negotiation',
    category: 'negotiation',
    lang: 'en'
  },
  'strategy-of-conflict': {
    title: 'The Strategy of Conflict',
    titleZh: '衝突的策略',
    author: 'Thomas C. Schelling',
    description: '諾貝爾經濟學獎得主開創的衝突理論——焦點原則、可信承諾、威脅的藝術，理解敵我之間的策略互動。',
    files: ['The Strategy of Conflict 讀書筆記.md'],
    dir: 'negotiation',
    category: 'negotiation',
    lang: 'en'
  },
  'getting-past-no': {
    title: 'Getting Past No',
    titleZh: '突破拒絕',
    author: 'William Ury',
    description: 'Getting to Yes 作者的續作——五步突破談判僵局：走到陽台、站到他們那邊、重新框架、搭建金橋、用力量教育。',
    files: ['Getting Past No 讀書筆記.md'],
    dir: 'negotiation',
    category: 'negotiation',
    lang: 'en'
  },
  '3d-negotiation': {
    title: '3-D Negotiation',
    titleZh: '3D 談判學',
    author: 'David Lax & James Sebenius',
    description: '超越桌面戰術的三維談判框架——在交易設計和局勢塑造層面做功夫，讓桌上談判在開始之前就已經贏了一半。',
    files: ['3-D Negotiation 讀書筆記.md'],
    dir: 'negotiation',
    category: 'negotiation',
    lang: 'en'
  },
  'mind-heart': {
    title: 'The Mind and Heart of the Negotiator',
    titleZh: '談判者的理性與感性',
    author: 'Leigh L. Thompson',
    description: '結合心理學與經濟學的談判教科書——認知偏誤、情緒影響、多方談判，學術嚴謹與實務案例兼備。',
    files: ['Mind and Heart of the Negotiator 讀書筆記.md'],
    dir: 'negotiation',
    category: 'negotiation',
    lang: 'en'
  },
  'bargaining-devil': {
    title: 'Bargaining with the Devil',
    titleZh: '與魔鬼談判',
    author: 'Robert Mnookin',
    description: '什麼時候該跟最討厭的對手談判？哈佛談判研究中心主任用八個真實案例，探討談判的倫理邊界與理性分析框架。',
    files: ['Bargaining with the Devil 讀書筆記.md'],
    dir: 'negotiation',
    category: 'negotiation',
    lang: 'en'
  },
  'start-with-no': {
    title: 'Start with No',
    titleZh: '從「不」開始',
    author: 'Jim Camp',
    description: '「Yes」是目標，「No」才是起點。學會說不、讓對方說不，從掌控感出發建構真正的合作。',
    files: ['Start with No 讀書筆記.md'],
    dir: 'negotiation',
    category: 'negotiation',
    lang: 'en'
  },

  // ═══ 溝通與調解（8 本）═══
  'difficult-conversations': {
    title: 'Difficult Conversations',
    titleZh: '再也不怕開口',
    author: 'Douglas Stone, Bruce Patton & Sheila Heen',
    description: '每一場困難對話都包含三個平行對話——「發生了什麼」、「感受」、「身份認同」。理解這三層結構並從「第三個故事」切入，就能把衝突轉化為學習。',
    files: ['Difficult Conversations 讀書筆記.md'],
    dir: 'negotiation',
    category: 'communication',
    lang: 'en'
  },
  'crucial-conversations': {
    title: 'Crucial Conversations',
    titleZh: '關鍵對話',
    author: 'Kerry Patterson et al.',
    description: '當對話變得關鍵（利害重大、意見不同、情緒高漲），如何保持安全感並達成共識？STATE 模型五步驟讓你在高壓對話中保持冷靜。',
    files: ['Crucial Conversations 讀書筆記.md'],
    dir: 'negotiation',
    category: 'communication',
    lang: 'en'
  },
  'crucial-accountability': {
    title: 'Crucial Accountability',
    titleZh: '關鍵問責',
    author: 'Kerry Patterson et al.',
    description: '如何在不傷害關係的前提下，讓別人履行承諾？從「說了卻沒做」到「做了卻做錯」，系統性地處理違背期望的情境。',
    files: ['Crucial Accountability 讀書筆記.md'],
    dir: 'negotiation',
    category: 'communication',
    lang: 'en'
  },
  'beyond-reason': {
    title: 'Beyond Reason',
    titleZh: '超越理性',
    author: 'Roger Fisher & Daniel Shapiro',
    description: 'Getting to Yes 作者探索談判中的情緒面——五大核心關切（欣賞、歸屬、自主、地位、角色）決定了合作還是對抗。',
    files: ['Beyond Reason 讀書筆記.md'],
    dir: 'negotiation',
    category: 'communication',
    lang: 'en'
  },
  'nonviolent-communication': {
    title: 'Nonviolent Communication',
    titleZh: '非暴力溝通',
    author: 'Marshall B. Rosenberg',
    description: '四步溝通法：觀察→感受→需要→請求。不帶評判地表達自己，同理心地聆聽他人——讓每一次對話都成為連結而非戰爭。',
    files: ['Nonviolent Communication 讀書筆記.md'],
    dir: 'negotiation',
    category: 'communication',
    lang: 'en'
  },
  'conversational-intelligence': {
    title: 'Conversational Intelligence',
    titleZh: '對話智慧',
    author: 'Judith E. Glaser',
    description: '對話不只是交換訊息，是神經化學反應。催產素信任迴路 vs 皮質醇恐懼迴路——你的每一句話都在改變對方的大腦化學。',
    files: ['Conversational Intelligence 讀書筆記.md'],
    dir: 'negotiation',
    category: 'communication',
    lang: 'en'
  },
  'mediation-family': {
    title: 'Mediation in Family Disputes',
    titleZh: '家庭爭議調解',
    author: 'John M. Haynes & Gretchen L. Haynes',
    description: '調解不是仲裁，調解人不做決定——引導雙方找到自己能接受的方案。從家庭場景出發，適用於所有多方利益衝突。',
    files: ['Mediation in Family Disputes 讀書筆記.md'],
    dir: 'negotiation',
    category: 'communication',
    lang: 'en'
  },
  'thanks-feedback': {
    title: 'Thanks for the Feedback',
    titleZh: '回饋的力量',
    author: 'Douglas Stone & Sheila Heen',
    description: '問題不在給回饋，在收回饋。三種回饋觸發器（真相/關係/身份）讓我們本能抗拒——學會拆解觸發器，才能把回饋變成燃料。',
    files: ['Thanks for the Feedback 讀書筆記.md'],
    dir: 'negotiation',
    category: 'communication',
    lang: 'en'
  },

  // ═══ 說服與行為（7 本）═══
  'influence': {
    title: 'Influence: The Psychology of Persuasion',
    titleZh: '影響力',
    author: 'Robert B. Cialdini',
    description: '六大說服原則——互惠、承諾與一致、社會認同、喜好、權威、稀缺。人類靠心理捷思做決策，理解原則就同時獲得攻擊武器與防禦盾牌。',
    files: ['Influence 讀書筆記.md'],
    dir: 'negotiation',
    category: 'persuasion',
    lang: 'en'
  },
  'pre-suasion': {
    title: 'Pre-Suasion',
    titleZh: '鋪梗力',
    author: 'Robert B. Cialdini',
    description: '說服之前的那一刻才是勝負關鍵。先播種注意力和框架，讓受眾在聽到訊息之前就已經傾向同意——影響力的前傳。',
    files: ['Pre-Suasion 讀書筆記.md'],
    dir: 'negotiation',
    category: 'persuasion',
    lang: 'en'
  },
  'made-to-stick': {
    title: 'Made to Stick',
    titleZh: '黏力法則',
    author: 'Chip Heath & Dan Heath',
    description: '為什麼有些想法能深入人心？SUCCESs 六原則——簡單、出乎意料、具體、可信、情感、故事——讓訊息「黏」住聽眾。',
    files: ['Made to Stick 讀書筆記.md'],
    dir: 'negotiation',
    category: 'persuasion',
    lang: 'en'
  },
  'thinking-fast-slow': {
    title: 'Thinking, Fast and Slow',
    titleZh: '快思慢想',
    author: 'Daniel Kahneman',
    description: '諾貝爾獎得主揭露人類思維的兩套系統——快速直覺的 System 1 和緩慢理性的 System 2。150+ 認知偏誤的百科全書，理解決策的底層機制。',
    files: ['Thinking, Fast and Slow 讀書筆記.md'],
    dir: 'negotiation',
    category: 'persuasion',
    lang: 'en'
  },
  'predictably-irrational': {
    title: 'Predictably Irrational',
    titleZh: '誰說人是理性的',
    author: 'Dan Ariely',
    description: '行為經濟學的入門經典——人類的非理性不是隨機的，而是系統性的、可預測的。免費的力量、錨定效應、期望效應⋯⋯每一章都在打臉理性人假設。',
    files: ['Predictably Irrational 讀書筆記.md'],
    dir: 'negotiation',
    category: 'persuasion',
    lang: 'en'
  },
  'righteous-mind': {
    title: 'The Righteous Mind',
    titleZh: '好人總是自以為是',
    author: 'Jonathan Haidt',
    description: '道德判斷先於道德推理——人先用直覺做決定，再用理性編造理由。六大道德基礎解釋為什麼好人會有完全對立的立場。',
    files: ['The Righteous Mind 讀書筆記.md'],
    dir: 'negotiation',
    category: 'persuasion',
    lang: 'en'
  },
  'body-language': {
    title: 'What Every Body is Saying',
    titleZh: '看穿肢體語言',
    author: 'Joe Navarro',
    description: '前 FBI 反情報專家教你讀懂身體語言——從腳到頭的非言語信號解碼指南。安慰行為、凍結反應、領地宣示⋯⋯身體不會說謊。',
    files: ['What Every Body is Saying 讀書筆記.md'],
    dir: 'negotiation',
    category: 'persuasion',
    lang: 'en'
  },

  // ═══ 定價與銷售（6 本）═══
  'win-without-pitching': {
    title: 'Win Without Pitching Manifesto',
    titleZh: '不靠比稿贏單宣言',
    author: 'Blair Enns',
    description: '「免費展示才華來換取被選中」是專業者永久弱勢的根源——唯有專業化定位才能讓你從乞求者變成被邀請的顧問，從此以對話取代簡報、以診斷取代猜謎。',
    files: ['Win Without Pitching Manifesto.md'],
    dir: 'books',
    category: 'pricing',
    lang: 'en'
  },
  'pricing-creativity': {
    title: 'Pricing Creativity',
    titleZh: '創意定價',
    author: 'Blair Enns',
    description: '計時計費是創意人的枷鎖——唯有用價值對話取代工時計算，從「賣時間」升級為「賣客戶想要的未來狀態」，才能打破利潤天花板。',
    files: ['Pricing Creativity.md'],
    dir: 'books',
    category: 'pricing',
    lang: 'en'
  },
  'hourly-billing': {
    title: 'Hourly Billing Is Nuts',
    titleZh: '按時計費是瘋的',
    author: 'Jonathan Stark',
    description: '按時計費是雙輸遊戲——客戶不確定要花多少，你不確定能賺多少。改用固定價格，把風險從客戶肩上拿走。',
    files: ['Hourly Billing Is Nuts.md'],
    dir: 'books',
    category: 'pricing',
    lang: 'en'
  },
  'million-dollar': {
    title: 'Million Dollar Consulting Toolkit',
    titleZh: '百萬美元顧問工具箱',
    author: 'Alan Weiss',
    description: '顧問業的終極實戰手冊——從品牌定位到提案模板，從定價心理到客戶管理，百萬美元獨立顧問的全套工具與方法論。',
    files: ['Million Dollar Consulting Toolkit.md'],
    dir: 'books',
    category: 'pricing',
    lang: 'en'
  },
  'out-teach': {
    title: 'Out-teach Strategy',
    titleZh: 'Out-teach 以教代銷',
    author: 'Multiple',
    description: '用「教導」取代「推銷」——分享真正有用的知識，讓客戶因信任而來，而非因廣告而來。最好的行銷是讓客戶變得更聰明。',
    files: ['Out-teach 策略.md'],
    dir: 'books',
    category: 'pricing',
    lang: 'en'
  },
  'show-your-work': {
    title: 'Show Your Work!',
    titleZh: '展示你的工作',
    author: 'Austin Kleon',
    description: '不必等到完美才展示——分享過程本身就是最好的行銷。十條原則教你在數位時代被發現。',
    files: ['Show Your Work.md'],
    dir: 'books',
    category: 'pricing',
    lang: 'en'
  },

  // ═══ 創業與經營（6 本）═══
  'e-myth': {
    title: 'The E-Myth Revisited',
    titleZh: '創業這回事',
    author: 'Michael Gerber',
    description: '為什麼大多數小企業會失敗？因為技師假裝當老闆。解藥是把企業本身當成產品來設計——系統驅動，而非人驅動。',
    files: ['E-Myth Revisited 創業這回事.md'],
    dir: 'books',
    category: 'business',
    lang: 'en'
  },
  'clockwork': {
    title: 'Clockwork',
    titleZh: '發條企業',
    author: 'Mike Michalowicz',
    description: '設計一個不需要你也能運轉的企業。4D 框架（做/決定/委派/設計）讓老闆從「做事的人」升級為「設計系統的人」。',
    files: ['Clockwork 發條理論.md'],
    dir: 'books',
    category: 'business',
    lang: 'en'
  },
  'built-to-sell': {
    title: 'Built to Sell',
    titleZh: '打造可出售的事業',
    author: 'John Warrillow',
    description: '一本商業寓言，教你把服務公司轉型為可出售的產品公司——標準化流程、前收款、脫離老闆依賴。即使不打算賣，也要像要賣一樣經營。',
    files: ['Built to Sell 打造可出售的事業.md'],
    dir: 'books',
    category: 'business',
    lang: 'en'
  },
  'company-of-one': {
    title: 'Company of One',
    titleZh: '一人公司',
    author: 'Paul Jarvis',
    description: '質疑「增長」的預設前提——有時候不擴張才是最好的商業策略。一人公司不是「還沒長大的公司」，而是刻意選擇的經營哲學。',
    files: ['Company of One.md'],
    dir: 'books',
    category: 'business',
    lang: 'en'
  },
  'business-essence': {
    title: 'The Essence of Business Operations',
    titleZh: '經營的本質',
    author: '陳春花',
    description: '經營回歸四大基本元素：顧客價值、合理成本、有效規模、具人性關懷的盈利。一切管理工具離開這四項就是空轉。',
    files: ['經營的本質.md'],
    dir: 'books',
    category: 'business',
    lang: 'zh'
  },
  'mvpr': {
    title: 'MVPr Framework',
    titleZh: 'MVPr 最小可行聲譽',
    author: 'Multiple',
    description: '最小可行聲譽（Minimum Viable Professional Reputation）——用最少的投入建立專業可信度，讓潛在客戶在第一次接觸你之前就已經信任你。',
    files: ['MVPr 框架.md'],
    dir: 'books',
    category: 'business',
    lang: 'en'
  },

  // ═══ 人生智慧（7 本）═══
  'naval-almanack': {
    title: 'The Almanack of Naval Ravikant',
    titleZh: '納瓦爾寶典',
    author: 'Eric Jorgenson',
    description: '矽谷傳奇投資人 Naval Ravikant 的智慧集結——財富、幸福與判斷力三大主題，從「特定知識」到「無許可槓桿」，重新定義個人創業者的成功方程式。',
    files: ['Naval 金句集.md', 'Naval Ravikant 納瓦爾寶典.md', '納瓦爾寶典.md'],
    dir: 'books',
    category: 'wisdom',
    lang: 'en'
  },
  'happiness': {
    title: 'Happiness as Skill',
    titleZh: '幸福是技能',
    author: 'Naval Ravikant',
    description: '幸福不是運氣，是可鍛鍊的技能。從「什麼都不缺」的狀態出發，拆解欲望、嫉妒和焦慮的認知陷阱。',
    files: ['Happiness as Skill 幸福是技能.md'],
    dir: 'books',
    category: 'wisdom',
    lang: 'en'
  },
  'specific-knowledge': {
    title: 'Specific Knowledge',
    titleZh: '特定知識',
    author: 'Naval Ravikant',
    description: '特定知識無法被培訓，只能透過追隨真正的好奇心自然累積——它是你的競爭壁壘，也是無法被 AI 取代的部分。',
    files: ['Specific Knowledge 特定知識.md'],
    dir: 'books',
    category: 'wisdom',
    lang: 'en'
  },
  'permissionless-leverage': {
    title: 'Permissionless Leverage',
    titleZh: '無許可槓桿',
    author: 'Naval Ravikant',
    description: '程式碼和媒體是唯一不需要別人批准的槓桿——一個人加上正確的槓桿，產出可以等同百人團隊。',
    files: ['Permissionless Leverage 無許可槓桿.md'],
    dir: 'books',
    category: 'wisdom',
    lang: 'en'
  },
  'enough': {
    title: 'Enough',
    titleZh: 'Enough 知足的智慧',
    author: 'John C. Bogle',
    description: '先鋒基金創辦人談「夠了」的智慧：金錢、商業、人生，知道何時停下來比知道如何衝刺更重要。',
    files: ['Enough 哲學.md'],
    dir: 'books',
    category: 'wisdom',
    lang: 'en'
  },
  'social-capital': {
    title: 'Social Capital Model',
    titleZh: '社會資本模型',
    author: 'Multiple',
    description: '社會資本是信任的貨幣——聲譽、關係網絡和互惠規範構成的無形資產，比財務資本更難建立也更難複製。',
    files: ['Social Capital 模型.md'],
    dir: 'books',
    category: 'wisdom',
    lang: 'en'
  },
  'critical-thinking': {
    title: 'Asking the Right Questions',
    titleZh: '思辨，從問對問題開始',
    author: 'M. Neil Browne & Stuart Keeley',
    description: '批判思考者的十問框架：從「結論是什麼」到「有什麼重要資訊被遺漏」，教你在資訊洪流中淘出黃金。',
    files: ['思辨，從問對問題開始.md'],
    dir: 'books',
    category: 'wisdom',
    lang: 'zh'
  }
}

// ── Daily quote parsing (unchanged) ──

function findDailyFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...findDailyFiles(full))
    } else if (/^\d{4}-\d{2}-\d{2}\.md$/.test(entry)) {
      files.push(full)
    }
  }
  return files.sort()
}

function extractBlockquote(text) {
  const lines = text.split('\n')
  const quoteLines = []
  let source = ''
  let quoteEndIdx = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('> ')) {
      const content = line.slice(2).trim()
      if (content.startsWith('——') || content.startsWith('—— ')) {
        source = content.replace(/^——\s*/, '').trim()
        quoteEndIdx = i
        break
      }
      // Skip English translation line (it's part of the quote block)
      if (content.startsWith('*En:') || content.startsWith('*Zh:')) continue
      quoteLines.push(content)
    } else if (quoteLines.length > 0 && !line.startsWith('>')) {
      quoteEndIdx = i - 1
      break
    }
  }

  if (quoteLines.length === 0) return null

  // Look for translation in the lines after source
  let translation = ''
  const searchStart = quoteEndIdx >= 0 ? quoteEndIdx : quoteLines.length
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const enMatch = line.match(/^>\s*\*En:\s*(.+?)\*$/)
    if (enMatch) {
      translation = enMatch[1].trim()
      if (i > quoteEndIdx) quoteEndIdx = i
      break
    }
    const zhMatch = line.match(/^>\s*\*Zh:\s*(.+?)\*$/)
    if (zhMatch) {
      translation = zhMatch[1].trim()
      if (i > quoteEndIdx) quoteEndIdx = i
      break
    }
  }

  // Extract commentary
  let commentary = ''
  if (quoteEndIdx >= 0) {
    const afterQuote = lines.slice(quoteEndIdx + 1).join('\n').trim()
    const paragraphs = afterQuote.split(/\n\n+/)
    for (const p of paragraphs) {
      const clean = p.trim()
      if (clean.startsWith('#') || clean === '---' || clean === '') continue
      commentary = clean
        .replace(/^\*\*[^*]+\*\*[：:]*\s*/, '')
        .replace(/\n/g, ' ')
        .trim()
      if (commentary.length > 20) break
    }
  }

  if (commentary.length > 300) {
    commentary = commentary.slice(0, 297) + '…'
  }

  return { original: quoteLines.join('\n'), source, translation, commentary }
}

function parseDailyFile(filepath) {
  const content = readFileSync(filepath, 'utf-8')
  const dateMatch = basename(filepath).match(/^(\d{4}-\d{2}-\d{2})/)
  if (!dateMatch) return []
  const date = dateMatch[1]
  const quotes = []

  for (const meal of MEALS) {
    const sectionRegex = new RegExp(`## ${meal}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'g')
    let extracted = null
    for (const match of content.matchAll(sectionRegex)) {
      extracted = extractBlockquote(match[1])
      if (extracted) break
    }
    if (!extracted) continue

    quotes.push({
      id: `${date}-${MEAL_MAP[meal]}`,
      date,
      meal,
      original: extracted.original,
      originalLang: 'zh',
      translation: extracted.translation,
      source: extracted.source,
      commentary: extracted.commentary,
      category: 'daily',
      theme: null,
      bookKey: null
    })
  }

  return quotes
}

// ── Book quote parsing (### 「...」 format) ──

function parseBookQuotes(filepath, bookKey, bookInfo) {
  let content
  try {
    content = readFileSync(filepath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  } catch {
    return []
  }

  const quotes = []
  let currentTheme = ''
  let quoteIdx = 0
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const themeMatch = line.match(/^## (.+)$/)
    if (themeMatch) {
      const theme = themeMatch[1].trim()
      const skipPrefixes = ['交叉引用', '為什麼', '書籍資訊', '子卡', '我可以', '與 TMW', '可行動']
      if (!skipPrefixes.some(p => theme.startsWith(p))) {
        currentTheme = theme
      }
      continue
    }

    // ### 「...」 format
    const quoteMatch = line.match(/^### 「(.+?)」$/)
    if (!quoteMatch) continue

    const original = quoteMatch[1].trim()
    quoteIdx++

    let translation = ''
    let commentary = ''
    for (let j = i + 1; j < lines.length && j < i + 25; j++) {
      if (lines[j].startsWith('### ') || lines[j].startsWith('## ')) break
      const zhMatch = lines[j].trim().match(/^>\s*\*Zh:\s*(.+?)\*$/)
      if (zhMatch) { translation = zhMatch[1].trim(); continue }
      const enMatch = lines[j].trim().match(/^>\s*\*En:\s*(.+?)\*$/)
      if (enMatch) { translation = enMatch[1].trim(); continue }
      if (lines[j].startsWith('**為什麼選這句**：') || lines[j].startsWith('**為什麼選這句**:')) {
        commentary = lines[j].replace(/^\*\*為什麼選這句\*\*[：:]\s*/, '').trim()
        break
      }
    }

    if (commentary.length > 300) commentary = commentary.slice(0, 297) + '…'

    const themeSlug = currentTheme.replace(/篇$/, '').replace(/^金句[集]?$/, '').trim()

    quotes.push({
      id: `${bookKey}-${String(quoteIdx).padStart(3, '0')}`,
      date: null,
      meal: null,
      original,
      originalLang: bookInfo.lang || 'en',
      translation,
      source: `${bookInfo.titleZh}（${bookInfo.author}）`,
      commentary,
      category: 'book',
      theme: themeSlug || null,
      bookKey
    })
  }

  return quotes
}

// ── Negotiation book parsing (blockquote + structured format) ──

function parseNegotiationBook(filepath, bookKey, bookInfo) {
  let content
  try {
    content = readFileSync(filepath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  } catch {
    return []
  }

  const quotes = []
  let quoteIdx = 0
  const lines = content.split('\n')

  // Skip metadata labels in blockquotes
  const metaLabels = ['副標題', '作者', '出版', 'ISBN', '定位', '關係', '應用', '欄位']

  // Track current chapter/section for theme
  let currentChapter = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Track chapter headers
    const chapterMatch = line.match(/^### (Ch\d+[：:]?\s*.+|原則\s*\d+[：:]?\s*.+|宣言\s*[IVX]+\s*[—：:].+|.+章[：:].+)/)
    if (chapterMatch) {
      currentChapter = chapterMatch[1]
        .replace(/^(Ch\d+|原則\s*\d+|宣言\s*[IVX]+)\s*[：:—]\s*/, '')
        .replace(/<br>.*$/, '')
        .trim()
      continue
    }

    // Also track ## headers for theme
    const h2Match = line.match(/^## (.+)$/)
    if (h2Match) {
      const h2 = h2Match[1].trim()
      const skipH2 = ['書籍資訊', '交叉引用', '一句話總結', '核心框架', '核心問題意識']
      if (!skipH2.some(s => h2.startsWith(s)) && !h2.includes('|')) {
        currentChapter = h2
      }
    }

    // Extract blockquotes
    if (!line.startsWith('> ')) continue
    const bqContent = line.slice(2).trim()

    // Skip metadata blockquotes
    if (metaLabels.some(label => bqContent.startsWith(`**${label}**`))) continue
    if (bqContent.startsWith('**副標**')) continue

    // Skip very short lines or pure formatting
    if (bqContent.length < 15) continue
    if (bqContent.startsWith('```') || bqContent.startsWith('|')) continue
    if (bqContent.startsWith('[[') && bqContent.endsWith(']]')) continue

    // Determine quote type and extract
    let original = ''
    let commentary = ''
    let isLabeled = false

    // Labeled blockquotes: > **報價應用**：text
    const labelMatch = bqContent.match(/^\*\*(.+?)\*\*[：:]\s*(.+)$/)
    if (labelMatch) {
      const label = labelMatch[1]
      const text = labelMatch[2].trim()
      // Only keep meaningful labels
      const goodLabels = ['報價應用', '關鍵洞見', '核心論點', '核心命題', '一句話', '啟示',
        '操作要點', '重要', '注意', '核心問題', '教訓', '洞見']
      if (goodLabels.some(gl => label.includes(gl))) {
        original = text
        isLabeled = true
        // Collect continuation lines
        for (let j = i + 1; j < lines.length && j < i + 5; j++) {
          if (lines[j].startsWith('> ') && !lines[j].startsWith('> **') && !lines[j].startsWith('> ---')) {
            original += ' ' + lines[j].slice(2).trim()
          } else break
        }
      }
    }

    // Plain meaningful blockquotes (not labeled, not metadata)
    if (!isLabeled && !labelMatch) {
      // Must be substantial text (not a list item, not a link)
      if (bqContent.startsWith('-') || bqContent.startsWith('*') || bqContent.startsWith('1.')) continue

      original = bqContent
      // Collect multi-line blockquotes
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        if (lines[j].startsWith('> ') && !lines[j].startsWith('> **') && !lines[j].startsWith('> ---')) {
          const cont = lines[j].slice(2).trim()
          if (cont.startsWith('-') || cont.startsWith('*')) break
          original += ' ' + cont
        } else break
      }
    }

    if (!original || original.length < 20) continue

    // Clean up
    original = original.replace(/\*\*/g, '').trim()
    if (original.length > 500) original = original.slice(0, 497) + '…'

    // Get surrounding context for commentary
    const nextParagraph = []
    let foundBlank = false
    for (let j = i + 1; j < lines.length && j < i + 10; j++) {
      if (lines[j].trim() === '') { foundBlank = true; continue }
      if (foundBlank && !lines[j].startsWith('>') && !lines[j].startsWith('#') && lines[j].trim() !== '---') {
        commentary = lines[j].replace(/^\*\*[^*]+\*\*[：:]*\s*/, '').replace(/\n/g, ' ').trim()
        if (commentary.length > 20) break
        commentary = ''
      }
      if (lines[j].startsWith('#') || lines[j].startsWith('---')) break
    }
    if (commentary.length > 300) commentary = commentary.slice(0, 297) + '…'

    quoteIdx++
    quotes.push({
      id: `${bookKey}-${String(quoteIdx).padStart(3, '0')}`,
      date: null,
      meal: null,
      original,
      originalLang: bookInfo.lang || 'en',
      translation: '',
      source: `${bookInfo.titleZh}（${bookInfo.author}）`,
      commentary,
      category: 'book',
      theme: currentChapter || null,
      bookKey
    })
  }

  // Also extract the "一句話總結" as a special quote
  const summaryMatch = content.match(/## 一句話總結\s*\n+(.+?)(?:\n\n|\n---|\n#)/s)
  if (summaryMatch) {
    const summary = summaryMatch[1].trim().replace(/^\*\*/, '').replace(/\*\*$/, '')
    if (summary.length > 15) {
      quoteIdx++
      quotes.push({
        id: `${bookKey}-summary`,
        date: null,
        meal: null,
        original: summary,
        originalLang: bookInfo.lang || 'en',
        translation: '',
        source: `${bookInfo.titleZh}（${bookInfo.author}）`,
        commentary: '本書一句話總結',
        category: 'book',
        theme: '一句話總結',
        bookKey
      })
    }
  }

  return quotes
}

// ── Deduplication ──

function deduplicateQuotes(quotes) {
  const seen = new Map()
  const result = []

  for (const q of quotes) {
    const key = q.original
      .replace(/[《》「」『』〈〉，。、；：！？\s\*\n]/g, '')
      .slice(0, 40)

    if (seen.has(key)) {
      const existing = seen.get(key)
      if (q.commentary.length > existing.commentary.length) {
        const idx = result.indexOf(existing)
        if (idx !== -1) result[idx] = q
        seen.set(key, q)
      }
      continue
    }

    seen.set(key, q)
    result.push(q)
  }

  return result
}

// ── Main ──

function main() {
  const allQuotes = []
  const usedBooks = []

  // 1. Parse daily quote files
  const dailyFiles = findDailyFiles(QUOTE_HISTORY_DIR)
  console.error(`Found ${dailyFiles.length} daily quote files`)

  for (const f of dailyFiles) {
    const quotes = parseDailyFile(f)
    if (quotes.length > 0) {
      console.error(`  ${basename(f)}: ${quotes.length} quotes`)
      allQuotes.push(...quotes)
    } else {
      console.error(`  ${basename(f)}: (skipped)`)
    }
  }

  // 2. Parse ALL book files
  console.error(`\nScanning ${Object.keys(BOOK_CATALOG).length} books...`)

  for (const [bookKey, bookInfo] of Object.entries(BOOK_CATALOG)) {
    let bookQuoteCount = 0
    const dir = bookInfo.dir === 'negotiation' ? NEGOTIATION_DIR : BOOKS_DIR
    const parser = bookInfo.dir === 'negotiation' ? parseNegotiationBook : parseBookQuotes

    for (const filename of bookInfo.files) {
      const filepath = join(dir, filename)
      if (!existsSync(filepath)) {
        console.error(`  [WARN] File not found: ${filename}`)
        continue
      }
      let quotes = parser(filepath, bookKey, bookInfo)
      // Fallback: if primary parser found 0 quotes, try the other parser
      if (quotes.length === 0) {
        const fallback = parser === parseBookQuotes ? parseNegotiationBook : parseBookQuotes
        quotes = fallback(filepath, bookKey, bookInfo)
      }
      if (quotes.length > 0) {
        allQuotes.push(...quotes)
        bookQuoteCount += quotes.length
      }
    }

    if (bookQuoteCount > 0) {
      console.error(`  ${bookInfo.titleZh}: ${bookQuoteCount} quotes`)
      usedBooks.push({
        key: bookKey,
        title: bookInfo.title,
        titleZh: bookInfo.titleZh,
        author: bookInfo.author,
        description: bookInfo.description,
        category: CATEGORIES[bookInfo.category] || bookInfo.category
      })
    } else {
      console.error(`  ${bookInfo.titleZh}: (no quotes found)`)
    }
  }

  // 3. Deduplicate
  const beforeCount = allQuotes.length
  const dedupedQuotes = deduplicateQuotes(allQuotes)
  const removedCount = beforeCount - dedupedQuotes.length
  if (removedCount > 0) {
    console.error(`\nDeduplication: removed ${removedCount} duplicates`)
  }

  // 4. Stats
  const bookQuotes = dedupedQuotes.filter(q => q.category === 'book')
  const dailyQuotes = dedupedQuotes.filter(q => q.category === 'daily')
  console.error(`\n═══ Summary ═══`)
  console.error(`Daily quotes: ${dailyQuotes.length}`)
  console.error(`Book quotes:  ${bookQuotes.length} (${usedBooks.length} books)`)
  console.error(`Total:        ${dedupedQuotes.length}`)

  // Per-category stats
  const catStats = {}
  for (const b of usedBooks) {
    if (!catStats[b.category]) catStats[b.category] = { books: 0, quotes: 0 }
    catStats[b.category].books++
    catStats[b.category].quotes += bookQuotes.filter(q => q.bookKey === b.key).length
  }
  for (const [cat, s] of Object.entries(catStats)) {
    console.error(`  ${cat}: ${s.books} books, ${s.quotes} quotes`)
  }

  // 5. Write output
  const output = {
    extractedAt: new Date().toISOString(),
    count: dedupedQuotes.length,
    books: usedBooks,
    quotes: dedupedQuotes
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8')
  console.error(`\nWrote ${dedupedQuotes.length} quotes to ${OUTPUT_FILE}`)
}

try {
  main()
} catch (err) {
  console.error(`Fatal: ${err.message}`)
  console.error(err.stack)
  process.exit(1)
}

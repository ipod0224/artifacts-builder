#!/usr/bin/env node
/**
 * 從 Obsidian vault 擷取語錄 → public/data/quotes.json
 *
 * 來源：
 *   1. Daily Notes/語錄歷史/YYYY-MM/YYYY-MM-DD.md（三餐格式）
 *   2. Knowledge/Other/Books/*.md（所有書籍金句）
 *
 * 用法：node scripts/extract-quotes.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'

const VAULT_PATH = '/Volumes/SupabaseData/ObsidianPKM'
const QUOTE_HISTORY_DIR = join(VAULT_PATH, 'Daily Notes', '語錄歷史')
const BOOKS_DIR = join(VAULT_PATH, 'Knowledge', 'Other', 'Books')
const OUTPUT_FILE = join(import.meta.dirname, '..', 'public', 'data', 'quotes.json')

const MEAL_MAP = { '晨讀': 'morning', '午學': 'noon', '夕省': 'evening' }
const MEALS = ['晨讀', '午學', '夕省']

// ── 書籍清單（key → 中文書名 + 作者 + 簡介）──
const BOOK_CATALOG = {
  'naval-almanack': {
    title: 'The Almanack of Naval Ravikant',
    titleZh: '納瓦爾寶典',
    author: 'Eric Jorgenson',
    description: '矽谷傳奇投資人 Naval Ravikant 的智慧集結——財富、幸福與判斷力三大主題，從「特定知識」到「無許可槓桿」，重新定義個人創業者的成功方程式。',
    files: ['Naval 金句集.md', 'Naval Ravikant 納瓦爾寶典.md', '納瓦爾寶典.md'],
    lang: 'en'
  },
  'e-myth': {
    title: 'The E-Myth Revisited',
    titleZh: '創業這回事',
    author: 'Michael Gerber',
    description: '為什麼大多數小企業會失敗？因為技師假裝當老闆。解藥是把企業本身當成產品來設計——系統驅動，而非人驅動。',
    files: ['E-Myth Revisited 創業這回事.md'],
    lang: 'en'
  },
  'clockwork': {
    title: 'Clockwork',
    titleZh: '發條理論',
    author: 'Mike Michalowicz',
    description: '設計一個不需要你也能運轉的企業。4D 框架（做/決定/委派/設計）讓老闆從「做事的人」升級為「設計系統的人」。',
    files: ['Clockwork 發條理論.md'],
    lang: 'en'
  },
  'built-to-sell': {
    title: 'Built to Sell',
    titleZh: '打造可出售的事業',
    author: 'John Warrillow',
    description: '一本商業寓言，教你把服務公司轉型為可出售的產品公司——標準化流程、前收款、脫離老闆依賴。',
    files: ['Built to Sell 打造可出售的事業.md'],
    lang: 'en'
  },
  'enough': {
    title: 'Enough',
    titleZh: 'Enough 哲學',
    author: 'John C. Bogle',
    description: '先鋒基金創辦人談「夠了」的智慧：金錢、商業、人生，知道何時停下來比知道如何衝刺更重要。',
    files: ['Enough 哲學.md'],
    lang: 'en'
  },
  'happiness': {
    title: 'Happiness as Skill',
    titleZh: '幸福是技能',
    author: 'Naval Ravikant',
    description: '幸福不是運氣，是可鍛鍊的技能。從「什麼都不缺」的狀態出發，拆解欲望、嫉妒和焦慮的認知陷阱。',
    files: ['Happiness as Skill 幸福是技能.md'],
    lang: 'en'
  },
  'specific-knowledge': {
    title: 'Specific Knowledge',
    titleZh: '特定知識',
    author: 'Naval Ravikant',
    description: '特定知識無法被培訓，只能透過追隨真正的好奇心自然累積——它是你的競爭壁壘。',
    files: ['Specific Knowledge 特定知識.md'],
    lang: 'en'
  },
  'permissionless-leverage': {
    title: 'Permissionless Leverage',
    titleZh: '無許可槓桿',
    author: 'Naval Ravikant',
    description: '程式碼和媒體是唯一不需要別人批准的槓桿——一個人加上正確的槓桿，產出可以等同百人團隊。',
    files: ['Permissionless Leverage 無許可槓桿.md'],
    lang: 'en'
  },
  'critical-thinking': {
    title: 'Asking the Right Questions',
    titleZh: '思辨，從問對問題開始',
    author: 'M. Neil Browne & Stuart Keeley',
    description: '批判思考者的十問框架：從「結論是什麼」到「有什麼重要資訊被遺漏」，教你在資訊洪流中淘出黃金。',
    files: ['思辨，從問對問題開始.md'],
    lang: 'zh'
  },
  'business-essence': {
    title: 'The Essence of Business Operations',
    titleZh: '經營的本質',
    author: '陳春花',
    description: '經營回歸四大基本元素：顧客價值、合理成本、有效規模、具人性關懷的盈利。一切管理工具離開這四項就是空轉。',
    files: ['經營的本質.md'],
    lang: 'zh'
  },
  'out-teach': {
    title: 'Out-teach Strategy',
    titleZh: 'Out-teach 策略',
    author: 'Multiple',
    description: '用「教導」取代「推銷」——分享真正有用的知識，讓客戶因信任而來，而非因廣告而來。',
    files: ['Out-teach 策略.md'],
    lang: 'en'
  },
  'social-capital': {
    title: 'Social Capital Model',
    titleZh: 'Social Capital 模型',
    author: 'Multiple',
    description: '社會資本是信任的貨幣——聲譽、關係網絡和互惠規範構成的無形資產，比財務資本更難建立也更難複製。',
    files: ['Social Capital 模型.md'],
    lang: 'en'
  },
  'mvpr': {
    title: 'MVPr Framework',
    titleZh: 'MVPr 框架',
    author: 'Multiple',
    description: '最小可行聲譽（Minimum Viable Professional Reputation）——用最少的投入建立專業可信度。',
    files: ['MVPr 框架.md'],
    lang: 'en'
  },
  'company-of-one': {
    title: 'Company of One',
    titleZh: 'Company of One',
    author: 'Paul Jarvis',
    description: '質疑「增長」的預設前提——有時候不擴張才是最好的商業策略。一人公司的哲學。',
    files: ['Company of One.md'],
    lang: 'en'
  },
  'win-without-pitching': {
    title: 'Win Without Pitching Manifesto',
    titleZh: 'Win Without Pitching',
    author: 'Blair Enns',
    description: '停止免費提案，開始定義遊戲規則——專業服務業的定價與議價聖經。',
    files: ['Win Without Pitching Manifesto.md'],
    lang: 'en'
  },
  'show-your-work': {
    title: 'Show Your Work!',
    titleZh: 'Show Your Work',
    author: 'Austin Kleon',
    description: '不必等到完美才展示——分享過程本身就是最好的行銷。',
    files: ['Show Your Work.md'],
    lang: 'en'
  },
  'pricing-creativity': {
    title: 'Pricing Creativity',
    titleZh: 'Pricing Creativity',
    author: 'Blair Enns',
    description: '創意工作的定價不該按時計費——四種定價模型讓你擺脫時薪陷阱。',
    files: ['Pricing Creativity.md'],
    lang: 'en'
  },
  'hourly-billing': {
    title: 'Hourly Billing Is Nuts',
    titleZh: 'Hourly Billing Is Nuts',
    author: 'Jonathan Stark',
    description: '按時計費是雙輸遊戲——客戶不確定要花多少，你不確定能賺多少。改用固定價格。',
    files: ['Hourly Billing Is Nuts.md'],
    lang: 'en'
  }
}

/**
 * Recursively find all YYYY-MM-DD.md files
 */
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

/**
 * Extract blockquote + source from a section of text.
 */
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
      quoteLines.push(content)
    } else if (quoteLines.length > 0 && !line.startsWith('>')) {
      quoteEndIdx = i - 1
      break
    }
  }

  if (quoteLines.length === 0) return null

  let translation = ''
  const nextLineIdx = quoteEndIdx + 1
  if (nextLineIdx < lines.length) {
    const nextLine = lines[nextLineIdx].trim()
    const transMatch = nextLine.match(/^>\s*\*En:\s*(.+?)\*$/)
    if (transMatch) {
      translation = transMatch[1].trim()
      quoteEndIdx = nextLineIdx
    }
  }

  let commentary = ''
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

  if (commentary.length > 300) {
    commentary = commentary.slice(0, 297) + '…'
  }

  return { original: quoteLines.join('\n'), source, translation, commentary }
}

/**
 * Parse a daily quote file (new format with ## 晨讀/午學/夕省)
 */
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

/**
 * Parse a book file for ### 「...」 format quotes
 */
function parseBookFile(filepath, bookKey, bookInfo) {
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

    // Track theme headers (## 財富篇, ## 金句集, etc.)
    const themeMatch = line.match(/^## (.+)$/)
    if (themeMatch) {
      const theme = themeMatch[1].trim()
      // Skip non-content sections
      if (!theme.startsWith('交叉引用') && !theme.startsWith('為什麼') &&
          !theme.startsWith('書籍資訊') && !theme.startsWith('子卡') &&
          !theme.startsWith('我可以') && !theme.startsWith('與 TMW') &&
          !theme.startsWith('可行動')) {
        currentTheme = theme
      }
      continue
    }

    // Find quotes in ### 「...」 format
    const quoteMatch = line.match(/^### 「(.+?)」$/)
    if (!quoteMatch) continue

    const original = quoteMatch[1].trim()
    quoteIdx++

    // Extract translation and commentary
    let translation = ''
    let commentary = ''
    for (let j = i + 1; j < lines.length && j < i + 25; j++) {
      if (lines[j].startsWith('### ') || lines[j].startsWith('## ')) break

      // Translation: > *Zh: ...* or > *En: ...*
      const zhMatch = lines[j].trim().match(/^>\s*\*Zh:\s*(.+?)\*$/)
      if (zhMatch) { translation = zhMatch[1].trim(); continue }
      const enMatch = lines[j].trim().match(/^>\s*\*En:\s*(.+?)\*$/)
      if (enMatch) { translation = enMatch[1].trim(); continue }

      // Commentary
      if (lines[j].startsWith('**為什麼選這句**：') || lines[j].startsWith('**為什麼選這句**:')) {
        commentary = lines[j].replace(/^\*\*為什麼選這句\*\*[：:]\s*/, '').trim()
        break
      }
    }

    if (commentary.length > 300) {
      commentary = commentary.slice(0, 297) + '…'
    }

    const themeSlug = currentTheme
      .replace(/篇$/, '')
      .replace(/^金句[集]?$/, '')
      .trim()

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

/**
 * Deduplicate quotes by original text similarity (first 40 chars)
 */
function deduplicateQuotes(quotes) {
  const seen = new Map()
  const result = []

  for (const q of quotes) {
    // Normalize: strip punctuation and whitespace for comparison
    const key = q.original
      .replace(/[《》「」『』〈〉，。、；：！？\s]/g, '')
      .slice(0, 40)

    if (seen.has(key)) {
      const existing = seen.get(key)
      // Keep the one with longer commentary
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
      console.error(`  ${basename(f)}: (old format, skipped)`)
    }
  }

  // 2. Parse ALL book files
  console.error(`\nScanning ${Object.keys(BOOK_CATALOG).length} books...`)

  for (const [bookKey, bookInfo] of Object.entries(BOOK_CATALOG)) {
    let bookQuoteCount = 0
    for (const filename of bookInfo.files) {
      const filepath = join(BOOKS_DIR, filename)
      const quotes = parseBookFile(filepath, bookKey, bookInfo)
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
        description: bookInfo.description
      })
    }
  }

  // 3. Deduplicate
  const beforeCount = allQuotes.length
  const dedupedQuotes = deduplicateQuotes(allQuotes)
  const removedCount = beforeCount - dedupedQuotes.length
  if (removedCount > 0) {
    console.error(`\nDeduplication: removed ${removedCount} duplicates`)
  }

  // 4. Write output
  const output = {
    extractedAt: new Date().toISOString(),
    count: dedupedQuotes.length,
    books: usedBooks,
    quotes: dedupedQuotes
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8')
  console.error(`\nWrote ${dedupedQuotes.length} quotes (${usedBooks.length} books) to ${OUTPUT_FILE}`)
}

try {
  main()
} catch (err) {
  console.error(`Fatal: ${err.message}`)
  process.exit(1)
}

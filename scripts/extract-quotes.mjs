#!/usr/bin/env node
/**
 * 從 Obsidian vault 擷取語錄 → public/data/quotes.json
 *
 * 來源：
 *   1. Daily Notes/語錄歷史/YYYY-MM/YYYY-MM-DD.md（三餐格式）
 *   2. Knowledge/Other/Books/Naval 金句集.md
 *
 * 用法：node scripts/extract-quotes.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'

const VAULT_PATH = '/Volumes/SupabaseData/ObsidianPKM'
const QUOTE_HISTORY_DIR = join(VAULT_PATH, 'Daily Notes', '語錄歷史')
const NAVAL_FILE = join(VAULT_PATH, 'Knowledge', 'Other', 'Books', 'Naval 金句集.md')
const OUTPUT_FILE = join(import.meta.dirname, '..', 'public', 'data', 'quotes.json')

const MEAL_MAP = { '晨讀': 'morning', '午學': 'noon', '夕省': 'evening' }
const MEALS = ['晨讀', '午學', '夕省']

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
 * Pattern: lines starting with "> " until a line with "——"
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
      // Check if this line contains the source attribution
      if (content.startsWith('——') || content.startsWith('—— ')) {
        source = content.replace(/^——\s*/, '').trim()
        quoteEndIdx = i
        break
      }
      quoteLines.push(content)
    } else if (quoteLines.length > 0 && !line.startsWith('>')) {
      // End of blockquote without source
      quoteEndIdx = i - 1
      break
    }
  }

  if (quoteLines.length === 0) return null

  // Check for translation line: > *En: ...*
  let translation = ''
  const nextLineIdx = quoteEndIdx + 1
  if (nextLineIdx < lines.length) {
    const nextLine = lines[nextLineIdx].trim()
    const transMatch = nextLine.match(/^>\s*\*En:\s*(.+?)\*$/)
    if (transMatch) {
      translation = transMatch[1].trim()
      quoteEndIdx = nextLineIdx // advance past translation line
    }
  }

  // Extract commentary: first substantial paragraph after the blockquote
  let commentary = ''
  const afterQuote = lines.slice(quoteEndIdx + 1).join('\n').trim()
  // Skip empty lines and find first paragraph
  const paragraphs = afterQuote.split(/\n\n+/)
  for (const p of paragraphs) {
    const clean = p.trim()
    // Skip headers, horizontal rules, bold-only lines
    if (clean.startsWith('#') || clean === '---' || clean === '') continue
    // Take the first real paragraph content
    commentary = clean
      .replace(/^\*\*[^*]+\*\*[：:]*\s*/, '') // remove leading bold header + colon
      .replace(/\n/g, ' ')
      .trim()
    if (commentary.length > 20) break
  }

  // Truncate commentary to ~300 chars
  if (commentary.length > 300) {
    commentary = commentary.slice(0, 297) + '…'
  }

  return {
    original: quoteLines.join('\n'),
    source,
    translation,
    commentary
  }
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
    // Find ALL sections for this meal (some files have duplicates)
    const sectionRegex = new RegExp(`## ${meal}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'g')
    let extracted = null
    for (const match of content.matchAll(sectionRegex)) {
      extracted = extractBlockquote(match[1])
      if (extracted) break // use first section that has a valid blockquote
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
      theme: null
    })
  }

  return quotes
}

/**
 * Parse Naval 金句集
 */
function parseNavalFile(filepath) {
  const content = readFileSync(filepath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const quotes = []

  // Find current theme (## 財富篇, ## 幸福篇, etc.)
  let currentTheme = ''
  let quoteIdx = 0

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Track theme headers
    const themeMatch = line.match(/^## (.+)$/)
    if (themeMatch) {
      const theme = themeMatch[1].trim()
      if (!theme.startsWith('交叉引用') && !theme.startsWith('為什麼')) {
        currentTheme = theme
      }
      continue
    }

    // Find quotes in ### 「...」 format
    const quoteMatch = line.match(/^### 「(.+?)」$/)
    if (!quoteMatch) continue

    const original = quoteMatch[1].trim()
    quoteIdx++

    // Extract translation (> *Zh: ...*) and commentary
    let translation = ''
    let commentary = ''
    for (let j = i + 1; j < lines.length && j < i + 20; j++) {
      if (lines[j].startsWith('### ') || lines[j].startsWith('## ')) break
      const transMatch = lines[j].trim().match(/^>\s*\*Zh:\s*(.+?)\*$/)
      if (transMatch) {
        translation = transMatch[1].trim()
        continue
      }
      if (lines[j].startsWith('**為什麼選這句**：')) {
        commentary = lines[j].replace('**為什麼選這句**：', '').trim()
        break
      }
    }

    if (commentary.length > 300) {
      commentary = commentary.slice(0, 297) + '…'
    }

    // Generate a simple theme slug for ID
    const themeSlug = currentTheme.replace(/篇$/, '').toLowerCase()
    quotes.push({
      id: `naval-${themeSlug}-${String(quoteIdx).padStart(3, '0')}`,
      date: null,
      meal: null,
      original,
      originalLang: 'en',
      translation,
      source: 'The Almanack of Naval Ravikant',
      commentary,
      category: 'naval',
      theme: currentTheme
    })
  }

  return quotes
}

// ── Main ──
function main() {
  const allQuotes = []

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

  // 2. Parse Naval 金句集
  try {
    const navalQuotes = parseNavalFile(NAVAL_FILE)
    console.error(`Naval 金句集: ${navalQuotes.length} quotes`)
    allQuotes.push(...navalQuotes)
  } catch (err) {
    console.error(`Naval file not found or error: ${err.message}`)
  }

  // 3. Write output
  const output = {
    extractedAt: new Date().toISOString(),
    count: allQuotes.length,
    quotes: allQuotes
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8')
  console.error(`\nWrote ${allQuotes.length} quotes to ${OUTPUT_FILE}`)
}

try {
  main()
} catch (err) {
  console.error(`Fatal: ${err.message}`)
  process.exit(1)
}

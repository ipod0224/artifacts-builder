import { NextRequest, NextResponse } from 'next/server';
import iconv from 'iconv-lite';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { sql } from '@/lib/db';
import Database from 'better-sqlite3';

// 代理 HTML 安全 headers（唯讀展示，禁止腳本/表單/導航）
const PROXY_HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https: http:; img-src * data:; font-src https: http:; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, max-age=300'
};

const WIRE_BASE = 'http://www.wire.com.tw';
const LOGIN_URL = `${WIRE_BASE}/index0_a.asp`;

/**
 * 銘宣 record ID → ASP page path mapping
 * ID format: cable-{wireType}-{brand}-{spec}-{cores}
 * Special: cable-cvv-{spec}-{cores} (no brand, always walsin)
 */
const WINSEN_PAGE_MAP: Record<string, string> = {
  'iv-walsin': '/price_iv_wlc.asp',
  'iv-hongtai': '/price_iv_ht.asp',
  'cv-walsin': '/price_cv600v_wlc.asp',
  'cv-hongtai': '/price_cv600v_ht_0.asp',
  cvv: '/price_cvv_wlc.asp',
  'vv-walsin': '/price_vv_wlc.asp',
  'vv-hongtai': '/price_vv_ht.asp',
  'vvf-hongtai': '/price_vvf_ht.asp',
  'hiv-walsin': '/price_hiv1_wlc.asp',
  'fr-cv-walsin': '/price_frcv_wlc.asp',
  'hr-cv-walsin': '/price_hrcv_wlc.asp',
  'pv-walsin': '/price_pvcable_wl.asp',
  'pv-hongtai': '/price_pvcable_ht.asp'
};

/** 鍾榮 sheet GID mapping (from htmlview extraction) */
const ZHONGRONG_SHEET_GIDS: Record<string, string> = {
  pvc: '179985611',
  xlpe: '2036828419',
  fr: '1568809813'
};

/**
 * NFB sheet GID mapping (from Playwright browser extraction)
 * File: 牌價 (無熔絲開關).xlsx — shared by 朝立/東元電機/三菱電機
 */
const NFB_SHEET_GIDS: Record<string, string> = {
  BH: '68726641',
  'NF-SN': '319628021',
  'NF-CN': '1543852647',
  NFA: '1784900706',
  'NV-SN': '1690962674',
  'NV-CN': '1762273162'
};

/** 管件 sheet GID mapping — 萬蕙昇 */
const CONDUIT_SHEET_GIDS: Record<string, string> = {
  emt: '551442783',
  'emt-fit': '1888903681',
  'ss-pipe': '813941251',
  'ss-fit': '813941251',
  rsg: '1010433021',
  pvc: '2010023675',
  'pvc-fit': '2010023675'
};

/** 變壓器 GID — 信佳電機 (single sheet) */
const TRANSFORMER_GID = '1758686092';

/** Google Sheets base URLs by source */
const GDRIVE_SHEETS: Record<string, { fileId: string }> = {
  鍾榮: { fileId: '1lf-qaLWEnf9F05Vsls6WdBaoHE-85-1a' },
  朝立: { fileId: '1ov4xjyt1XyMb-dfCzfB7-pg07eCZxYqe' },
  東元電機: { fileId: '1ov4xjyt1XyMb-dfCzfB7-pg07eCZxYqe' },
  三菱電機: { fileId: '1ov4xjyt1XyMb-dfCzfB7-pg07eCZxYqe' },
  萬蕙昇: { fileId: '1CEHSPXOVmc3fmECpU3AhkyTTqqrIpggo' },
  信佳電機: { fileId: '1GcAR4PT2OdZQ5rHmUgp9FYGPKzs1nhab' }
};

/** Resolve 鍾榮 record ID to sheet GID */
function resolveZhongrongGid(id: string): string | undefined {
  // cable-{type}-{spec}-{cores}  e.g. cable-pvc-2-1c, cable-fr-950-1.2
  const m = id.match(/^cable-(\w+)-/);
  if (!m) return undefined;
  const wireType = m[1].toLowerCase();
  return ZHONGRONG_SHEET_GIDS[wireType];
}

/**
 * Resolve 朝立/三菱 NFB/LB record ID to sheet GID
 * ID formats:
 *   nfb-BH-3P-1230        → BH
 *   nfb-NF50-SN-3P-1090   → NF-SN
 *   nfb-NF50-CN-3P-1090   → NF-CN
 *   nfb-NFA100-3P-15000   → NFA
 *   lb-NV30-SN-3P-2480    → NV-SN
 *   lb-NV30-CN-3P-2480    → NV-CN
 */
function resolveNfbGid(id: string): string | undefined {
  if (id.startsWith('nfb-NFA')) return NFB_SHEET_GIDS['NFA'];
  if (id.startsWith('nfb-BH')) return NFB_SHEET_GIDS['BH'];

  if (id.startsWith('nfb-NF')) {
    if (id.includes('-CN-')) return NFB_SHEET_GIDS['NF-CN'];
    if (id.includes('-SN-')) return NFB_SHEET_GIDS['NF-SN'];
    return undefined;
  }
  // Only match lb-NV* (not arbitrary lb- prefixes)
  if (id.startsWith('lb-NV')) {
    if (id.includes('-CN-')) return NFB_SHEET_GIDS['NV-CN'];
    if (id.includes('-SN-')) return NFB_SHEET_GIDS['NV-SN'];
    return undefined;
  }
  return undefined;
}

/**
 * Resolve 萬蕙昇 conduit record ID to sheet GID
 * IMPORTANT: longer prefixes must be checked before shorter ones
 * (e.g., 'emt-fit-' before 'emt-', 'pvc-fit-' before 'pvc-')
 */
function resolveConduitGid(id: string): string | undefined {
  if (id.startsWith('emt-fit-')) return CONDUIT_SHEET_GIDS['emt-fit'];
  if (id.startsWith('emt-')) return CONDUIT_SHEET_GIDS['emt'];
  if (id.startsWith('ss-pipe-')) return CONDUIT_SHEET_GIDS['ss-pipe'];
  if (id.startsWith('ss-fit-')) return CONDUIT_SHEET_GIDS['ss-fit'];
  if (id.startsWith('rsg-')) return CONDUIT_SHEET_GIDS['rsg'];
  if (id.startsWith('pvc-fit-')) return CONDUIT_SHEET_GIDS['pvc-fit'];
  if (id.startsWith('pvc-')) return CONDUIT_SHEET_GIDS['pvc'];
  return undefined;
}

/** Static website URLs */
const STATIC_URLS: Record<string, string> = {
  樺晟: 'http://www.fc1980.com/'
};

/** Resolve 銘宣 record ID to ASP page path */
function resolveWinsenPath(id: string): string | null {
  // cable-{wireType}-{brand}-{spec}-{cores}
  const stripped = id.replace(/^cable-/, '');
  // Try longest prefix match first (e.g., fr-cv-walsin before cv-walsin)
  const parts = stripped.split('-');
  for (let len = Math.min(parts.length - 2, 3); len >= 1; len--) {
    const key = parts.slice(0, len).join('-');
    if (WINSEN_PAGE_MAP[key]) return WINSEN_PAGE_MAP[key];
  }
  return null;
}

/** Cached session cookie with TTL */
let cachedCookie: { value: string; expiresAt: number } | null = null;

/** Get wire.com.tw session cookie (cached for 8 min, timeout is ~10 min) */
async function getWinsenCookie(): Promise<string> {
  if (cachedCookie && Date.now() < cachedCookie.expiresAt) {
    return cachedCookie.value;
  }
  const cookie = await winsenLogin();
  cachedCookie = { value: cookie, expiresAt: Date.now() + 8 * 60 * 1000 };
  return cookie;
}

/** Login to wire.com.tw, return session cookie */
async function winsenLogin(): Promise<string> {
  const loginId = process.env.WINSEN_LOGIN_ID;
  const password = process.env.WINSEN_PASSWORD;

  if (!loginId || !password) {
    throw new Error('WINSEN credentials not configured');
  }

  const body = `login_id=${encodeURIComponent(loginId)}&password=${encodeURIComponent(password)}&Submit=%B5%A4%J`;

  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (source-proxy/1.0)'
    },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000)
  });

  const setCookieHeaders =
    res.headers.getSetCookie?.() ??
    [res.headers.get('set-cookie')].filter(Boolean);

  if (setCookieHeaders.length === 0) {
    throw new Error('Login failed: no Set-Cookie header');
  }

  return setCookieHeaders
    .map((c) => (c as string).split(';')[0].trim())
    .join('; ');
}

/** Fetch wire.com.tw page with session cookie, decode Big5 → UTF-8 */
async function fetchWinsenPage(path: string, cookie: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${WIRE_BASE}${path}`, {
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0 (source-proxy/1.0)'
      },
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    let html = iconv.decode(buffer, 'big5');

    // Rewrite relative URLs to absolute
    html = html.replace(
      /(src|href|action)=["'](?!http|\/\/|#|javascript)(.*?)["']/gi,
      `$1="${WIRE_BASE}/$2"`
    );

    // Fix charset declaration for browser rendering
    html = html.replace(/charset=big5/gi, 'charset=utf-8');

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

/** Escape HTML special characters */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format number with comma separators */
function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('zh-TW');
}

// ── PCIC live API ──

const PCIC_API_BASE =
  'https://pcic.pcc.gov.tw/pwc-web/api/service/MRP0201R/queryBasic';

interface PcicItem {
  code: string;
  name: string;
  unit: string;
  price: number;
  pxmin: number;
  pxmax: number;
  num: number;
  award_percentage: string;
}

/** Call PCIC queryBasic API (public govt API, valid CA cert) */
function fetchPcicApi(keyword: string): Promise<PcicItem[]> {
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 5);
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/01`;

  const params = new URLSearchParams({
    key_word: keyword,
    isBaseQuery: 'true',
    city_id: '',
    town_id: '',
    pro_scale: 'win1',
    pro_type: '',
    queryAwardPercentage: 'N',
    codes: '',
    account_id: '00000000-0000-0000-0000-000000000000',
    create_id: 'TEST',
    mrpNo: '0201',
    isDefaultBackTime: 'true',
    startmonth: fmtDate(twoYearsAgo),
    endmonth: fmtDate(now),
    backtime: now.toISOString().slice(0, 10)
  });

  const url = `${PCIC_API_BASE}?${params}`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status !== '0') {
            reject(new Error(`PCIC API status: ${json.status}`));
            return;
          }
          resolve((json.response ?? []) as PcicItem[]);
        } catch {
          reject(new Error('Invalid JSON from PCIC API'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('PCIC API timeout'));
    });
  });
}

/** Render PCIC live API results as HTML table */
function renderPcicLiveHtml(
  items: PcicItem[],
  highlightCode: string,
  keyword: string
): string {
  const rows = items
    .map((item) => {
      const isTarget = item.code === highlightCode;
      const cls = isTarget ? ' class="highlight"' : '';
      return `<tr${cls}>
        <td class="mono">${escapeHtml(item.code)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td class="num">$${fmtNum(item.pxmin)}</td>
        <td class="num">$${fmtNum(item.pxmax)}</td>
        <td class="num">${fmtNum(item.num)}</td>
        <td class="num">${escapeHtml(item.award_percentage)}%</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PCIC 即時查詢 — ${escapeHtml(keyword)}</title>
  <style>
    body { font-family: "Noto Sans TC", -apple-system, sans-serif; margin: 0; padding: 16px; background: #f0f4f8; color: #1e293b; font-size: 14px; }
    .header { max-width: 960px; margin: 0 auto 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .header img { height: 28px; }
    .header h1 { font-size: 16px; margin: 0; color: #1e40af; }
    .header a { font-size: 12px; color: #3b82f6; text-decoration: none; margin-left: auto; }
    .meta { max-width: 960px; margin: 0 auto 12px; font-size: 12px; color: #64748b; }
    .meta code { background: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-size: 11px; word-break: break-all; }
    table { max-width: 960px; margin: 0 auto; width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    th { background: #1e40af; color: #fff; padding: 10px 8px; font-size: 12px; font-weight: 500; text-align: left; white-space: nowrap; }
    td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
    .mono { font-family: monospace; font-size: 12px; white-space: nowrap; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .highlight { background: #fef9c3; }
    .highlight td { font-weight: 600; }
    .footer { max-width: 960px; margin: 16px auto 0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>PCIC 公共工程價格資料庫 — 即時查詢</h1>
    <a href="https://pcic.pcc.gov.tw/pwc-web/" target="_blank" rel="noopener">前往 PCIC 網站自行查詢 →</a>
  </div>
  <div class="meta">
    關鍵字：<strong>${escapeHtml(keyword)}</strong>　|
    查詢時間：${escapeHtml(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }))}　|
    結果：${items.length} 筆
  </div>
  <table>
    <thead>
      <tr>
        <th>PCCES 碼</th><th>品名</th><th>單位</th>
        <th style="text-align:right">最低價</th>
        <th style="text-align:right">最高價</th>
        <th style="text-align:right">樣本數</th>
        <th style="text-align:right">決標比</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:20px">查無資料</td></tr>'}</tbody>
  </table>
  <div class="footer">
    資料來源：行政院公共工程委員會 PCIC API（即時查詢，非快取）
  </div>
</body>
</html>`;
}

// ── TCRI session management + page proxy ──

const TCRI_DB_PATH = `${process.env.HOME}/tcri-mcp/data/tcri.db`;
const TCRI_AUTH_PATH = `${process.env.HOME}/tcri-mcp/data/auth-state.json`;
const TCRI_BASE = 'https://ccd.tcri.org.tw';

interface TcriCookie {
  name: string;
  value: string;
  domain: string;
}

let tcriAuthCache: { cookies: TcriCookie[]; loadedAt: number } | null = null;

/** Load TCRI cookies from auth-state.json (cached 5 min) */
function loadTcriCookies(): TcriCookie[] | null {
  if (tcriAuthCache && Date.now() - tcriAuthCache.loadedAt < 5 * 60 * 1000) {
    return tcriAuthCache.cookies;
  }
  try {
    const raw = readFileSync(TCRI_AUTH_PATH, 'utf-8');
    const state = JSON.parse(raw);
    const cookies = (state.cookies ?? []) as TcriCookie[];
    tcriAuthCache = { cookies, loadedAt: Date.now() };
    return cookies;
  } catch {
    return null;
  }
}

/** Build Cookie header for TCRI requests */
function buildTcriCookieHeader(cookies: TcriCookie[]): string {
  return cookies
    .filter((c) => c.domain.replace(/^\./, '') === 'ccd.tcri.org.tw')
    .filter((c) => c.name && typeof c.value === 'string')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

/** Fetch a TCRI page with session cookies, return HTML or expired flag */
async function fetchTcriPage(
  pageUrl: string
): Promise<{ ok: boolean; html?: string; expired?: boolean }> {
  const cookies = loadTcriCookies();
  if (!cookies || cookies.length === 0) {
    return { ok: false, expired: true };
  }
  const cookieHeader = buildTcriCookieHeader(cookies);
  if (!cookieHeader) {
    return { ok: false, expired: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(pageUrl, {
      headers: {
        Cookie: cookieHeader,
        'User-Agent': 'Mozilla/5.0 (source-proxy/1.0)'
      },
      redirect: 'manual',
      signal: controller.signal
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location') || '';
      if (location.includes('/login')) {
        tcriAuthCache = null;
        return { ok: false, expired: true };
      }
    }
    if (res.status !== 200) {
      return { ok: false };
    }

    let html = await res.text();

    // Rewrite relative URLs to absolute for correct rendering
    html = html.replace(
      /(src|href|action)=["'](?!http|\/\/|#|javascript|data:)(.*?)["']/gi,
      (_, attr: string, path: string) => {
        const resolved = path.startsWith('/')
          ? `${TCRI_BASE}${path}`
          : `${TCRI_BASE}/${path}`;
        return `${attr}="${resolved}"`;
      }
    );

    return { ok: true, html };
  } finally {
    clearTimeout(timeout);
  }
}

/** Render friendly error page when TCRI session is expired */
function renderTcriExpiredHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW"><head><meta charset="utf-8"><title>TCRI 連線逾時</title>
<style>body{font-family:"Noto Sans TC",sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f8fafc}
.card{text-align:center;max-width:420px;padding:32px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
h1{font-size:18px;color:#1e293b;margin:0 0 12px}p{font-size:14px;color:#64748b;margin:0 0 8px}
code{background:#f1f5f9;padding:4px 8px;border-radius:4px;font-size:12px}</style></head>
<body><div class="card"><h1>TCRI 營建物價 — 連線逾時</h1>
<p>Session 已過期，需重新登入。</p>
<p>請在伺服器執行：</p>
<code>cd ~/tcri-mcp && pnpm login</code></div></body></html>`;
}

/** Look up TCRI category page URL from tcri.db by pcces_code */
function getTcriCategoryUrl(
  pccesCode: string
): { url: string; category: string } | null {
  try {
    const db = new Database(TCRI_DB_PATH, { readonly: true });
    try {
      const row = db
        .prepare(
          `SELECT c.url, c.name as category
           FROM prices p JOIN categories c ON p.category = c.name
           WHERE p.pcces_code = ? AND c.url IS NOT NULL
           LIMIT 1`
        )
        .get(pccesCode) as { url: string; category: string } | undefined;
      return row ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/**
 * GET /api/prices/source-proxy?source=銘宣&id=cable-iv-walsin-2-1c
 *
 * For 銘宣: auto-login + proxy the price page (Big5→UTF-8)
 * For PCIC: live API query → render full results table
 * For TCRI: server-side proxy with cookie auth (reads auth-state.json)
 * For 茂忠: redirect to m5.com.tw product page
 * For GDrive sources: redirect to Google Sheets
 * For others: redirect to static URL
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const source = searchParams.get('source');
  const id = searchParams.get('id') ?? '';

  if (!source) {
    return NextResponse.json(
      { error: 'Missing source parameter' },
      { status: 400 }
    );
  }

  // ── 銘宣: server-side proxy with auto-login ──
  if (source === '銘宣') {
    const path = resolveWinsenPath(id);
    if (!path) {
      return NextResponse.json(
        { error: `Cannot resolve page for id: ${id}` },
        { status: 400 }
      );
    }

    try {
      const cookie = await getWinsenCookie();
      const html = await fetchWinsenPage(path, cookie);

      return new NextResponse(html, { headers: PROXY_HTML_HEADERS });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        { error: `銘宣 proxy failed: ${msg}` },
        { status: 502 }
      );
    }
  }

  // ── PCIC: live API query → render results table ──
  if (source === 'PCIC') {
    if (!id || id.length > 200) {
      return NextResponse.json({ error: 'Invalid record ID' }, { status: 400 });
    }
    try {
      // Get keyword and code from our DB record
      const rows = await sql`
        SELECT specs FROM prices WHERE id = ${id} LIMIT 1
      `;
      if (rows.length === 0) {
        return NextResponse.json(
          { error: `Record not found: ${id}` },
          { status: 404 }
        );
      }
      const specs = rows[0].specs as Record<string, unknown>;
      const code = String(specs.code ?? '');
      const keyword = String(specs.keyword ?? '');

      if (!code) {
        return NextResponse.json(
          { error: 'Record has no PCCES code' },
          { status: 400 }
        );
      }

      // Call PCIC API live — search by PCCES code for precise match
      const items = await fetchPcicApi(code);
      const html = renderPcicLiveHtml(items, code, keyword || code);

      return new NextResponse(html, { headers: PROXY_HTML_HEADERS });
    } catch (err) {
      console.error('PCIC proxy error:', err);
      return NextResponse.json({ error: 'PCIC query failed' }, { status: 502 });
    }
  }

  // ── TCRI: server-side proxy with cookie auth (like 銘宣) ──
  if (source === 'TCRI') {
    if (!id || id.length > 200) {
      return NextResponse.json({ error: 'Invalid record ID' }, { status: 400 });
    }
    try {
      const rows = await sql`
        SELECT specs FROM prices WHERE id = ${id} LIMIT 1
      `;
      if (rows.length === 0) {
        return NextResponse.json(
          { error: `Record not found: ${id}` },
          { status: 404 }
        );
      }
      const specs = rows[0].specs as Record<string, unknown>;
      const pccesCode = String(specs.pcces_code ?? '');
      const period = String(specs.period ?? '');
      const periodNum = period.replace(/\D/g, '').slice(0, 20);

      const cat = pccesCode ? getTcriCategoryUrl(pccesCode) : null;
      if (!cat) {
        return NextResponse.json(
          { error: 'Category not found for this record' },
          { status: 404 }
        );
      }
      if (!cat.url.startsWith(`${TCRI_BASE}/`)) {
        return NextResponse.json(
          { error: 'Invalid category URL in database' },
          { status: 500 }
        );
      }

      const pageUrl = periodNum
        ? `${cat.url}?announce=R${periodNum}&search_per_page=50`
        : cat.url;

      const result = await fetchTcriPage(pageUrl);

      if (result.expired) {
        return new NextResponse(renderTcriExpiredHtml(), {
          headers: PROXY_HTML_HEADERS,
          status: 503
        });
      }
      if (!result.ok || !result.html) {
        return NextResponse.json(
          { error: 'TCRI fetch failed' },
          { status: 502 }
        );
      }

      return new NextResponse(result.html, { headers: PROXY_HTML_HEADERS });
    } catch (err) {
      console.error('TCRI proxy error:', err);
      return NextResponse.json({ error: 'TCRI query failed' }, { status: 502 });
    }
  }

  // ── 茂忠: dynamic product page redirect ──
  if (source === '茂忠') {
    const productId = id.replace(/^m5-/, '');
    if (!/^[\w-]+$/.test(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }
    return NextResponse.redirect(
      `https://www.m5.com.tw/product/${encodeURIComponent(productId)}`
    );
  }

  // ── GDrive sources: redirect to Google Sheets with deep link ──
  const gdriveSheet = GDRIVE_SHEETS[source];
  if (gdriveSheet) {
    let url = `https://docs.google.com/spreadsheets/d/${gdriveSheet.fileId}/edit`;
    let gid: string | undefined;

    if (source === '鍾榮') {
      gid = resolveZhongrongGid(id);
    } else if (source === '朝立' || source === '三菱電機') {
      gid = resolveNfbGid(id);
    } else if (source === '萬蕙昇') {
      gid = resolveConduitGid(id);
    } else if (source === '信佳電機') {
      gid = TRANSFORMER_GID;
    }
    // 東元電機: uses own series names (TCB/TG/TO/TLB) — no deep link possible

    if (gid && /^\d+$/.test(gid)) url += `#gid=${gid}`;
    return NextResponse.redirect(url);
  }

  // ── Static URLs: redirect ──
  const staticUrl = STATIC_URLS[source];
  if (staticUrl) {
    return NextResponse.redirect(staticUrl);
  }

  return NextResponse.json(
    { error: `Unknown source: ${source}` },
    { status: 404 }
  );
}

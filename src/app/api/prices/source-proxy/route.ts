import { NextRequest, NextResponse } from 'next/server';
import iconv from 'iconv-lite';
import { sql } from '@/lib/db';

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
    redirect: 'manual'
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

/** Render PCIC price record as HTML info card */
function renderPcicHtml(record: {
  id: string;
  sell_price: number | null;
  specs: Record<string, unknown>;
}): string {
  const s = record.specs;
  const code = String(s.code ?? '');
  const name = String(s.name ?? '');
  const unit = String(s.unit ?? '');
  const priceMin = s.price_min as number | null;
  const priceMax = s.price_max as number | null;
  const sampleCount = s.sample_count as number | null;
  const awardPct = s.award_percentage as number | null;
  const queryStart = String(s.query_start ?? '');
  const queryEnd = String(s.query_end ?? '');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PCIC 公共工程價格 — ${escapeHtml(code)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 20px; background: #f8fafc; color: #1e293b; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; }
    .badge { display: inline-block; background: #3b82f6; color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 4px; margin-bottom: 12px; }
    h1 { font-size: 16px; margin: 0 0 8px; line-height: 1.5; }
    .code { color: #64748b; font-family: monospace; font-size: 13px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
    td:first-child { color: #64748b; width: 120px; }
    td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .price { font-size: 18px; font-weight: 700; color: #059669; }
    .footer { margin-top: 16px; font-size: 11px; color: #94a3b8; text-align: center; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">PCIC 公共工程價格資料庫</span>
    <h1>${escapeHtml(name)}</h1>
    <div class="code">${escapeHtml(code)}</div>
    <table>
      <tr><td>單位</td><td>${escapeHtml(unit)}</td></tr>
      <tr><td>最低價</td><td class="price">$${fmtNum(priceMin)}</td></tr>
      <tr><td>最高價</td><td>$${fmtNum(priceMax)}</td></tr>
      <tr><td>樣本數</td><td>${fmtNum(sampleCount)} 筆</td></tr>
      <tr><td>決標比</td><td>${awardPct != null ? `${awardPct}%` : '—'}</td></tr>
      <tr><td>查詢區間</td><td>${escapeHtml(queryStart)} ~ ${escapeHtml(queryEnd)}</td></tr>
    </table>
    <div class="footer">
      資料來源：<a href="https://pcic.pcc.gov.tw/pwc-web/" target="_blank" rel="noopener">行政院公共工程委員會</a>
    </div>
  </div>
</body>
</html>`;
}

/** Render TCRI price record as HTML info card */
function renderTcriHtml(record: {
  id: string;
  sell_price: number | null;
  specs: Record<string, unknown>;
}): string {
  const s = record.specs;
  const code = String(s.pcces_code ?? '');
  const name = String(s.name ?? '');
  const unit = String(s.unit ?? '');
  const period = String(s.period ?? '');
  const priceNorth = s.price_north as number | null;
  const priceCentral = s.price_central as number | null;
  const priceSouth = s.price_south as number | null;
  const priceEast = s.price_east as number | null;

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TCRI 營建物價 — ${escapeHtml(code)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 20px; background: #f8fafc; color: #1e293b; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; }
    .badge { display: inline-block; background: #f59e0b; color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 4px; margin-bottom: 12px; }
    h1 { font-size: 16px; margin: 0 0 8px; line-height: 1.5; }
    .code { color: #64748b; font-family: monospace; font-size: 13px; }
    .period { color: #64748b; font-size: 13px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
    td:first-child { color: #64748b; width: 120px; }
    td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .price { font-weight: 700; color: #059669; }
    .footer { margin-top: 16px; font-size: 11px; color: #94a3b8; text-align: center; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">TCRI 營建物價</span>
    <h1>${escapeHtml(name)}</h1>
    <div class="code">${escapeHtml(code)}</div>
    <div class="period">${escapeHtml(period)}</div>
    <table>
      <tr><td>單位</td><td>${escapeHtml(unit)}</td></tr>
      <tr><td>北部</td><td class="price">$${fmtNum(priceNorth)}</td></tr>
      <tr><td>中部</td><td class="price">$${fmtNum(priceCentral)}</td></tr>
      <tr><td>南部</td><td class="price">$${fmtNum(priceSouth)}</td></tr>
      <tr><td>東部</td><td class="price">$${fmtNum(priceEast)}</td></tr>
    </table>
    <div class="footer">
      資料來源：<a href="https://www.tcri.org.tw/" target="_blank" rel="noopener">台灣營建研究院</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * GET /api/prices/source-proxy?source=銘宣&id=cable-iv-walsin-2-1c
 *
 * For 銘宣: auto-login + proxy the price page (Big5→UTF-8)
 * For PCIC/TCRI: query DB + render HTML info card
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

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'private, max-age=300'
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        { error: `銘宣 proxy failed: ${msg}` },
        { status: 502 }
      );
    }
  }

  // ── PCIC / TCRI: query DB + render HTML info card ──
  if (source === 'PCIC' || source === 'TCRI') {
    if (!id || id.length > 200) {
      return NextResponse.json({ error: 'Invalid record ID' }, { status: 400 });
    }
    try {
      const rows = await sql`
        SELECT id, sell_price, specs FROM prices WHERE id = ${id} LIMIT 1
      `;
      if (rows.length === 0) {
        return NextResponse.json(
          { error: `Record not found: ${id}` },
          { status: 404 }
        );
      }
      const record = rows[0] as {
        id: string;
        sell_price: number | null;
        specs: Record<string, unknown>;
      };
      const html =
        source === 'PCIC' ? renderPcicHtml(record) : renderTcriHtml(record);

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'private, max-age=3600'
        }
      });
    } catch (err) {
      console.error(`${source} proxy error for id=${id}:`, err);
      return NextResponse.json(
        { error: `${source} query failed` },
        { status: 502 }
      );
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

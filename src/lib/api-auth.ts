import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * API 認證 + CSRF 防護（單人開發工具）
 *
 * 策略：
 * - 瀏覽器請求（有 Origin/Referer）：必須在 allowlist 中（CSRF 防護）
 * - 非瀏覽器請求（無 Origin/Referer）：必須帶 x-api-key（API 認證）
 * - 開發環境 localhost：自動放行
 */

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4103'
];

function getAllowedOrigins(): string[] {
  const envOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .filter(Boolean);
  return [...envOrigins, ...DEV_ORIGINS];
}

function hasBrowserHeaders(request: Request): boolean {
  return !!(request.headers.get('origin') || request.headers.get('referer'));
}

function validateOrigin(request: Request): boolean {
  const allowedOrigins = getAllowedOrigins();
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (origin && allowedOrigins.includes(origin)) return true;

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (allowedOrigins.includes(refOrigin)) return true;
    } catch {
      /* invalid URL */
    }
  }

  return false;
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  const maxLen = Math.max(bufA.length, bufB.length);
  const padA = Buffer.alloc(maxLen);
  const padB = Buffer.alloc(maxLen);
  bufA.copy(padA);
  bufB.copy(padB);
  return bufA.length === bufB.length && timingSafeEqual(padA, padB);
}

function validateApiKey(request: Request): boolean {
  const key = request.headers.get('x-api-key');
  const expected = process.env.INTERNAL_API_KEY;
  if (!key || !expected) return false;
  return safeCompare(key, expected);
}

function isLocalhost(request: Request): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  const host = request.headers.get('host');
  return !!host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

/**
 * 寫入路由的認證檢查。回傳 null 表示通過，否則回傳 403 Response。
 *
 * 邏輯：
 * 1. 開發環境 localhost → 放行
 * 2. 有 Origin/Referer（瀏覽器）→ 必須在 allowlist
 * 3. 無 Origin/Referer（server-to-server）→ 必須有 API key
 */
export function requireWriteAuth(request: Request): NextResponse | null {
  if (isLocalhost(request)) return null;

  // 瀏覽器請求：驗證 Origin allowlist（CSRF 防護）
  if (hasBrowserHeaders(request)) {
    if (validateOrigin(request)) return null;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 非瀏覽器請求：必須有 API key
  if (validateApiKey(request)) return null;

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

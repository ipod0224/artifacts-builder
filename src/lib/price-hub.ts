/**
 * price-hub SQLite 連線層（read-only singleton）
 *
 * price-hub 聚合 13 源 16,000+ 價格紀錄，
 * Dashboard 僅讀取，ETL 由獨立排程寫入。
 * WAL 由 ETL 寫入端設定，reader 不設定 journal_mode。
 *
 * 安全設計：
 * - readonly: true（防止意外寫入）
 * - mtime 偵測（ETL 更新後自動重建連線）
 * - 健康檢查（SELECT 1）確認連線可用
 * - DB 路徑限制在 HOME/price-hub/ 下
 */

import Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const HOME = process.env.HOME || '/tmp';
const DEFAULT_DB_DIR = resolve(HOME, 'price-hub/data');

function resolveDbPath(): string {
  const raw =
    process.env.PRICE_HUB_DB || resolve(DEFAULT_DB_DIR, 'price-compare.db');
  const resolved = resolve(raw);

  // 限制 DB 路徑在允許範圍內（防止 env var 路徑穿越）
  if (!resolved.startsWith(DEFAULT_DB_DIR) && !resolved.startsWith('/tmp/')) {
    throw new Error('Invalid database path configuration');
  }

  return resolved;
}

const DB_PATH = resolveDbPath();

let _db: Database.Database | null = null;
let _dbMtime = 0;

function getDb(): Database.Database {
  if (!existsSync(DB_PATH)) {
    _db = null;
    throw new Error('Price-hub database is not available');
  }

  const currentMtime = statSync(DB_PATH).mtimeMs;

  // DB 檔案已被 ETL 替換，重建連線
  if (_db && currentMtime !== _dbMtime) {
    try {
      _db.close();
    } catch {
      /* ignore close errors */
    }
    _db = null;
  }

  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true });
    _dbMtime = currentMtime;
    // 健康檢查：確認連線可用
    _db.prepare('SELECT 1').get();
  }

  return _db;
}

export { getDb as priceHubDb };

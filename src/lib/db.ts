/**
 * PostgreSQL Client - 直連 tmw-postgres (port 4202)
 *
 * 使用方式：
 *   import { sql } from '@/lib/db'
 */

import postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;

let _sql: Sql | null = null;

function getSQL(): Sql {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  _sql = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  return _sql;
}

/**
 * Lazy-initialised Postgres tagged-template client.
 * Defers the DATABASE_URL check to first invocation (runtime),
 * so Vercel builds succeed without the env var.
 */
export const sql: Sql = new Proxy((() => {}) as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    return (getSQL() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    return Reflect.get(getSQL(), prop);
  }
});

// 類型定義

export interface DocumentMetadata {
  source: string;
  category:
    | 'regulations'
    | 'technical'
    | 'knowledge'
    | 'business'
    | 'communication'
    | 'data'
    | 'general';
  content_type: string;
  doc_type: string;
  file_hash?: string;
  chunk_index: number;
  total_chunks: number;
  is_last_chunk?: boolean;
  job_id?: string;
  embedding_model?: string;
}

export interface Document {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: DocumentMetadata;
  created_at: string;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  price: number;
  category?: string;
  spec?: string;
  voltage?: number;
  updated_at: string;
}

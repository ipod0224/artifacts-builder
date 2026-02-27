/**
 * PostgreSQL Client - 直連 tmw-postgres (port 4202)
 *
 * 使用方式：
 *   import { sql } from '@/lib/db'
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10
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

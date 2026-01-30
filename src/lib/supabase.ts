/**
 * Supabase Client - 連接地端 Supabase
 *
 * 使用方式：
 *   import { supabase } from '@/lib/supabase'
 */

import { createClient } from '@supabase/supabase-js';

// 地端 Supabase 預設值（supabase start 後取得）
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
// Supabase CLI 本地開發預設 anon key（非敏感資料）
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// 類型定義（與 ai-workflow 後端一致）
export interface Document {
  id: string;
  content: string;
  source: string;
  chunk_idx: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Regulation {
  id: string;
  content: string;
  source: string;
  article_no?: string;
  chunk_idx: number;
  embedding?: number[];
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

-- qa_rules: RAG 規則型 Q&A 資料表
-- 儲存 10,003 條結構化對答規則，支援關鍵字 GIN + 向量 cosine 搜尋

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS qa_rules (
  id          SERIAL PRIMARY KEY,
  rule_id     INTEGER NOT NULL UNIQUE,
  type        VARCHAR(32) NOT NULL,
  subtype     VARCHAR(64),
  query       TEXT NOT NULL,
  rule        JSONB NOT NULL,
  keywords    TEXT[] NOT NULL,
  embedding   vector(1024),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE qa_rules IS 'RAG 規則型 Q&A v10.1, 10003 rules, 8 types';

-- Layer 1: 關鍵字 GIN (array overlap)
CREATE INDEX IF NOT EXISTS idx_qa_rules_keywords_gin
  ON qa_rules USING GIN (keywords);

-- Layer 2: 向量 ivfflat (cosine)
CREATE INDEX IF NOT EXISTS idx_qa_rules_embedding_ivfflat
  ON qa_rules USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 過濾加速
CREATE INDEX IF NOT EXISTS idx_qa_rules_type
  ON qa_rules (type);

CREATE INDEX IF NOT EXISTS idx_qa_rules_type_subtype
  ON qa_rules (type, subtype);

-- JSONB 查詢
CREATE INDEX IF NOT EXISTS idx_qa_rules_rule_gin
  ON qa_rules USING GIN (rule);

-- trigram 模糊搜尋
CREATE INDEX IF NOT EXISTS idx_qa_rules_query_trgm
  ON qa_rules USING GIN (query gin_trgm_ops);

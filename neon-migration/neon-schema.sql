-- Neon PostgreSQL schema
-- 先啟用 extensions（Neon 支援 pgvector + pg_trgm）

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- documents
CREATE TABLE IF NOT EXISTS documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    content text NOT NULL,
    embedding vector(1024),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- materials
CREATE TABLE IF NOT EXISTS materials (
    code text NOT NULL PRIMARY KEY,
    category text,
    name text,
    spec text,
    unit text,
    unit_price integer,
    updated_at timestamp with time zone DEFAULT now(),
    embedding vector(1024)
);

-- qa_rules
CREATE TABLE IF NOT EXISTS qa_rules (
    id serial PRIMARY KEY,
    rule_id integer NOT NULL UNIQUE,
    type varchar(32) NOT NULL,
    subtype varchar(64),
    query text NOT NULL,
    rule jsonb NOT NULL,
    keywords text[] NOT NULL,
    embedding vector(1024),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE qa_rules IS 'RAG 規則型 Q&A v10.1, 10003 rules, 8 types';

-- Indexes
CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);

CREATE INDEX IF NOT EXISTS idx_qa_rules_embedding_ivfflat
    ON qa_rules USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);

CREATE INDEX IF NOT EXISTS idx_qa_rules_keywords_gin
    ON qa_rules USING gin (keywords);

CREATE INDEX IF NOT EXISTS idx_qa_rules_query_trgm
    ON qa_rules USING gin (query gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_qa_rules_rule_gin
    ON qa_rules USING gin (rule);

CREATE INDEX IF NOT EXISTS idx_qa_rules_type
    ON qa_rules USING btree (type);

CREATE INDEX IF NOT EXISTS idx_qa_rules_type_subtype
    ON qa_rules USING btree (type, subtype);

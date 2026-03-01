-- 回滾：刪除 qa_rules 表及所有索引
DROP INDEX IF EXISTS idx_qa_rules_query_trgm;
DROP INDEX IF EXISTS idx_qa_rules_rule_gin;
DROP INDEX IF EXISTS idx_qa_rules_type_subtype;
DROP INDEX IF EXISTS idx_qa_rules_type;
DROP INDEX IF EXISTS idx_qa_rules_embedding_ivfflat;
DROP INDEX IF EXISTS idx_qa_rules_keywords_gin;
DROP TABLE IF EXISTS qa_rules;

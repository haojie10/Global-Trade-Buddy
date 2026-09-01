-- rollback_research_tasks.sql
-- 一键回滚 research_tasks 相关表及索引

DROP TABLE IF EXISTS research_tasks CASCADE;

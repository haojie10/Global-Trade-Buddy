-- 为 research_tasks 增加 tag 调度标签字段
ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS tag VARCHAR(50);

-- 为 tag 字段创建索引以优化多 Agent 标签化调度抢单性能
CREATE INDEX IF NOT EXISTS idx_research_tasks_tag ON research_tasks(tag);

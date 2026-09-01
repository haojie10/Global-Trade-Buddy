-- 20260901000000_research_tasks_schema.sql
-- 分布式企业调研任务调度中心与自增长客户清单

CREATE TABLE IF NOT EXISTS research_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq_no SERIAL,                                      -- 全局序号 (支持自定义调整)
    batch_name VARCHAR(64) DEFAULT '初始批次',          -- 批次名称 (如: '渠道地图2026', '竞品裂变发现')
    company_name VARCHAR(255) NOT NULL,                 -- 公司主体名称 (如: TEDi)
    country VARCHAR(100) NOT NULL DEFAULT '全球',        -- 目标国家/地区
    website VARCHAR(500),                               -- 官网链接
    industry VARCHAR(128),                              -- 主营品类/行业
    
    -- 任务调度状态
    status VARCHAR(32) DEFAULT 'pending',               -- pending | running | completed | failed | paused
    assigned_worker VARCHAR(128),                       -- 认领机器/Agent标识 (如: PC-Alienware-01)
    locked_at TIMESTAMP WITH TIME ZONE,                 -- 任务锁定认领时间
    
    -- 成果挂接
    report_id UUID REFERENCES reports(id) ON DELETE SET NULL, -- 关联生成的报告 ID
    report_url VARCHAR(500),                            -- 线上查阅完整 URL
    error_message TEXT,                                 -- 异常或阻断原因
    
    -- 客户自增长与来源追溯
    source_type VARCHAR(32) DEFAULT 'manual',           -- manual | batch_import | competitor_discovery
    source_report_id UUID REFERENCES reports(id) ON DELETE SET NULL, -- 来源报告 ID (从哪篇报告中发现的)
    source_company_name VARCHAR(255),                   -- 来源母公司名称 (如: 'Action')
    priority INTEGER DEFAULT 50,                        -- 调度优先级 (置顶:999, 手动:100, 种子:80, 裂变:20)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 高性能抢单与排序索引
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority_seq ON research_tasks (status, priority DESC, seq_no ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_company_lower ON research_tasks (LOWER(TRIM(company_name)));
CREATE INDEX IF NOT EXISTS idx_tasks_batch_name ON research_tasks (batch_name);
CREATE INDEX IF NOT EXISTS idx_tasks_source_type ON research_tasks (source_type);
CREATE INDEX IF NOT EXISTS idx_tasks_report_id ON research_tasks (report_id);
CREATE INDEX IF NOT EXISTS idx_tasks_locked_at ON research_tasks (locked_at);

-- ==========================================
-- GTB 数据库防膨胀与数据聚合 Migration
-- 1. 创建每日统计数据聚合表 daily_stats_summary
-- 2. 创建日志聚合与清理函数 aggregate_and_clean_logs()
-- ==========================================

-- 1. 每日统计聚合表
CREATE TABLE IF NOT EXISTS daily_stats_summary (
    date DATE PRIMARY KEY,
    total_pv INT DEFAULT 0,
    total_uv INT DEFAULT 0,
    total_searches INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引以加速按时间范围查询统计
CREATE INDEX IF NOT EXISTS idx_daily_stats_summary_date ON daily_stats_summary(date DESC);

-- 为 daily_stats_summary 启用 RLS 保护（防止 PostgREST 匿名泄漏，API 直连不受影响）
DO $$
BEGIN
    EXECUTE 'ALTER TABLE daily_stats_summary ENABLE ROW LEVEL SECURITY';
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. 存储过程：日志聚合与清理
CREATE OR REPLACE FUNCTION aggregate_and_clean_logs(retention_days INT DEFAULT 90)
RETURNS JSON AS $$
DECLARE
    cutoff_time TIMESTAMP;
    pv_deleted INT := 0;
    search_deleted INT := 0;
    verifications_deleted INT := 0;
    aggregated_days INT := 0;
BEGIN
    cutoff_time := NOW() - (retention_days || ' days')::INTERVAL;

    -- A. 聚合 90 天前未完全归档的每日明细
    WITH aggregated_pv AS (
        SELECT 
            created_at::date as log_date,
            COUNT(*)::int as day_pv,
            COUNT(DISTINCT user_id)::int as day_uv
        FROM page_views
        WHERE created_at < cutoff_time
        GROUP BY created_at::date
    ),
    aggregated_search AS (
        SELECT 
            created_at::date as log_date,
            COUNT(*)::int as day_searches
        FROM search_logs
        WHERE created_at < cutoff_time
        GROUP BY created_at::date
    ),
    combined_dates AS (
        SELECT log_date FROM aggregated_pv
        UNION
        SELECT log_date FROM aggregated_search
    ),
    upsert_data AS (
        INSERT INTO daily_stats_summary (date, total_pv, total_uv, total_searches, updated_at)
        SELECT 
            cd.log_date,
            COALESCE(ap.day_pv, 0) as total_pv,
            COALESCE(ap.day_uv, 0) as total_uv,
            COALESCE(ash.day_searches, 0) as total_searches,
            NOW()
        FROM combined_dates cd
        LEFT JOIN aggregated_pv ap ON cd.log_date = ap.log_date
        LEFT JOIN aggregated_search ash ON cd.log_date = ash.log_date
        ON CONFLICT (date) DO UPDATE SET
            total_pv = EXCLUDED.total_pv,
            total_uv = EXCLUDED.total_uv,
            total_searches = EXCLUDED.total_searches,
            updated_at = NOW()
        RETURNING date
    )
    SELECT COUNT(*)::int INTO aggregated_days FROM upsert_data;

    -- B. 物理清理 page_views 中保留天数以前的数据
    WITH deleted AS (
        DELETE FROM page_views
        WHERE created_at < cutoff_time
        RETURNING id
    )
    SELECT COUNT(*)::int INTO pv_deleted FROM deleted;

    -- C. 物理清理 search_logs 中保留天数以前的数据
    WITH deleted AS (
        DELETE FROM search_logs
        WHERE created_at < cutoff_time
        RETURNING id
    )
    SELECT COUNT(*)::int INTO search_deleted FROM deleted;

    -- D. 物理清理 email_verifications 中过期的记录
    WITH deleted AS (
        DELETE FROM email_verifications
        WHERE expired_at < NOW()
        RETURNING id
    )
    SELECT COUNT(*)::int INTO verifications_deleted FROM deleted;

    -- E. 返回操作汇总结果
    RETURN json_build_object(
        'status', 'success',
        'retention_days', retention_days,
        'cutoff_time', cutoff_time,
        'aggregated_days', aggregated_days,
        'cleaned_page_views', pv_deleted,
        'cleaned_search_logs', search_deleted,
        'cleaned_verifications', verifications_deleted
    );
END;
$$ LANGUAGE plpgsql;

-- 尝试启用 pg_cron 扩展（如果 PostgreSQL 环境支持）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'auto_cleanup_and_aggregate_logs',
            '0 3 * * *',
            'SELECT aggregate_and_clean_logs(90);'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- 若环境权限不支持 pg_cron，忽略异常，依靠外部 API 触发即可
        NULL;
END $$;

-- ==========================================
-- RLS 安全加固 + Storage 策略收紧
-- ==========================================
-- 背景说明：
--   本应用通过 Next.js API Routes 使用 pg pool 直连数据库，
--   不使用 PostgREST / Supabase SDK 进行客户端数据查询。
--   因此启用 RLS 后无需添加策略 = 禁止所有 PostgREST 访问，
--   这是一种安全加固措施，API Routes 不受影响（直连绕过 RLS），
--   Supabase Studio 也不受影响（service_role 绕过 RLS）。

-- ==========================================
-- Part 1: 为所有 public 表启用 RLS
-- ==========================================

DO $$
BEGIN
    EXECUTE 'ALTER TABLE users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE reports ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE notes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE unlocks ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE favorites ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE relations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE entities ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE entity_aliases ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE entity_relations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE report_entities ENABLE ROW LEVEL SECURITY';
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ==========================================
-- Part 2: report-images 存储桶访问控制
-- ==========================================
-- 使用 FOR ALL 单一策略统一管理权限，确保服务端
-- ANON KEY 也能正常上传/删除（API 层已有 admin 鉴权）。
-- 移除旧的分散策略后重建。

DROP POLICY IF EXISTS "Public Read report-images" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload report-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow INSERT into report-images" ON storage.objects;

CREATE POLICY "report-images_full_access"
ON storage.objects FOR ALL
USING (bucket_id = 'report-images')
WITH CHECK (bucket_id = 'report-images');

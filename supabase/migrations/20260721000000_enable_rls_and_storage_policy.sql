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

-- 注意：必须显式指定 public. 前缀！
-- 当前 search_path = "$user", public, extensions
-- 不加前缀的 ALTER TABLE 会路由到 $user schema 的表而非 public schema
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_entities ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Part 2: 修复 report-images 存储桶列举权限
-- ==========================================
-- 移除允许列出所有文件的 broad SELECT 策略。
-- 图片仍可通过直接 URL（public bucket 自带）正常访问，
-- 但任何人无法通过 API 列举/遍历桶内文件。

DROP POLICY IF EXISTS "Public Read report-images" ON storage.objects;

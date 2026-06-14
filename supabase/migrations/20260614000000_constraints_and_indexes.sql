-- ==========================================
-- 数据完整性约束
-- ==========================================

-- relations 表唯一约束：防止同一对报告+关联词重复建边
-- 注意：如果现有数据中已有重复行，请先执行：
--   DELETE FROM relations WHERE id NOT IN (
--     SELECT MIN(id) FROM relations GROUP BY report_id_a, report_id_b, relation_key
--   );
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'relations_unique'
  ) THEN
    ALTER TABLE relations ADD CONSTRAINT relations_unique
      UNIQUE (report_id_a, report_id_b, relation_key);
  END IF;
END$$;

-- notes 表唯一约束：一个用户对一篇报告只能有一条笔记
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notes_user_report_unique'
  ) THEN
    ALTER TABLE notes ADD CONSTRAINT notes_user_report_unique
      UNIQUE (user_id, report_id);
  END IF;
END$$;

-- ==========================================
-- 高频查询性能索引
-- ==========================================

-- unlocks 表：按用户查询已解锁报告（graph.ts JOIN unlocks）
CREATE INDEX IF NOT EXISTS idx_unlocks_user_id ON unlocks(user_id);

-- unlocks 表：按报告查询谁解锁了（report-detail.ts）
CREATE INDEX IF NOT EXISTS idx_unlocks_report_id ON unlocks(report_id);

-- favorites 表：查询用户收藏列表
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- notes 表：按用户+报告定位笔记（note.ts 核心查询）
CREATE INDEX IF NOT EXISTS idx_notes_user_report ON notes(user_id, report_id);

-- relations 表：查询报告 A 端的所有关系边
CREATE INDEX IF NOT EXISTS idx_relations_report_id_a ON relations(report_id_a);

-- relations 表：查询报告 B 端的所有关系边
CREATE INDEX IF NOT EXISTS idx_relations_report_id_b ON relations(report_id_b);

-- reports 表：按类型筛选报告（首页分类列表）
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);

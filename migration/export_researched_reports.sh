#!/usr/bin/env bash
# ==============================================================================
# 在服务器上执行：导出所有已调研报告的域名与主体名
# ==============================================================================

set -e

sudo -u postgres psql -d postgres -t -A -F"," -c "
SELECT 
  LOWER(SUBSTRING(content_html FROM 'company_website[\"\'\'][^>]*?content=[\"\'\']https?://(?:www\.)?([^/\"\'\'\s]+)')) AS domain,
  LOWER(REGEXP_REPLACE(
    REGEXP_REPLACE(COALESCE(SUBSTRING(content_html FROM 'company_name[\"\'\'][^>]*?content=[\"\'\']([^\"\'\'\s]+)'), SPLIT_PART(title, ' - ', 1)), 
    '\b(ltd|limited|inc|incorporated|corp|corporation|llc|gmbh|sa|srl|bv|co\.?,\s*ltd\.?|co\.?)\b', '', 'gi'),
    '[^a-zA-Z0-9\u4e00-\u9fa5]+', ' ', 'g'
  )) AS clean_name
FROM reports
WHERE content_html IS NOT NULL;
" > /home/ubuntu/Global-Trade-Buddy/migration/researched_reports.csv

echo "✅ 已导出已调研报告列表至: /home/ubuntu/Global-Trade-Buddy/migration/researched_reports.csv"

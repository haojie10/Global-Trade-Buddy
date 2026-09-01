import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { cleanCompanyName } from '../../../../lib/competitor-discoverer';

interface TaskInputItem {
  seq_no?: number;
  company_name: string;
  country?: string;
  website?: string;
  industry?: string;
  priority?: number;
}

/**
 * 解析 Markdown 表格文本
 * 例如:
 * | 序号 | 公司名称 | 公司国家 | 公司网站 | 状态 |
 * | 1 | Edeka | 德国 | https://edeka.de | 调研完毕 |
 */
function parseMarkdownTable(mdText: string): TaskInputItem[] {
  const lines = mdText.split('\n').map(l => l.trim()).filter(Boolean);
  const items: TaskInputItem[] = [];

  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---|---') || line.includes('公司名称')) {
      continue;
    }
    const cols = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cols.length >= 2) {
      // 假设结构为 [序号, 公司名称, 国家, 网站, 状态]
      const seqNo = parseInt(cols[0], 10);
      const companyName = cols[1];
      const country = cols[2] || '全球';
      const website = cols[3] || '';
      
      if (companyName) {
        items.push({
          seq_no: !isNaN(seqNo) ? seqNo : undefined,
          company_name: companyName,
          country,
          website: website.startsWith('http') ? website : (website ? `https://${website}` : undefined),
        });
      }
    }
  }

  return items;
}

async function importTasksHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  const {
    batch_name = '手动导入批次',
    tasks = [],
    markdown_text = '',
    priority = 100 // 手动导入默认高优先级
  } = req.body || {};

  let inputItems: TaskInputItem[] = [];

  if (Array.isArray(tasks) && tasks.length > 0) {
    inputItems = tasks;
  } else if (typeof markdown_text === 'string' && markdown_text.trim()) {
    inputItems = parseMarkdownTable(markdown_text);
  }

  if (inputItems.length === 0) {
    return res.status(400).json({ error: 'No valid task items provided for import' });
  }

  try {
    await dbClient.query('BEGIN');

    const added: { company_name: string; seq_no?: number; status: string }[] = [];
    const skipped: { company_name: string; reason: string }[] = [];

    // 获取当前最大的 seq_no
    const maxSeqRes = await dbClient.query('SELECT COALESCE(MAX(seq_no), 0) AS max_seq FROM research_tasks');
    let currentSeq = parseInt(maxSeqRes.rows[0].max_seq, 10);

    for (const item of inputItems) {
      const rawName = item.company_name;
      const cleanName = cleanCompanyName(rawName);

      if (!cleanName) {
        skipped.push({ company_name: rawName || '空名称', reason: '名称不合法或为空' });
        continue;
      }

      const compLower = cleanName.toLowerCase();

      // 1. 检查是否在任务池中已存在
      const taskCheck = await dbClient.query(
        'SELECT id, seq_no, status FROM research_tasks WHERE LOWER(TRIM(company_name)) = $1 LIMIT 1',
        [compLower]
      );

      if (taskCheck.rows.length > 0) {
        skipped.push({
          company_name: cleanName,
          reason: `任务池中已存在 (#${taskCheck.rows[0].seq_no} 状态: ${taskCheck.rows[0].status})`
        });
        continue;
      }

      // 2. 检查 reports 表中是否已有已发布的客户报告
      const reportCheck = await dbClient.query(
        `SELECT r.id, r.title 
         FROM reports r
         LEFT JOIN report_entities re ON r.id = re.report_id AND re.role = 'primary'
         LEFT JOIN entities e ON re.entity_id = e.id
         LEFT JOIN entity_aliases ea ON e.id = ea.entity_id
         WHERE r.category = 'customer' 
           AND (
             LOWER(e.canonical_name) = $1 
             OR LOWER(ea.alias_name) = $1
             OR LOWER(r.title) LIKE $2
           )
         LIMIT 1`,
        [compLower, `%${compLower}%`]
      );

      let taskStatus = 'pending';
      let reportId: string | null = null;
      let reportUrl: string | null = null;

      if (reportCheck.rows.length > 0) {
        // 已有历史报告，自动关联为已完成状态
        taskStatus = 'completed';
        reportId = reportCheck.rows[0].id;
        reportUrl = `https://marketgraphic.cn/reports/${reportId}`;
      }

      const assignSeq = item.seq_no !== undefined && item.seq_no > 0 ? item.seq_no : ++currentSeq;
      const finalPriority = item.priority !== undefined ? item.priority : priority;

      await dbClient.query(
        `INSERT INTO research_tasks (
          seq_no,
          batch_name,
          company_name,
          country,
          website,
          industry,
          status,
          report_id,
          report_url,
          source_type,
          priority
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'batch_import', $10)`,
        [
          assignSeq,
          batch_name,
          cleanName,
          item.country || '全球',
          item.website || null,
          item.industry || null,
          taskStatus,
          reportId,
          reportUrl,
          finalPriority
        ]
      );

      added.push({
        company_name: cleanName,
        seq_no: assignSeq,
        status: taskStatus
      });
    }

    await dbClient.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `成功导入 ${added.length} 条客户，自动去重跳过 ${skipped.length} 条`,
      addedCount: added.length,
      skippedCount: skipped.length,
      totalProcessed: inputItems.length,
      added,
      skipped
    });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    console.error('Error importing research tasks:', err);
    return res.status(500).json({ error: 'Failed to import tasks', details: err.message });
  }
}

export default withDb(importTasksHandler, { methods: ['POST'] });

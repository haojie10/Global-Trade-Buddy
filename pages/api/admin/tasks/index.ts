import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function listTasksHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  const {
    page = '1',
    pageSize = '20',
    status,
    batch_name,
    source_type,
    country,
    search,
    only_timeout
  } = req.query;

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const sizeNum = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 20));
  const offset = (pageNum - 1) * sizeNum;

  try {
    const whereConditions: string[] = ['1=1'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (status && status !== 'All') {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (batch_name && batch_name !== 'All') {
      whereConditions.push(`batch_name = $${paramIndex}`);
      queryParams.push(batch_name);
      paramIndex++;
    }

    if (source_type && source_type !== 'All') {
      whereConditions.push(`source_type = $${paramIndex}`);
      queryParams.push(source_type);
      paramIndex++;
    }

    if (country && country !== 'All') {
      whereConditions.push(`country = $${paramIndex}`);
      queryParams.push(country);
      paramIndex++;
    }

    if (search && String(search).trim()) {
      whereConditions.push(`(
        LOWER(company_name) LIKE $${paramIndex} 
        OR LOWER(COALESCE(source_company_name, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(website, '')) LIKE $${paramIndex}
        OR CAST(seq_no AS TEXT) = $${paramIndex + 1}
      )`);
      queryParams.push(`%${String(search).trim().toLowerCase()}%`);
      queryParams.push(String(search).trim());
      paramIndex += 2;
    }

    // 仅筛选超时未提交的任务 (超过 30 分钟)
    if (only_timeout === 'true') {
      whereConditions.push(`status = 'running' AND locked_at < NOW() - INTERVAL '30 minutes'`);
    }

    const whereClause = whereConditions.join(' AND ');

    // 统计总条数
    const countRes = await dbClient.query(
      `SELECT count(*) FROM research_tasks WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countRes.rows[0].count, 10);

    // 查询分页列表 (按 priority 倒序，seq_no 正序)
    const listRes = await dbClient.query(
      `SELECT 
        id,
        seq_no,
        batch_name,
        company_name,
        country,
        website,
        industry,
        status,
        assigned_worker,
        locked_at,
        report_id,
        report_url,
        error_message,
        source_type,
        source_report_id,
        source_company_name,
        priority,
        created_at,
        updated_at,
        CASE 
          WHEN status = 'running' AND locked_at < NOW() - INTERVAL '30 minutes' THEN true 
          ELSE false 
        END AS is_timeout,
        CASE
          WHEN status = 'running' AND locked_at IS NOT NULL THEN 
            ROUND(EXTRACT(EPOCH FROM (NOW() - locked_at)) / 60)
          ELSE 0
        END AS running_minutes
       FROM research_tasks
       WHERE ${whereClause}
       ORDER BY priority DESC, seq_no ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, sizeNum, offset]
    );

    // 提取所有可用筛选选项 (去重批次、来源、国家)
    const batchesRes = await dbClient.query(`SELECT DISTINCT batch_name FROM research_tasks WHERE batch_name IS NOT NULL ORDER BY batch_name ASC`);
    const countriesRes = await dbClient.query(`SELECT DISTINCT country FROM research_tasks WHERE country IS NOT NULL ORDER BY country ASC`);

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pageSize: sizeNum,
      totalPages: Math.ceil(total / sizeNum),
      tasks: listRes.rows,
      filterOptions: {
        batches: batchesRes.rows.map(r => r.batch_name),
        countries: countriesRes.rows.map(r => r.country),
        sourceTypes: ['manual', 'batch_import', 'competitor_discovery']
      }
    });
  } catch (err: any) {
    console.error('Error fetching research tasks:', err);
    return res.status(500).json({ error: 'Failed to fetch tasks', details: err.message });
  }
}

export default withDb(listTasksHandler, { methods: ['GET'] });

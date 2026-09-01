import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { getSession } from '../../lib/auth';
import AdminLayout from '../../components/admin/AdminLayout';

interface TaskItem {
  id: string;
  seq_no: number;
  batch_name: string;
  company_name: string;
  country: string;
  website: string | null;
  industry: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  assigned_worker: string | null;
  locked_at: string | null;
  report_id: string | null;
  report_url: string | null;
  error_message: string | null;
  source_type: 'manual' | 'batch_import' | 'competitor_discovery';
  source_report_id: string | null;
  source_company_name: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
  is_timeout: boolean;
  running_minutes: number;
}

interface StatsData {
  total: number;
  completed: number;
  running: number;
  pending: number;
  failed: number;
  paused: number;
  timeoutCount: number;
  progressPercent: string;
  sourceBreakdown: {
    manual: number;
    batch_import: number;
    competitor_discovery: number;
  };
  activeWorkers: Array<{
    assigned_worker: string;
    company_name: string;
    country: string;
    seq_no: number;
    running_minutes: number;
    is_timeout: boolean;
  }>;
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyTimeout, setOnlyTimeout] = useState(false);

  // 筛选器下拉选项
  const [batchOptions, setBatchOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);

  // 导入模态框状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBatchName, setImportBatchName] = useState('渠道地图2026');
  const [importMarkdown, setImportMarkdown] = useState('');
  const [importing, setImporting] = useState(false);

  // 单条新增模态框状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompany, setNewCompany] = useState({
    company_name: '',
    country: '全球',
    website: '',
    industry: '',
    priority: 100,
    batch_name: '手动新增客户'
  });

  // 编辑序号模态状态
  const [editingSeqTask, setEditingSeqTask] = useState<TaskItem | null>(null);
  const [newSeqVal, setNewSeqVal] = useState<number>(0);

  // 加载数据
  const fetchData = async (targetPage = page) => {
    setLoading(true);
    try {
      // 1. 获取统计数据
      const statsRes = await fetch('/api/admin/tasks/stats');
      if (statsRes.ok) {
        const sData = await statsRes.json();
        if (sData.success) setStats(sData.stats);
      }

      // 2. 获取任务列表
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
        status: statusFilter,
        source_type: sourceFilter,
        batch_name: batchFilter,
        country: countryFilter,
        search: searchQuery,
        only_timeout: onlyTimeout ? 'true' : 'false'
      });

      const listRes = await fetch(`/api/admin/tasks?${params.toString()}`);
      if (listRes.ok) {
        const lData = await listRes.json();
        if (lData.success) {
          setTasks(lData.tasks || []);
          setTotal(lData.total || 0);
          setTotalPages(lData.totalPages || 1);
          if (lData.filterOptions) {
            setBatchOptions(lData.filterOptions.batches || []);
            setCountryOptions(lData.filterOptions.countries || []);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load tasks data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, [statusFilter, sourceFilter, batchFilter, countryFilter, onlyTimeout]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData(1);
  };

  // 置顶 / 取消置顶
  const handleTogglePin = async (task: TaskItem) => {
    const isPinned = task.priority >= 900;
    const action = isPinned ? 'unpin' : 'pin';
    try {
      const res = await fetch('/api/admin/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: task.id, action })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchData(page);
      } else {
        alert('操作失败: ' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('请求失败: ' + err.message);
    }
  };

  // 状态流转 (暂停 / 激活)
  const handleUpdateStatus = async (task: TaskItem, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: task.id, action: 'set_status', status: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchData(page);
      } else {
        alert('修改状态失败: ' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('网络请求失败: ' + err.message);
    }
  };

  // 一键重置所有超时任务
  const handleResetAllTimeout = async () => {
    if (!stats || stats.timeoutCount === 0) {
      alert('当前没有疑似超时的任务');
      return;
    }
    if (!confirm(`确定要重置当前 ${stats.timeoutCount} 条已运行超 30 分钟的超时任务吗？\n\n重置后将清除 Worker 机器绑定，任务状态将安全恢复为「待调研」，供空闲 Worker 重新认领。`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/tasks/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_all_timeout: true })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`🎉 ${data.message}`);
        fetchData(page);
      } else {
        alert('重置失败: ' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('网络请求失败: ' + err.message);
    }
  };

  // 单条任务重置为 pending
  const handleResetSingleTask = async (task: TaskItem) => {
    try {
      const res = await fetch('/api/admin/tasks/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: [task.id] })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchData(page);
      } else {
        alert('重置失败: ' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('网络错误: ' + err.message);
    }
  };

  // 保存修改序号
  const handleSaveSeq = async () => {
    if (!editingSeqTask) return;
    try {
      const res = await fetch('/api/admin/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: editingSeqTask.id, action: 'set_seq', seq_no: newSeqVal })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingSeqTask(null);
        fetchData(page);
      } else {
        alert('序号修改失败: ' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('网络错误: ' + err.message);
    }
  };

  // 批量导入提交
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importMarkdown.trim()) {
      alert('请输入要导入的客户清单或 Markdown 表格');
      return;
    }
    setImporting(true);
    try {
      const res = await fetch('/api/admin/tasks/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_name: importBatchName,
          markdown_text: importMarkdown,
          priority: 100
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`🎉 导入成功！\n成功新增: ${data.addedCount} 家\n自动去重跳过: ${data.skippedCount} 家`);
        setShowImportModal(false);
        setImportMarkdown('');
        fetchData(1);
      } else {
        alert('❌ 导入失败: ' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('网络请求失败: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // 单条新增提交
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.company_name.trim()) {
      alert('请输入公司名称');
      return;
    }
    try {
      const res = await fetch('/api/admin/tasks/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_name: newCompany.batch_name,
          tasks: [newCompany],
          priority: newCompany.priority
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('🎉 客户已成功录入任务队列！');
        setShowAddModal(false);
        setNewCompany({
          company_name: '',
          country: '全球',
          website: '',
          industry: '',
          priority: 100,
          batch_name: '手动新增客户'
        });
        fetchData(1);
      } else {
        alert('录入失败: ' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('网络错误: ' + err.message);
    }
  };

  return (
    <AdminLayout currentPage="tasks">
      <Head>
        <title>调研调度中心 | GTB Admin</title>
      </Head>

      <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: 'var(--admin-text)' }}>
        {/* 顶部标题与快速操作 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--admin-text)' }}>
              🤖 企业调研任务调度中心
            </h1>
            <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.85rem' }}>
              分布式多 Worker 原子防撞调度 · 客户清单自增长与裂变发现 · 统一任务监控与排期管理
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: 'var(--admin-bg-card)',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-text)',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.85rem'
              }}
            >
              ➕ 单条新增客户
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                background: 'var(--admin-accent)',
                border: 'none',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(124, 111, 255, 0.3)'
              }}
            >
              📥 批量导入客户 (去重)
            </button>
          </div>
        </div>

        {/* 统计指标卡片大屏 */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>🌐 客户总池量</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--admin-text)' }}>{stats.total}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                种子: {stats.sourceBreakdown.batch_import} | 裂变: {stats.sourceBreakdown.competitor_discovery}
              </div>
            </div>

            <div style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>✅ 调研完成度</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--admin-success)' }}>
                {stats.completed} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--admin-text-secondary)' }}>({stats.progressPercent})</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: stats.progressPercent, background: 'var(--admin-success)', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>⚡ 正在调研中 (Workers)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#60a5fa' }}>{stats.running}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                活跃机器: {stats.activeWorkers.length} 台
              </div>
            </div>

            <div style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>⏳ 排队待调研</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--admin-warning)' }}>{stats.pending}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                已暂停: {stats.paused} | 异常: {stats.failed}
              </div>
            </div>

            <div style={{
              background: stats.timeoutCount > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--admin-bg-card)',
              border: stats.timeoutCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--admin-border)',
              borderRadius: '12px',
              padding: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: stats.timeoutCount > 0 ? 'var(--admin-error)' : 'var(--admin-text-secondary)', fontSize: '0.85rem' }}>⚠️ 疑似超时 (&gt;30m)</span>
                {stats.timeoutCount > 0 && (
                  <button
                    onClick={handleResetAllTimeout}
                    style={{
                      background: 'var(--admin-error)',
                      color: '#fff',
                      border: 'none',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    一键重置
                  </button>
                )}
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: stats.timeoutCount > 0 ? 'var(--admin-error)' : 'var(--admin-text)' }}>
                {stats.timeoutCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: stats.timeoutCount > 0 ? 'var(--admin-error)' : 'var(--admin-text-secondary)', marginTop: '4px' }}>
                {stats.timeoutCount > 0 ? '存在长时未提交任务，需人工确认' : '调度运转正常无悬挂'}
              </div>
            </div>
          </div>
        )}

        {/* 筛选与搜索工具条 */}
        <div style={{
          background: 'var(--admin-bg-card)',
          border: '1px solid var(--admin-border)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-text)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem'
              }}
            >
              <option value="All">全部状态</option>
              <option value="pending">⏳ 待调研</option>
              <option value="running">⚡ 调研中</option>
              <option value="completed">✅ 调研完毕</option>
              <option value="failed">❌ 异常阻断</option>
              <option value="paused">⏸️ 已暂停</option>
            </select>

            {/* 来源筛选 */}
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
              style={{
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-text)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem'
              }}
            >
              <option value="All">全部来源</option>
              <option value="batch_import">📦 批量/种子导入</option>
              <option value="competitor_discovery">✨ 竞品裂变发现</option>
              <option value="manual">✍️ 手动录入</option>
            </select>

            {/* 批次筛选 */}
            {batchOptions.length > 0 && (
              <select
                value={batchFilter}
                onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }}
                style={{
                  background: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  color: 'var(--admin-text)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem'
                }}
              >
                <option value="All">全部批次</option>
                {batchOptions.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}

            {/* 国家筛选 */}
            {countryOptions.length > 0 && (
              <select
                value={countryFilter}
                onChange={(e) => { setCountryFilter(e.target.value); setPage(1); }}
                style={{
                  background: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  color: 'var(--admin-text)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem'
                }}
              >
                <option value="All">全部国家</option>
                {countryOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {/* 仅看超时勾选 */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: onlyTimeout ? 'var(--admin-error)' : 'var(--admin-text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onlyTimeout}
                onChange={(e) => { setOnlyTimeout(e.target.checked); setPage(1); }}
              />
              仅看超时任务
            </label>
          </div>

          {/* 搜索框 */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="搜索公司名 / 官网 / 序号..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-text)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                width: '220px'
              }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-text)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              🔍 搜索
            </button>
            <button
              type="button"
              onClick={() => fetchData(page)}
              style={{
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-text)',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
              title="刷新列表"
            >
              🔄
            </button>
          </form>
        </div>

        {/* 任务列表主表格 */}
        <div style={{
          background: 'var(--admin-bg-card)',
          border: '1px solid var(--admin-border)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}>
                <th style={{ padding: '12px 16px', width: '90px' }}>序号</th>
                <th style={{ padding: '12px 16px', width: '80px' }}>优先级</th>
                <th style={{ padding: '12px 16px' }}>公司主体 / 官网</th>
                <th style={{ padding: '12px 16px', width: '110px' }}>目标国家</th>
                <th style={{ padding: '12px 16px', width: '180px' }}>来源批次 / 追溯</th>
                <th style={{ padding: '12px 16px', width: '160px' }}>状态 / Worker</th>
                <th style={{ padding: '12px 16px', width: '180px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
                    ⏳ 正在加载任务清单...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
                    📭 暂无符合条件的客户任务
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const isPinned = task.priority >= 900;
                  return (
                    <tr
                      key={task.id}
                      style={{
                        borderBottom: '1px solid var(--admin-border)',
                        background: task.is_timeout ? 'rgba(239, 68, 68, 0.05)' : isPinned ? 'rgba(124, 111, 255, 0.08)' : 'transparent'
                      }}
                    >
                      {/* 序号 */}
                      <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>
                        <span
                          onClick={() => { setEditingSeqTask(task); setNewSeqVal(task.seq_no); }}
                          style={{ cursor: 'pointer', borderBottom: '1px dashed var(--admin-text-secondary)' }}
                          title="点击可修改序号"
                        >
                          #{task.seq_no}
                        </span>
                      </td>

                      {/* 优先级 / 置顶 */}
                      <td style={{ padding: '12px 16px' }}>
                        {isPinned ? (
                          <span style={{ background: 'var(--admin-accent)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            📌 TOP
                          </span>
                        ) : (
                          <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>
                            {task.priority}
                          </span>
                        )}
                      </td>

                      {/* 公司名称与官网 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--admin-text)', fontSize: '0.92rem' }}>
                          {task.company_name}
                        </div>
                        {task.website && (
                          <a
                            href={task.website}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '0.75rem', color: 'var(--admin-accent-light)', textDecoration: 'none', wordBreak: 'break-all' }}
                          >
                            🔗 {task.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </td>

                      {/* 国家 */}
                      <td style={{ padding: '12px 16px', color: 'var(--admin-text)' }}>
                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem' }}>
                          📍 {task.country}
                        </span>
                      </td>

                      {/* 来源批次与裂变追溯 */}
                      <td style={{ padding: '12px 16px', fontSize: '0.8rem' }}>
                        {task.source_type === 'competitor_discovery' ? (
                          <div>
                            <span style={{ color: '#c084fc', fontWeight: 500 }}>✨ 竞品裂变</span>
                            {task.source_company_name && (
                              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>
                                来自: {task.source_company_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span style={{ color: 'var(--admin-text-secondary)' }}>📦 {task.batch_name}</span>
                          </div>
                        )}
                      </td>

                      {/* 状态与 Worker */}
                      <td style={{ padding: '12px 16px' }}>
                        {task.status === 'completed' && (
                          <div>
                            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--admin-success)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500 }}>
                              ✅ 调研完毕
                            </span>
                            {task.report_id && (
                              <div style={{ marginTop: '4px' }}>
                                <a
                                  href={`/reports/${task.report_id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: 'var(--admin-accent-light)', fontSize: '0.75rem', textDecoration: 'none' }}
                                >
                                  📄 查看报告
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {task.status === 'running' && (
                          <div>
                            <span style={{
                              background: task.is_timeout ? 'rgba(239, 68, 68, 0.15)' : 'rgba(96, 165, 250, 0.15)',
                              color: task.is_timeout ? 'var(--admin-error)' : '#60a5fa',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 500
                            }}>
                              {task.is_timeout ? `⚠️ 超时 (${task.running_minutes}m)` : `⚡ 调研中 (${task.running_minutes}m)`}
                            </span>
                            {task.assigned_worker && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                                💻 {task.assigned_worker}
                              </div>
                            )}
                          </div>
                        )}

                        {task.status === 'pending' && (
                          <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--admin-warning)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem' }}>
                            ⏳ 排队待调研
                          </span>
                        )}

                        {task.status === 'failed' && (
                          <div>
                            <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--admin-error)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem' }}>
                              ❌ 调研异常
                            </span>
                            {task.error_message && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--admin-error)', marginTop: '2px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.error_message}>
                                {task.error_message}
                              </div>
                            )}
                          </div>
                        )}

                        {task.status === 'paused' && (
                          <span style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--admin-text-secondary)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem' }}>
                            ⏸️ 已暂停
                          </span>
                        )}
                      </td>

                      {/* 操作栏 */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleTogglePin(task)}
                            style={{
                              background: 'var(--admin-bg)',
                              border: '1px solid var(--admin-border)',
                              color: isPinned ? 'var(--admin-accent-light)' : 'var(--admin-text)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                            title={isPinned ? '取消置顶' : '置顶优先调研'}
                          >
                            {isPinned ? '取消置顶' : '📌 置顶'}
                          </button>

                          {(task.status === 'running' || task.status === 'failed') && (
                            <button
                              onClick={() => handleResetSingleTask(task)}
                              style={{
                                background: 'rgba(96, 165, 250, 0.15)',
                                border: '1px solid rgba(96, 165, 250, 0.3)',
                                color: '#60a5fa',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                              title="释放锁定并恢复为待调研"
                            >
                              重置
                            </button>
                          )}

                          {task.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateStatus(task, 'paused')}
                              style={{
                                background: 'var(--admin-bg)',
                                border: '1px solid var(--admin-border)',
                                color: 'var(--admin-text-secondary)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                              title="暂停调研该任务"
                            >
                              暂停
                            </button>
                          )}

                          {task.status === 'paused' && (
                            <button
                              onClick={() => handleUpdateStatus(task, 'pending')}
                              style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: 'var(--admin-success)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                              title="激活进入待调研"
                            >
                              激活
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* 分页控制栏 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderTop: '1px solid var(--admin-border)',
            fontSize: '0.85rem',
            color: 'var(--admin-text-secondary)'
          }}>
            <div>
              共 {total} 条客户记录 · 当前第 {page} / {totalPages || 1} 页
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page <= 1}
                onClick={() => { setPage(page - 1); fetchData(page - 1); }}
                style={{
                  background: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  color: 'var(--admin-text)',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1
                }}
              >
                上一页
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => { setPage(page + 1); fetchData(page + 1); }}
                style={{
                  background: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  color: 'var(--admin-text)',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1
                }}
              >
                下一页
              </button>
            </div>
          </div>
        </div>

        {/* 批量导入模态框 */}
        {showImportModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'var(--admin-bg-card)',
              border: '1px solid var(--admin-border)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--admin-text)' }}>📥 批量导入客户清单 (自动去重)</h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--admin-text-secondary)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleImportSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: '6px' }}>
                    批次名称:
                  </label>
                  <input
                    type="text"
                    value={importBatchName}
                    onChange={(e) => setImportBatchName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '8px',
                      color: 'var(--admin-text)'
                    }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: '6px' }}>
                    粘贴 Markdown 表格或数据文本 (自动识别序号、公司名、国家、网址):
                  </label>
                  <textarea
                    rows={10}
                    value={importMarkdown}
                    onChange={(e) => setImportMarkdown(e.target.value)}
                    placeholder={`| 序号 | 公司名称 | 公司国家 | 公司网站 |
| 1 | Edeka | 德国 | https://edeka.de |
| 2 | Action | 荷兰 | https://action.com |`}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '8px',
                      color: 'var(--admin-text)',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem'
                    }}
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', marginTop: '4px' }}>
                    💡 提示：系统将自动与已有报告和当前任务池比对，已存在的客户自动跳过，无需担心重复！
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '8px',
                      color: 'var(--admin-text)',
                      cursor: 'pointer'
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={importing}
                    style={{
                      padding: '8px 20px',
                      background: 'var(--admin-accent)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: importing ? 'not-allowed' : 'pointer',
                      opacity: importing ? 0.6 : 1
                    }}
                  >
                    {importing ? '正在解析导入...' : '开始导入'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 单条新增客户模态框 */}
        {showAddModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'var(--admin-bg-card)',
              border: '1px solid var(--admin-border)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--admin-text)' }}>➕ 新增待调研客户</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--admin-text-secondary)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddSubmit}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    公司名称 (*必填):
                  </label>
                  <input
                    type="text"
                    value={newCompany.company_name}
                    onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })}
                    placeholder="如: Hornbach"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '8px',
                      color: 'var(--admin-text)'
                    }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    所属国家:
                  </label>
                  <input
                    type="text"
                    value={newCompany.country}
                    onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                    placeholder="如: 德国 / 全球"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '8px',
                      color: 'var(--admin-text)'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: '4px' }}>
                    官方网站:
                  </label>
                  <input
                    type="url"
                    value={newCompany.website}
                    onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                    placeholder="https://..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '8px',
                      color: 'var(--admin-text)'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--admin-bg)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '8px',
                      color: 'var(--admin-text)',
                      cursor: 'pointer'
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 20px',
                      background: 'var(--admin-accent)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    确认录入
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 快速修改序号模态框 */}
        {editingSeqTask && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'var(--admin-bg-card)',
              border: '1px solid var(--admin-border)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '360px',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--admin-text)' }}>
                修改 #{editingSeqTask.company_name} 的序号
              </h4>
              <input
                type="number"
                value={newSeqVal}
                onChange={(e) => setNewSeqVal(parseInt(e.target.value, 10) || 0)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '8px',
                  color: 'var(--admin-text)',
                  fontSize: '1rem',
                  marginBottom: '16px'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEditingSeqTask(null)}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: '6px',
                    color: 'var(--admin-text)',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveSeq}
                  style={{
                    padding: '6px 16px',
                    background: 'var(--admin-accent)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  保存序号
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = getSession(context.req as any);

  if (!session || session.role !== 'admin') {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    props: {}
  };
};

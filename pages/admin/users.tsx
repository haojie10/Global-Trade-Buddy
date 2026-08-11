import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

interface UserListItem {
  id: string;
  email: string;
  nickname: string | null;
  role: 'user' | 'admin';
  free_quota: number;
  member_type: 'free' | 'pro' | 'enterprise';
  subscription_expires_at: string | null;
  status: 'active' | 'banned';
  created_at: string;
  last_seen: string | null;
  unlock_count: number;
  referral_count: number;
}

interface UserStats {
  total_users: number;
  today_new_users: number;
  vip_users: number;
  active_7d_users: number;
}

interface UnlockedReport {
  report_id: string;
  title: string;
  category: string;
  market_region: string;
  unlocked_at: string;
}

interface ReferralUser {
  id: string;
  email: string;
  nickname: string | null;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [stats, setStats] = useState<UserStats>({
    total_users: 0,
    today_new_users: 0,
    vip_users: 0,
    active_7d_users: 0
  });
  const [loading, setLoading] = useState(true);

  // 筛选与检索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberType, setSelectedMemberType] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // 弹窗与编辑状态
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [editFreeQuota, setEditFreeQuota] = useState<number>(0);
  const [editMemberType, setEditMemberType] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [editExpiresAt, setEditExpiresAt] = useState<string>('');
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [editStatus, setEditStatus] = useState<'active' | 'banned'>('active');
  const [editNickname, setEditNickname] = useState<string>('');
  const [editNewPassword, setEditNewPassword] = useState<string>('');
  const [savingUser, setSavingUser] = useState(false);

  // 用户详情穿透状态
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [unlockedReports, setUnlockedReports] = useState<UnlockedReport[]>([]);
  const [referrals, setReferrals] = useState<ReferralUser[]>([]);
  const [activeTab, setActiveTab] = useState<'edit' | 'unlocks' | 'referrals'>('edit');

  const fetchUsers = async (page = currentPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: searchQuery.trim(),
        memberType: selectedMemberType,
        role: selectedRole,
        status: selectedStatus
      });

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotalUsers(data.totalUsers || 0);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.currentPage || 1);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        console.error('Failed to fetch users');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载及分页/筛选联动
  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage, selectedMemberType, selectedRole, selectedStatus]);

  // 搜索防抖
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchUsers(1);
    }, 400);
  };

  // 打开编辑弹窗
  const handleOpenEdit = async (user: UserListItem) => {
    setEditingUser(user);
    setEditFreeQuota(user.free_quota ?? 0);
    setEditMemberType(user.member_type || 'free');
    setEditExpiresAt(user.subscription_expires_at ? user.subscription_expires_at.slice(0, 16) : '');
    setEditRole(user.role || 'user');
    setEditStatus(user.status || 'active');
    setEditNickname(user.nickname || '');
    setEditNewPassword('');
    setActiveTab('edit');

    // 异步加载该用户的解锁和邀请记录
    setUserDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/users/detail?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setUnlockedReports(data.unlockedReports || []);
        setReferrals(data.referrals || []);
      }
    } catch (err) {
      console.error('Failed to fetch user detail:', err);
    } finally {
      setUserDetailLoading(false);
    }
  };

  // 快捷调整额度
  const handleAddQuota = (delta: number) => {
    setEditFreeQuota(prev => Math.max(0, prev + delta));
  };

  // 快捷延期到期时间
  const handleExtendExpiry = (months: number) => {
    const baseDate = editExpiresAt ? new Date(editExpiresAt) : new Date();
    const newDate = new Date(baseDate);
    newDate.setMonth(newDate.getMonth() + months);
    setEditExpiresAt(newDate.toISOString().slice(0, 16));
    if (editMemberType === 'free') {
      setEditMemberType('pro');
    }
  };

  // 保存用户信息
  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const payload: any = {
        userId: editingUser.id,
        freeQuota: editFreeQuota,
        memberType: editMemberType,
        subscriptionExpiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
        role: editRole,
        status: editStatus,
        nickname: editNickname
      };

      if (editNewPassword.trim()) {
        payload.newPassword = editNewPassword.trim();
      }

      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('🎉 用户信息与权限已成功更新！');
        setEditingUser(null);
        fetchUsers(currentPage);
      } else {
        alert(data.error || '更新失败，请重试');
      }
    } catch (err) {
      alert('网络请求失败');
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <AdminLayout currentPage="users">
      <div className="admin-body">
        {/* 顶部标题 */}
        <div className="admin-topbar">
          <div>
            <h1 className="admin-page-title">👥 用户管理工作台</h1>
            <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              全量用户运维中心：支持额度充值扣减、会员订阅延期、角色权限配置、账号封禁与行为穿透分析。
            </p>
          </div>
        </div>

        {/* 4 个核心数据指标卡片 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div className="admin-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '2rem', padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px' }}>👥</div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>总注册用户</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--admin-text)' }}>{stats.total_users}</div>
            </div>
          </div>

          <div className="admin-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '2rem', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>📈</div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>今日新增用户</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--admin-success)' }}>+{stats.today_new_users}</div>
            </div>
          </div>

          <div className="admin-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '2rem', padding: '10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px' }}>👑</div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>VIP / 订阅会员</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--admin-warning)' }}>{stats.vip_users}</div>
            </div>
          </div>

          <div className="admin-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '2rem', padding: '10px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px' }}>⚡</div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>7日活跃用户</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--admin-accent-light)' }}>{stats.active_7d_users}</div>
            </div>
          </div>
        </div>

        {/* 筛选与检索工具栏 */}
        <div className="admin-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 搜索框 */}
            <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 按注册邮箱或昵称搜索用户..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="admin-input"
                style={{ width: '100%', paddingLeft: '14px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setCurrentPage(1); fetchUsers(1); }}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--admin-text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* 会员类型筛选 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>会员类型:</span>
              <select
                value={selectedMemberType}
                onChange={(e) => { setSelectedMemberType(e.target.value); setCurrentPage(1); }}
                className="admin-input"
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              >
                <option value="All">全部会员</option>
                <option value="free">免费用户 (Free)</option>
                <option value="pro">专业版 (Pro)</option>
                <option value="enterprise">企业版 (Enterprise)</option>
              </select>
            </div>

            {/* 角色筛选 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>角色权限:</span>
              <select
                value={selectedRole}
                onChange={(e) => { setSelectedRole(e.target.value); setCurrentPage(1); }}
                className="admin-input"
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              >
                <option value="All">全部角色</option>
                <option value="user">普通用户</option>
                <option value="admin">管理员 (Admin)</option>
              </select>
            </div>

            {/* 状态筛选 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>账号状态:</span>
              <select
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                className="admin-input"
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              >
                <option value="All">全部状态</option>
                <option value="active">🟢 正常 (Active)</option>
                <option value="banned">🔴 已封禁 (Banned)</option>
              </select>
            </div>

            {/* 刷新按钮 */}
            <button
              onClick={() => fetchUsers(currentPage)}
              className="admin-btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              🔄 刷新
            </button>
          </div>
        </div>

        {/* 用户列表表格 (20 条/页) */}
        <div className="admin-card">
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>用户基本信息</th>
                  <th>角色权限</th>
                  <th>剩余额度</th>
                  <th>会员订阅状态</th>
                  <th>账号状态</th>
                  <th>注册与活跃</th>
                  <th>报告与邀请</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-secondary)' }}>
                      正在加载用户数据中...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-secondary)' }}>
                      未找到符合条件的用户
                    </td>
                  </tr>
                ) : (
                  users.map(user => {
                    const regDate = new Date(user.created_at).toLocaleDateString('zh-CN');
                    const lastSeenStr = user.last_seen
                      ? new Date(user.last_seen).toLocaleDateString('zh-CN')
                      : '从无行为';

                    const isVipActive = user.member_type !== 'free' || (user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date());
                    const expiresStr = user.subscription_expires_at
                      ? new Date(user.subscription_expires_at).toLocaleDateString('zh-CN')
                      : '永久/无';

                    return (
                      <tr key={user.id}>
                        <td>
                          <div style={{ fontWeight: '500', color: 'var(--admin-text)' }}>
                            {user.nickname || '未设置昵称'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-accent-light)', fontFamily: 'monospace' }}>
                            {user.email}
                          </div>
                        </td>

                        <td>
                          {user.role === 'admin' ? (
                            <span className="admin-badge admin-badge-warning" style={{ fontWeight: 600 }}>
                              👑 管理员
                            </span>
                          ) : (
                            <span className="admin-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--admin-text-secondary)' }}>
                              👤 普通用户
                            </span>
                          )}
                        </td>

                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: user.free_quota > 0 ? 'var(--admin-success)' : 'var(--admin-error)' }}>
                            <span>⚡</span> {user.free_quota} 次
                          </div>
                        </td>

                        <td>
                          <div>
                            {user.member_type === 'enterprise' ? (
                              <span className="admin-badge admin-badge-warning">企业版</span>
                            ) : user.member_type === 'pro' ? (
                              <span className="admin-badge admin-badge-success">专业版 Pro</span>
                            ) : (
                              <span className="admin-badge" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--admin-text-secondary)' }}>免费版</span>
                            )}
                          </div>
                          {user.subscription_expires_at && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                              到期: {expiresStr}
                            </div>
                          )}
                        </td>

                        <td>
                          {user.status === 'banned' ? (
                            <span className="admin-badge admin-badge-error">🔴 已封禁</span>
                          ) : (
                            <span className="admin-badge admin-badge-success">🟢 正常</span>
                          )}
                        </td>

                        <td>
                          <div style={{ fontSize: '0.8rem' }}>注册: {regDate}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)' }}>活跃: {lastSeenStr}</div>
                        </td>

                        <td>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                            已解锁: <strong style={{ color: 'var(--admin-text)' }}>{user.unlock_count}</strong> 篇
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                            已邀请: <strong style={{ color: 'var(--admin-text)' }}>{user.referral_count}</strong> 人
                          </div>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="admin-btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            ✏️ 运维管理
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 分页组件 */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderTop: '1px solid var(--admin-border)',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
                显示第 <strong>{(currentPage - 1) * pageSize + 1}</strong> 到 <strong>{Math.min(currentPage * pageSize, totalUsers)}</strong> 条，共 <strong>{totalUsers}</strong> 个用户
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="admin-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.8rem', opacity: currentPage <= 1 ? 0.4 : 1 }}
                >
                  ◀ 上一页
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span style={{ color: 'var(--admin-text-secondary)', padding: '0 4px' }}>...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.8rem',
                            borderRadius: '4px',
                            border: '1px solid var(--admin-border)',
                            background: p === currentPage ? 'var(--admin-accent)' : 'transparent',
                            color: p === currentPage ? '#fff' : 'var(--admin-text)',
                            cursor: 'pointer'
                          }}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="admin-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.8rem', opacity: currentPage >= totalPages ? 0.4 : 1 }}
                >
                  下一页 ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 用户运维与详情 Modal 抽屉 */}
        {editingUser && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div className="admin-card" style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              padding: '24px',
              position: 'relative'
            }}>
              {/* 弹窗头部 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--admin-text)', margin: 0 }}>
                    🛠️ 用户运维管理
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--admin-accent-light)', marginTop: '4px', fontFamily: 'monospace' }}>
                    {editingUser.email}
                  </div>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Tab 导航 */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--admin-border)', marginBottom: '20px' }}>
                <button
                  onClick={() => setActiveTab('edit')}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'edit' ? '2px solid var(--admin-accent)' : '2px solid transparent',
                    color: activeTab === 'edit' ? 'var(--admin-accent-light)' : 'var(--admin-text-secondary)',
                    fontWeight: activeTab === 'edit' ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  ⚙️ 额度与权限配置
                </button>
                <button
                  onClick={() => setActiveTab('unlocks')}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'unlocks' ? '2px solid var(--admin-accent)' : '2px solid transparent',
                    color: activeTab === 'unlocks' ? 'var(--admin-accent-light)' : 'var(--admin-text-secondary)',
                    fontWeight: activeTab === 'unlocks' ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  📑 已解锁报告 ({unlockedReports.length})
                </button>
                <button
                  onClick={() => setActiveTab('referrals')}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'referrals' ? '2px solid var(--admin-accent)' : '2px solid transparent',
                    color: activeTab === 'referrals' ? 'var(--admin-accent-light)' : 'var(--admin-text-secondary)',
                    fontWeight: activeTab === 'referrals' ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  🔗 邀请好友 ({referrals.length})
                </button>
              </div>

              {/* Tab 1: 核心编辑设置 */}
              {activeTab === 'edit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 1. 额度管理 */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                    <label className="admin-label" style={{ fontWeight: 600, color: 'var(--admin-accent-light)' }}>
                      ⚡ 报告解锁额度 (Free Quota)
                    </label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                      <input
                        type="number"
                        min="0"
                        value={editFreeQuota}
                        onChange={(e) => setEditFreeQuota(parseInt(e.target.value, 10) || 0)}
                        className="admin-input"
                        style={{ width: '120px', fontSize: '1rem', fontWeight: 600 }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>点 / 次</span>
                    </div>
                    {/* 快捷增减按钮 */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {[+5, +10, +50, +100].map(delta => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => handleAddQuota(delta)}
                          className="admin-btn-secondary"
                          style={{ padding: '2px 10px', fontSize: '0.75rem' }}
                        >
                          +{delta} 次
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditFreeQuota(0)}
                        className="admin-btn-secondary"
                        style={{ padding: '2px 10px', fontSize: '0.75rem', color: 'var(--admin-error)' }}
                      >
                        清零
                      </button>
                    </div>
                  </div>

                  {/* 2. 订阅与到期时间 */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                    <label className="admin-label" style={{ fontWeight: 600, color: 'var(--admin-accent-light)' }}>
                      👑 会员类型与订阅到期时间
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '4px' }}>会员类型:</span>
                        <select
                          value={editMemberType}
                          onChange={(e: any) => setEditMemberType(e.target.value)}
                          className="admin-input"
                          style={{ width: '100%' }}
                        >
                          <option value="free">免费版 (Free)</option>
                          <option value="pro">专业版 (Pro)</option>
                          <option value="enterprise">企业版 (Enterprise)</option>
                        </select>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '4px' }}>到期时间:</span>
                        <input
                          type="datetime-local"
                          value={editExpiresAt}
                          onChange={(e) => setEditExpiresAt(e.target.value)}
                          className="admin-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    {/* 快捷延期 */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => handleExtendExpiry(1)} className="admin-btn-secondary" style={{ padding: '2px 10px', fontSize: '0.75rem' }}>+1 个月</button>
                      <button type="button" onClick={() => handleExtendExpiry(3)} className="admin-btn-secondary" style={{ padding: '2px 10px', fontSize: '0.75rem' }}>+3 个月</button>
                      <button type="button" onClick={() => handleExtendExpiry(12)} className="admin-btn-secondary" style={{ padding: '2px 10px', fontSize: '0.75rem' }}>+1 年</button>
                      <button type="button" onClick={() => setEditExpiresAt('')} className="admin-btn-secondary" style={{ padding: '2px 10px', fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>清除到期日 (永久/免费)</button>
                    </div>
                  </div>

                  {/* 3. 权限与账号状态 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                      <label className="admin-label">🛡️ 角色权限</label>
                      <select
                        value={editRole}
                        onChange={(e: any) => setEditRole(e.target.value)}
                        className="admin-input"
                        style={{ width: '100%' }}
                      >
                        <option value="user">👤 普通用户</option>
                        <option value="admin">👑 管理员 (Admin)</option>
                      </select>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                      <label className="admin-label">🚦 账号状态</label>
                      <select
                        value={editStatus}
                        onChange={(e: any) => setEditStatus(e.target.value)}
                        className="admin-input"
                        style={{ width: '100%' }}
                      >
                        <option value="active">🟢 正常 (Active)</option>
                        <option value="banned">🔴 封禁账号 (Banned)</option>
                      </select>
                    </div>
                  </div>

                  {/* 4. 昵称与密码重置 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label className="admin-label">👤 昵称</label>
                      <input
                        type="text"
                        value={editNickname}
                        onChange={(e) => setEditNickname(e.target.value)}
                        placeholder="输入用户昵称"
                        className="admin-input"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label className="admin-label">🔑 重置密码 (留空则不修改)</label>
                      <input
                        type="password"
                        value={editNewPassword}
                        onChange={(e) => setEditNewPassword(e.target.value)}
                        placeholder="输入新密码 (至少 6 位)"
                        className="admin-input"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: 已解锁报告穿透 */}
              {activeTab === 'unlocks' && (
                <div style={{ minHeight: '260px' }}>
                  {userDetailLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-secondary)' }}>
                      正在加载解锁历史...
                    </div>
                  ) : unlockedReports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-secondary)' }}>
                      该用户尚未解锁任何报告
                    </div>
                  ) : (
                    <div className="admin-table-container" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>报告标题</th>
                            <th>类型</th>
                            <th>覆盖国家</th>
                            <th>解锁时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unlockedReports.map(rep => (
                            <tr key={rep.report_id}>
                              <td style={{ fontWeight: 500 }}>{rep.title}</td>
                              <td>
                                <span className="admin-badge" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                  {rep.category === 'product' ? '品类洞察' : '客户情报'}
                                </span>
                              </td>
                              <td style={{ color: 'var(--admin-accent-light)' }}>{rep.market_region || '全球'}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                                {new Date(rep.unlocked_at).toLocaleString('zh-CN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: 邀请好友穿透 */}
              {activeTab === 'referrals' && (
                <div style={{ minHeight: '260px' }}>
                  {userDetailLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-secondary)' }}>
                      正在加载邀请记录...
                    </div>
                  ) : referrals.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-secondary)' }}>
                      该用户尚未邀请任何好友
                    </div>
                  ) : (
                    <div className="admin-table-container" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>邀请好友邮箱</th>
                            <th>昵称</th>
                            <th>注册时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referrals.map(ref => (
                            <tr key={ref.id}>
                              <td style={{ fontFamily: 'monospace', color: 'var(--admin-accent-light)' }}>{ref.email}</td>
                              <td>{ref.nickname || '未设置'}</td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                                {new Date(ref.created_at).toLocaleString('zh-CN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 弹窗底部操作按钮 */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid var(--admin-border)'
              }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="admin-btn-secondary"
                  disabled={savingUser}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveUser}
                  className="admin-btn-primary"
                  disabled={savingUser}
                  style={{ minWidth: '120px' }}
                >
                  {savingUser ? '保存中...' : '💾 保存修改'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

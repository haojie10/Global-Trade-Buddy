import { GetServerSideProps } from 'next';
import React, { useState } from 'react';
import { Client } from 'pg';
import { getUserGraph, GraphNode, GraphLink } from './api/user/graph';
import ObsidianGraph from '../components/ObsidianGraph';
import ToolsPanel from '../components/ToolsPanel';
import Link from 'next/link';

interface MyGraphProps {
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  userId: string;
  freeQuota: number;
}

export default function MyGraphPage({ graphData, userId, freeQuota }: MyGraphProps) {
  const [quota, setQuota] = useState(freeQuota);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInitSeedData = async () => {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user/unlock-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          reportId: 'seed-action',
        }),
      });

      const data = await res.json();
      if (data.success) {
        // 解锁并初始化种子数据成功，重新载入页面数据以显示图谱
        window.location.reload();
      } else {
        setError(data.error || '生成种子数据失败，请重试');
      }
    } catch (err) {
      console.error(err);
      setError('网络请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const hasData = graphData.nodes && graphData.nodes.length > 0;

  return (
    <div style={{
      background: '#f8fafc',
      color: '#0f172a',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* 渐变背景 - 清爽浅色淡蓝光晕 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '100%',
        background: 'radial-gradient(circle at 15% 15%, rgba(37, 99, 235, 0.04) 0%, transparent 50%), radial-gradient(circle at 85% 85%, rgba(37, 99, 235, 0.03) 0%, transparent 50%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      
      {/* 头部导航栏 - 漂浮样式 */}
      <div style={{ padding: '20px 40px 10px 40px', flexShrink: 0, zIndex: 10 }}>
        <header style={{
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          padding: '12px 30px',
          borderRadius: '24px',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>🕸️</span>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 400,
              color: '#0f172a',
              letterSpacing: '-0.5px'
            }}>
              个人外贸知识拓扑网络
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.9rem' }}>
            <Link 
              href="/" 
              className="water-drop-btn"
              style={{
                textDecoration: 'none',
                fontWeight: 400,
                padding: '8px 20px',
                fontSize: '0.85rem'
              }}
            >
              🌐 返回平台报告大厅
            </Link>
            <span style={{ color: '#475569', fontWeight: 300 }}>🔑 业务员 ID: <code style={{ color: '#2563eb', fontWeight: 400 }}>{userId.substring(0, 8)}...</code></span>
            <span style={{
              background: 'rgba(15, 23, 42, 0.03)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              padding: '6px 14px',
              borderRadius: '20px',
              color: '#0f172a',
              fontWeight: 300
            }}>
              🔓 剩余额度: <b style={{ color: '#10b981', fontWeight: 500 }}>{quota}</b> 次
            </span>
          </div>
        </header>
      </div>

      {/* 主体内容区（分左右两栏） */}
      <main style={{
        flex: 1,
        display: 'flex',
        padding: '10px 40px 24px 40px',
        gap: '24px',
        overflow: 'hidden',
        maxWidth: '1480px',
        margin: '0 auto',
        width: '100%',
        zIndex: 10
      }}>
        {/* 左栏：图谱面板 */}
        <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {hasData ? (
            <ObsidianGraph data={graphData} />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.85)',
              borderRadius: '24px',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              backdropFilter: 'blur(30px)',
              padding: '40px',
              textAlign: 'center',
              boxShadow: '0 12px 40px 0 rgba(15, 23, 42, 0.03)'
            }}>
              <div 
                className="floating-planet"
                style={{
                  fontSize: '4.5rem',
                  marginBottom: '28px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 800,
                  cursor: 'default',
                  userSelect: 'none'
                }}
              >
                🪐
              </div>
              <h2 style={{
                fontSize: '1.7rem',
                fontWeight: 300,
                marginBottom: '16px',
                color: '#0f172a',
                letterSpacing: '-0.5px'
              }}>
                开启您的外贸星空知识网络
              </h2>
              <p style={{
                maxWidth: '520px',
                fontSize: '0.95rem',
                color: '#475569',
                lineHeight: 1.6,
                marginBottom: '36px'
              }}>
                您的个人知识拓扑网络目前还是空的。在这里，您可以通过在报告大厅解锁和阅读行业客户与品类报告，自动生成互相关联的实体知识卡片网络，帮您洞察跨区域客户之间的隐藏商机。
              </p>
              
              <button
                onClick={handleInitSeedData}
                disabled={loading}
                className="water-drop-btn"
                style={{
                  padding: '14px 32px',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '⚡ 正在生成专属知识节点...' : '🔌 快速生成演示图谱并解锁首批报告'}
              </button>

              {error && (
                <div style={{ marginTop: '16px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右栏：外贸便捷小工具面板 */}
        <div style={{
          width: '450px',
          background: 'rgba(255, 255, 255, 0.75)',
          borderRadius: '24px',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
            background: 'rgba(15, 23, 42, 0.02)'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 500,
              color: '#0f172a',
              letterSpacing: '-0.3px'
            }}>
              🛠️ 外贸快捷工具箱
            </h3>
          </div>
          <div style={{ flex: 1, padding: '10px 0' }}>
            <ToolsPanel />
          </div>
        </div>

      </main>

      {/* 简单的关键帧动画定义 */}
      <style jsx global>{`
        .floating-planet {
          animation: float 4s infinite ease-in-out;
        }
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }

        .water-drop-btn {
          background: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.75);
          border-radius: 30px;
          color: #0f172a;
          box-shadow: 
            0 8px 24px rgba(31, 38, 135, 0.03), 
            inset 0 4px 10px rgba(255, 255, 255, 0.65), 
            inset 0 -4px 10px rgba(15, 23, 42, 0.02);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
          outline: none;
          display: inline-block;
          text-align: center;
        }
        .water-drop-btn:hover {
          background: rgba(255, 255, 255, 0.7);
          box-shadow: 
            0 12px 30px rgba(31, 38, 135, 0.05), 
            inset 0 8px 16px rgba(255, 255, 255, 0.8), 
            inset 0 -6px 16px rgba(15, 23, 42, 0.03);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}

// SSR 加载个人知识图谱数据
export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
  await dbClient.connect();

  try {
    // 默认获取第一个测试用户的 UUID
    const userRes = await dbClient.query('SELECT id, free_quota FROM users ORDER BY created_at ASC LIMIT 1');
    
    let userId = '';
    let freeQuota = 3;
    
    if (userRes.rows.length === 0) {
      const newUser = await dbClient.query(
        "INSERT INTO users (phone_number, free_quota) VALUES ('13800000000', 3) RETURNING id, free_quota"
      );
      userId = newUser.rows[0].id;
      freeQuota = newUser.rows[0].free_quota;
    } else {
      userId = userRes.rows[0].id;
      freeQuota = userRes.rows[0].free_quota;
    }

    const graphData = await getUserGraph(userId, dbClient);

    return {
      props: {
        graphData,
        userId,
        freeQuota
      }
    };
  } catch (err) {
    console.error('SSR 加载个人图谱失败，原因:', err);
    return {
      props: {
        graphData: { nodes: [], links: [] },
        userId: '',
        freeQuota: 0
      }
    };
  } finally {
    await dbClient.end();
  }
};

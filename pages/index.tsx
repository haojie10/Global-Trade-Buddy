import { GetServerSideProps } from 'next';
import React, { useState } from 'react';
import { Client } from 'pg';
import { getUserGraph, GraphNode, GraphLink } from './api/user/graph';
import ObsidianGraph from '../components/ObsidianGraph';
import ToolsPanel from '../components/ToolsPanel';
import Link from 'next/link';

interface HomeProps {
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  userId: string;
  freeQuota: number;
}

export default function HomePage({ graphData, userId, freeQuota }: HomeProps) {
  const [quota, setQuota] = useState(freeQuota);

  return (
    <div style={{
      background: '#1d1d1f',
      color: '#f5f5f7',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* 头部导航栏 */}
      <header style={{
        background: '#2d2d2f',
        padding: '16px 40px',
        borderBottom: '1px solid #424245',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.5rem' }}>🌐</span>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Globaltradebuddy (外贸智友)</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.9rem' }}>
          <span>🔑 业务员 ID: <code style={{ color: '#0071e3' }}>{userId.substring(0, 8)}...</code></span>
          <span style={{ background: '#323236', padding: '6px 12px', borderRadius: '20px' }}>
            🔓 剩余报告额度: <b style={{ color: '#34c759' }}>{quota}</b> 次
          </span>
        </div>
      </header>

      {/* 主体内容区（分左右两栏） */}
      <main style={{
        flex: 1,
        display: 'flex',
        padding: '24px',
        gap: '24px',
        height: 'calc(100vh - 75px)',
        overflow: 'hidden'
      }}>
        
        {/* 左栏：Obsidian 关系图谱 */}
        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {graphData.nodes.length > 0 ? (
            <ObsidianGraph data={graphData} />
          ) : (
            <div style={{
              flex: 1,
              background: '#2d2d2f',
              border: '1px dashed #424245',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🕸️</div>
              <h3 style={{ margin: '0 0 10px 0' }}>您的个人外贸知识图谱还是空的</h3>
              <p style={{ fontSize: '0.85rem', color: '#86868b', maxWidth: '400px', lineHeight: 1.6, marginBottom: '20px' }}>
                当您开始解锁“客户洞察报告”或“品类分析”时，这些报告将作为节点自动生成并网状联结在下方。
              </p>
              
              {/* 演示目的：提供一键生成种子数据的测试按钮 */}
              <button 
                onClick={async () => {
                  // 自动解锁测试种子报告
                  const seedRes = await fetch('/api/user/unlock-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, reportId: 'seed-action' }) // 触发后端生成种子
                  });
                  window.location.reload();
                }}
                style={{
                  background: '#0071e3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                🛠️ 一键加载种子测试报告与关系网
              </button>
            </div>
          )}
        </div>

        {/* 右栏：外贸便捷小工具面板 */}
        <div style={{
          width: '450px',
          background: '#2d2d2f',
          borderRadius: '16px',
          border: '1px solid #424245',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #424245', background: '#323236' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f5f5f7' }}>🛠️ 外贸快捷工具箱</h3>
          </div>
          <div style={{ flex: 1, padding: '10px 0' }}>
            <ToolsPanel />
          </div>
        </div>

      </main>

    </div>
  );
}

// SSR 获取初始解锁图谱数据
export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
  await dbClient.connect();

  try {
    // 默认获取第一个测试用户的 UUID
    const userRes = await dbClient.query('SELECT id, free_quota FROM users ORDER BY created_at ASC LIMIT 1');
    
    // 如果没有用户，先动态创建一个默认测试用户
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

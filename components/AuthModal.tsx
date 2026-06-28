import React, { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const inputStyle = {
    background: 'var(--bg-main)',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: 'var(--color-text)',
    outline: 'none',
    width: '100%',
    transition: 'box-shadow 0.3s ease',
    boxSizing: 'border-box' as const
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = authMode === 'login' 
        ? { phoneOrEmail: phone || email, password }
        : { phone, email, password, role };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        document.cookie = `user_id=${data.user.id}; path=/; max-age=604800`;
        document.cookie = `user_role=${data.user.role}; path=/; max-age=604800`;
        window.location.reload();
      } else {
        setErrorMsg(data.error || '认证失败，请重试');
      }
    } catch (err) {
      setErrorMsg('连接服务器失败');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.15)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-sub)',
        border: 'none',
        borderRadius: 'var(--border-radius)',
        padding: '40px 30px',
        width: '90%',
        maxWidth: '420px',
        boxShadow: '0 20px 40px rgba(160, 109, 68, 0.05)',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            fontSize: '1.25rem',
            cursor: 'pointer',
            color: 'var(--color-muted)'
          }}
        >
          ✕
        </button>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '24px', textAlign: 'center', color: 'var(--color-text)' }}>
          {authMode === 'login' ? '账号登录' : '新用户注册'}
        </h2>
        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {authMode === 'signup' ? (
            <>
              <input 
                type="text" 
                placeholder="手机号 (可选)" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={inputStyle}
              />
              <input 
                type="email" 
                placeholder="邮箱 (可选)" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '0.85rem', padding: '0 4px' }}>
                <span style={{ color: 'var(--color-muted)' }}>选择角色:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="role" 
                    checked={role === 'user'}
                    onChange={() => setRole('user')}
                  />
                  普通用户
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="role" 
                    checked={role === 'admin'}
                    onChange={() => setRole('admin')}
                  />
                  管理员
                </label>
              </div>
            </>
          ) : (
            <input 
              type="text" 
              placeholder="手机号 或 邮箱" 
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={inputStyle}
              required
            />
          )}
          <input 
            type="password" 
            placeholder="密码" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
            required
          />
          {errorMsg && (
            <div style={{ fontSize: '0.8rem', color: '#ef4444', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}
          <button 
            type="submit" 
            className="sand-btn"
            style={{ padding: '12px', fontSize: '0.95rem', width: '100%', marginTop: '8px' }}
          >
            {authMode === 'login' ? '登录' : '注册'}
          </button>
        </form>
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          {authMode === 'login' ? (
            <span>还没有账号？ <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('signup'); setErrorMsg(''); }} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>立即注册</a></span>
          ) : (
            <span>已有账号？ <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('login'); setErrorMsg(''); }} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>去登录</a></span>
          )}
        </div>
      </div>
    </div>
  );
}

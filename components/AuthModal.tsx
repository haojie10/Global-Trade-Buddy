import React, { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 弹窗打开、关闭或切换登录/注册模式时，立即清空所有表单项和错误提示，防止数据残留与自动填充冲突
  React.useEffect(() => {
    setNickname('');
    setEmail('');
    setPassword('');
    setCode('');
    setErrorMsg('');
  }, [authMode, isOpen]);

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

  const handleSendCode = async () => {
    // 1. 注册状态下，发信前强行检验昵称是否填写且合规，防止浪费验证码
    if (authMode === 'signup') {
      if (!nickname.trim()) {
        setErrorMsg('请先输入昵称以发送验证码');
        return;
      }
      let byteLen = 0;
      for (let i = 0; i < nickname.length; i++) {
        byteLen += nickname.charCodeAt(i) > 255 ? 2 : 1;
      }
      if (byteLen > 10) {
        setErrorMsg('昵称不能超过 10 个字节 (5 个汉字)');
        return;
      }
      if (!/^[a-zA-Z0-9\u4e00-\u9fa5]+$/.test(nickname)) {
        setErrorMsg('昵称只能包含中文、英文和数字，不能带特殊符号');
        return;
      }
    }

    if (!email || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      setErrorMsg('请输入有效的邮箱地址以获取验证码');
      return;
    }
    setIsSending(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCountdown(60);
        alert(data.message || '验证码发送成功！');
      } else {
        setErrorMsg(data.error || '验证码发送失败');
      }
    } catch (err) {
      setErrorMsg('发送失败，请稍后重试');
    } finally {
      setIsSending(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    // 客户端昵称校验（注册状态下）
    if (authMode === 'signup') {
      if (!nickname.trim()) {
        setErrorMsg('请输入昵称');
        return;
      }
      let byteLen = 0;
      for (let i = 0; i < nickname.length; i++) {
        byteLen += nickname.charCodeAt(i) > 255 ? 2 : 1;
      }
      if (byteLen > 10) {
        setErrorMsg('昵称不能超过 10 个字节 (5 个汉字)');
        return;
      }
      if (!/^[a-zA-Z0-9\u4e00-\u9fa5]+$/.test(nickname)) {
        setErrorMsg('昵称只能包含中文、英文和数字，不能带特殊符号');
        return;
      }
    }

    if (authMode === 'forgot') {
      if (!email || !password || !code) {
        setErrorMsg('请填写完整的邮箱、验证码和新密码');
        return;
      }
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, code })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          alert(data.message || '重置密码成功，请重新登录！');
          setAuthMode('login');
        } else {
          setErrorMsg(data.error || '重置密码失败，请重试');
        }
      } catch (err) {
        setErrorMsg('连接服务器失败');
      }
      return;
    }

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = authMode === 'login' 
        ? { phoneOrEmail: email, password } // 登录支持用邮箱作为账号登录
        : { nickname, email, password, code };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        document.cookie = `user_id=${data.user.id}; path=/; max-age=604800`;
        document.cookie = `user_role=${data.user.role}; path=/; max-age=604800`;
        document.cookie = `user_nickname=${encodeURIComponent(data.user.nickname || '')}; path=/; max-age=604800`;
        if (authMode === 'login') {
          alert('登录成功！');
        } else {
          alert('注册成功并已自动登录！');
        }
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
          {authMode === 'login' ? '账号登录' : authMode === 'signup' ? '新用户注册' : '重置密码'}
        </h2>
        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {authMode === 'signup' ? (
            <>
              <input 
                type="text" 
                placeholder="昵称 (限5个汉字/10字节)" 
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                style={inputStyle}
                autoComplete="nickname"
                required
              />
              <input 
                type="email" 
                placeholder="邮箱" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                autoComplete="email"
                required
              />
              {email && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="验证码" 
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={countdown > 0 || isSending}
                    className="sand-btn"
                    style={{
                      fontSize: '0.8rem',
                      padding: '8px 12px',
                      whiteSpace: 'nowrap',
                      cursor: countdown > 0 || isSending ? 'not-allowed' : 'pointer',
                      opacity: countdown > 0 || isSending ? 0.6 : 1,
                      borderRadius: '12px',
                      border: '1px solid var(--color-accent)',
                      background: 'transparent',
                      color: 'var(--color-accent)'
                    }}
                  >
                    {countdown > 0 ? `${countdown}s` : isSending ? '发送中...' : '发送验证码'}
                  </button>
                </div>
              )}
            </>
          ) : authMode === 'forgot' ? (
            <>
              <input 
                type="email" 
                placeholder="注册邮箱" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                autoComplete="email"
                required
              />
              {email && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="验证码" 
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={countdown > 0 || isSending}
                    className="sand-btn"
                    style={{
                      fontSize: '0.8rem',
                      padding: '8px 12px',
                      whiteSpace: 'nowrap',
                      cursor: countdown > 0 || isSending ? 'not-allowed' : 'pointer',
                      opacity: countdown > 0 || isSending ? 0.6 : 1,
                      borderRadius: '12px',
                      border: '1px solid var(--color-accent)',
                      background: 'transparent',
                      color: 'var(--color-accent)'
                    }}
                  >
                    {countdown > 0 ? `${countdown}s` : isSending ? '发送中...' : '发送验证码'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <input 
              type="email" 
              placeholder="邮箱" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              autoComplete="username"
              required
            />
          )}
          <input 
            type="password" 
            placeholder={authMode === 'forgot' ? '输入新密码' : '密码'} 
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete={authMode === 'signup' ? 'new-password' : authMode === 'forgot' ? 'new-password' : 'current-password'}
            required
          />
          {authMode === 'login' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.8rem', marginTop: '-8px', paddingRight: '4px' }}>
              <span 
                onClick={() => { setAuthMode('forgot'); setErrorMsg(''); }} 
                style={{ color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                忘记密码？
              </span>
            </div>
          )}
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
            {authMode === 'login' ? '登录' : authMode === 'signup' ? '注册' : '确认重置密码'}
          </button>
        </form>
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          {authMode === 'login' ? (
            <span>还没有账号？ <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('signup'); setErrorMsg(''); }} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>立即注册</a></span>
          ) : authMode === 'signup' ? (
            <span>已有账号？ <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('login'); setErrorMsg(''); }} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>去登录</a></span>
          ) : (
            <span>记起密码了？ <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('login'); setErrorMsg(''); }} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>去登录</a></span>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 弹框开启或关闭时，自动清空数据
  useEffect(() => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
    setSuccessMsg('');
  }, [isOpen]);

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

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return '新密码长度至少 8 位';
    }
    if (!/[a-zA-Z]/.test(pwd)) {
      return '新密码必须包含至少一个字母';
    }
    if (!/[0-9]/.test(pwd)) {
      return '新密码必须包含至少一个数字';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!oldPassword) {
      setErrorMsg('请输入旧密码');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setErrorMsg(passwordError);
      return;
    }

    if (newPassword === oldPassword) {
      setErrorMsg('新密码不能与旧密码相同');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('两次输入的新密码不一致');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || '密码修改成功，正在引导重新登录...');
        // 修改成功，安全退出登录并清理凭证
        setTimeout(() => {
          document.cookie = 'user_id=; path=/; max-age=0';
          document.cookie = 'user_role=; path=/; max-age=0';
          window.location.href = '/';
        }, 1500);
      } else {
        setErrorMsg(data.error || '密码修改失败，请重试');
      }
    } catch (err) {
      setErrorMsg('连接修改密码服务失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(18, 18, 18, 0.08)',
          borderRadius: 'var(--border-radius)',
          padding: '40px',
          width: '400px',
          boxSizing: 'border-box',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.05)',
          position: 'relative'
        }}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.2rem',
            color: 'var(--color-muted)',
            transition: 'color 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--color-accent)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--color-muted)'}
        >
          ✕
        </button>

        <h3 className="font-editorial" style={{ fontSize: '1.8rem', margin: '0 0 24px 0', textAlign: 'center', fontWeight: 400 }}>
          修改密码
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input 
            type="password" 
            placeholder="当前旧密码" 
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
            required
          />
          <input 
            type="password" 
            placeholder="设置新密码" 
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            style={inputStyle}
            autoComplete="new-password"
            required
          />
          <input 
            type="password" 
            placeholder="确认新密码" 
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={inputStyle}
            autoComplete="new-password"
            required
          />

          {errorMsg && (
            <div style={{ fontSize: '0.8rem', color: '#ef4444', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ fontSize: '0.8rem', color: '#10b981', textAlign: 'center' }}>
              {successMsg}
            </div>
          )}

          <button 
            type="submit" 
            className="sand-btn"
            disabled={isSubmitting}
            style={{ 
              padding: '12px', 
              fontSize: '0.95rem', 
              width: '100%', 
              marginTop: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? '提交中...' : '确认修改'}
          </button>
        </form>
      </div>
    </div>
  );
}

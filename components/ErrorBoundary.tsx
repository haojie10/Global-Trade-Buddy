import React, { Component, ErrorInfo, ReactNode } from 'react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          backgroundColor: '#090808',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          padding: '32px 20px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 100, 30, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            color: 'var(--color-accent, #ff641e)',
            fontSize: '28px'
          }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: '1.5rem', marginTop: '0', marginBottom: '12px', fontWeight: 600 }}>
            页面组件渲染遇到问题
          </h2>
          <p style={{ color: 'var(--color-muted, #94a3b8)', marginBottom: '28px', maxWidth: '440px', fontSize: '0.9rem', lineHeight: 1.6 }}>
            可能由于数据解析异常或网络波动导致，您可以尝试刷新页面或返回首页。
          </p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={this.handleReset}
              style={{
                backgroundColor: 'transparent',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '10px 24px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                transition: 'all 0.2s ease',
              }}
            >
              重新尝试
            </button>
            <Link
              href="/"
              style={{
                display: 'inline-block',
                backgroundColor: 'var(--color-accent, #ff641e)',
                color: '#ffffff',
                padding: '10px 24px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 500,
                boxShadow: '0 4px 12px rgba(255, 100, 30, 0.2)'
              }}
            >
              返回首页
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

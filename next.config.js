/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  reactStrictMode: true,
  poweredByHeader: false,
  // 仅在 Docker 容器化构建时启用 standalone（如 CloudBase CloudRun），EdgeOne Pages 部署时保持默认标准模式
  ...(process.env.NEXT_OUTPUT_STANDALONE === 'true' ? { output: 'standalone' } : {}),

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://124.222.201.143:3000/api/:path*',
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com https://cdn.bootcdn.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co https://*.supabase.net https://*.tcb.qcloud.la https://*.tcloudbaseapp.com ws: wss:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow large file uploads for PDF materials
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Headers for PWA service worker and security
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // SSE endpoint: disable buffering
        source: '/api/dashboard/:path*/stream',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Cache-Control', value: 'no-cache, no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;

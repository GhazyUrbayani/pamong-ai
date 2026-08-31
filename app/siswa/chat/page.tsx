'use client';

import dynamic from 'next/dynamic';

const SiswaChatView = dynamic(() => import('@/components/siswa/SiswaChatView'), {
  ssr: false,
  loading: () => (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="spinner" style={{ width: '32px', height: '32px' }} />
    </div>
  ),
});

export default function SiswaChatPage() {
  return <SiswaChatView />;
}

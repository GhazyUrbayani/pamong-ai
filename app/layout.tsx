import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'PAMONG AI — Tutor Pintar Indonesia',
  description: 'Platform AI tutor pendidikan untuk siswa dan guru Indonesia. Belajar lebih cerdas dengan panduan AI berbasis materi guru.',
  keywords: ['AI tutor', 'pendidikan Indonesia', 'belajar online', 'PAMONG AI'],
  authors: [{ name: 'PAMONG AI' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PAMONG AI',
  },
  openGraph: {
    title: 'PAMONG AI — Tutor Pintar Indonesia',
    description: 'Platform AI tutor pendidikan untuk siswa dan guru Indonesia.',
    type: 'website',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="PAMONG AI" />
      </head>
      <body className="font-sans antialiased">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}


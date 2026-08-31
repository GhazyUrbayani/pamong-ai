import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

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
    <html lang="id" className={`${jakarta.variable} ${jetbrainsMono.variable}`}>
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


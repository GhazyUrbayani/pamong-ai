'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptProps {
  variant?: 'siswa' | 'guru'; // siswa = above bottom nav, guru = floating bottom
}

/**
 * Custom PWA install prompt.
 * Intercepts beforeinstallprompt, shows branded banner instead of browser default.
 * Shows only once per session (dismissed state persisted in sessionStorage).
 */
export function InstallPrompt({ variant = 'siswa' }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    // Don't show if already dismissed this session
    if (sessionStorage.getItem('pwa-install-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Small delay so page loads first
      setTimeout(() => setVisible(true), 2500);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      console.log('[PWA] Install accepted');
    }

    setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!visible) return null;

  return (
    <div
      className={`install-banner ${variant === 'guru' ? 'guru-context' : ''}`}
      role="banner"
      aria-label="Undangan install aplikasi PAMONG AI"
    >
      <span style={{ fontSize: '28px', flexShrink: 0 }}>🦉</span>

      <div className="install-banner-text">
        <p className="install-banner-title">Tambahkan ke Layar Utama</p>
        <p className="install-banner-sub">Akses PAMONG AI lebih cepat seperti aplikasi</p>
      </div>

      <button
        id="pwa-install-btn"
        className="install-banner-btn"
        onClick={handleInstall}
        aria-label="Install aplikasi PAMONG AI"
      >
        Install
      </button>

      <button
        className="install-banner-close"
        onClick={handleDismiss}
        aria-label="Tutup banner install"
      >
        ✕
      </button>
    </div>
  );
}

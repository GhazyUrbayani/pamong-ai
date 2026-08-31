'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/ui/BottomNav';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Session } from '@/types';

export default function SiswaProfilPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const storedStudent = localStorage.getItem('siswa_data');
    const storedSession = localStorage.getItem('siswa_session');

    if (!storedStudent) {
      router.push('/siswa/login');
      return;
    }

    setStudent(JSON.parse(storedStudent));
    if (storedSession) setSession(JSON.parse(storedSession));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('siswa_token');
    localStorage.removeItem('siswa_data');
    localStorage.removeItem('siswa_session');
    router.push('/siswa/login');
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen has-bottom-nav pb-16" style={{ background: 'var(--bg-base)' }}>
      <header className="page-header">
        <h1 className="font-bold text-base">👤 Profil Akun Siswa</h1>
      </header>

      <main className="page-container mt-6 flex flex-col gap-6">
        {/* Profile Card */}
        <div className="card-elevated text-center py-8">
          <div
            className="ai-avatar mx-auto mb-3"
            style={{
              width: '72px',
              height: '72px',
              fontSize: '36px',
              backgroundColor: 'var(--brand-primary)',
              margin: '0 auto 16px',
            }}
          >
            <span>🦉</span>
          </div>
          <h2 className="font-bold text-lg">{student?.displayName}</h2>
          <p className="text-xs text-muted font-mono mt-1">Username: {student?.username}</p>

          {student?.roomCode && (
            <div className="mt-3">
              <span className="text-xs px-3 py-1 rounded-full bg-brand font-mono font-semibold" style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', color: 'var(--brand-accent)', border: '1px solid var(--brand-primary)' }}>
                👥 Room Kolaborasi: {student.roomCode}
              </span>
            </div>
          )}
        </div>

        {/* Session Details */}
        <div className="card">
          <h3 className="font-bold text-sm mb-3">Informasi Sesi Pembelajaran</h3>
          <div className="flex flex-col gap-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Topik Sesi:</span>
              <span className="font-semibold text-primary">{session?.title || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Mata Pelajaran:</span>
              <span className="font-semibold text-primary">{session?.subject || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Batas Kuota Chat:</span>
              <span className="font-semibold text-primary">{session?.quotaPerStudent || 20} Pesan</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Mode Keamanan:</span>
              <span className="font-semibold" style={{ color: 'var(--status-green)' }}>
                🛡️ Anti-Halusinasi (Modul Only)
              </span>
            </div>
          </div>
        </div>

        {/* App Info & Logout */}
        <div className="card">
          <h3 className="font-bold text-sm mb-2">Aplikasi PAMONG AI</h3>
          <p className="text-xs text-muted mb-4">
            Aplikasi Progressive Web App (PWA) pembelajaran berbasis AI terpandu modul guru Indonesia.
          </p>

          <button
            onClick={handleLogout}
            className="btn btn-secondary text-xs font-semibold"
            style={{ color: 'var(--status-red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            🚪 Keluar dari Akun Siswa
          </button>
        </div>
      </main>

      <InstallPrompt variant="siswa" />
      <BottomNav />
    </div>
  );
}

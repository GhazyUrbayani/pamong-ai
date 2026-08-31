'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/ui/BottomNav';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Message, Session } from '@/types';

export default function SiswaProgressPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [student, setStudent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('siswa_token');
    const storedStudent = localStorage.getItem('siswa_data');
    const storedSession = localStorage.getItem('siswa_session');

    if (!token || !storedStudent) {
      router.push('/siswa/login');
      return;
    }

    setStudent(JSON.parse(storedStudent));
    if (storedSession) setSession(JSON.parse(storedSession));

    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/chat/history', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [router]);

  const userMessages = messages.filter((m) => m.role === 'user');
  const total = userMessages.length;

  const levels = {
    hafalan: userMessages.filter((m) => m.questionLevel === 'hafalan').length,
    pemahaman: userMessages.filter((m) => m.questionLevel === 'pemahaman').length,
    analisis: userMessages.filter((m) => m.questionLevel === 'analisis').length,
  };

  const hafalanPct = total > 0 ? Math.round((levels.hafalan / total) * 100) : 0;
  const pemahamanPct = total > 0 ? Math.round((levels.pemahaman / total) * 100) : 0;
  const analisisPct = total > 0 ? Math.round((levels.analisis / total) * 100) : 0;

  const quotaTotal = session?.quotaPerStudent || 20;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen has-bottom-nav pb-16" style={{ background: 'var(--bg-base)' }}>
      <header className="page-header">
        <h1 className="font-bold text-base">📊 Progres Belajar & Kognitif</h1>
      </header>

      <main className="page-container mt-6 flex flex-col gap-6">
        {/* Student Welcome Card */}
        <div className="card-elevated">
          <div className="flex items-center gap-3">
            <div className="login-logo-icon" style={{ width: '48px', height: '48px', fontSize: '24px' }}>
              🎓
            </div>
            <div>
              <h2 className="font-bold text-base">{student?.displayName}</h2>
              <p className="text-xs text-muted font-mono">{student?.username}</p>
            </div>
          </div>

          <div className="divider" />

          <div className="flex justify-between items-center text-xs">
            <span className="text-secondary">Materi Aktif:</span>
            <span className="font-semibold text-brand">{session?.title || 'Sesi Kelas'}</span>
          </div>
          <div className="flex justify-between items-center text-xs mt-2">
            <span className="text-secondary">Pesan Terpakai:</span>
            <span className="font-mono font-semibold">
              {total} / {quotaTotal} Pesan
            </span>
          </div>
        </div>

        {/* Cognitive Breakdown Card */}
        <div className="card">
          <h3 className="font-bold text-sm mb-1">Distribusi Level Pertanyaan</h3>
          <p className="text-xs text-muted mb-4">
            AI menganalisis pertanyaanmu ke dalam 3 tingkat Taksonomi Bloom
          </p>

          <div className="flex flex-col gap-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span style={{ color: 'var(--level-hafalan)' }}>📖 Hafalan / Fakta (C1-C2)</span>
                <span className="font-mono">{levels.hafalan} ({hafalanPct}%)</span>
              </div>
              <div className="quota-track">
                <div
                  style={{
                    width: `${hafalanPct}%`,
                    height: '100%',
                    backgroundColor: 'var(--level-hafalan)',
                    borderRadius: '2px',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span style={{ color: 'var(--level-pemahaman)' }}>💡 Pemahaman / Konsep (C3-C4)</span>
                <span className="font-mono">{levels.pemahaman} ({pemahamanPct}%)</span>
              </div>
              <div className="quota-track">
                <div
                  style={{
                    width: `${pemahamanPct}%`,
                    height: '100%',
                    backgroundColor: 'var(--level-pemahaman)',
                    borderRadius: '2px',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span style={{ color: 'var(--level-analisis)' }}>🧠 Analisis / Aplikasi (C5-C6)</span>
                <span className="font-mono">{levels.analisis} ({analisisPct}%)</span>
              </div>
              <div className="quota-track">
                <div
                  style={{
                    width: `${analisisPct}%`,
                    height: '100%',
                    backgroundColor: 'var(--level-analisis)',
                    borderRadius: '2px',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Motivational Feedback Card */}
        <div className="card" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--brand-primary)' }}>
          <h3 className="font-bold text-sm text-brand mb-1">🌟 Evaluasi Mandiri</h3>
          <p className="text-xs text-secondary leading-relaxed">
            {analisisPct >= 30
              ? 'Luar biasa! Kamu banyak mengajukan pertanyaan tingkat analisis dan evaluasi. Terus pertahankan pola pikir kritis ini!'
              : total >= 3 && hafalanPct >= 70
              ? 'Kamu sudah memahami fakta-fakta dasar. Coba tantang dirimu dengan bertanya "Mengapa hal ini bisa terjadi?" atau "Bagaimana contoh penerapannya di lingkungan sekitar?"'
              : 'Terus ajukan pertanyaan seputar materi untuk melihat perkembangan cara belajarmu bersama PAMONG AI!'}
          </p>
        </div>
      </main>

      <InstallPrompt variant="siswa" />
      <BottomNav />
    </div>
  );
}

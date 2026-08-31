'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Session, StudentStats } from '@/types';
import { StudentTable } from '@/components/guru/StudentTable';
import { OnboardingTour } from '@/components/guru/OnboardingTour';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySesiId = searchParams.get('sesiId');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [studentStats, setStudentStats] = useState<StudentStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnectedSSE, setIsConnectedSSE] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('guru_token');
    if (!token) { router.push('/guru/login'); return; }

    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/sesi', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Gagal memuat sesi.');
        const data = await res.json();
        setSessions(data.sessions || []);
        if (data.sessions?.length > 0) {
          const matched = querySesiId
            ? data.sessions.find((s: Session) => s.id === querySesiId)
            : data.sessions[0];
          setActiveSession(matched || data.sessions[0]);
        }
      } catch (err) {
        console.error('[Dashboard]', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSessions();
  }, [router, querySesiId]);

  useEffect(() => {
    if (!activeSession) return;
    const token = localStorage.getItem('guru_token');
    if (!token) return;

    const eventSource = new EventSource(
      `/api/dashboard/${activeSession.id}/stream?token=${encodeURIComponent(token)}`
    );
    eventSource.onopen = () => setIsConnectedSSE(true);
    eventSource.onmessage = (event) => {
      try { setStudentStats(JSON.parse(event.data) as StudentStats[]); }
      catch (err) { console.error('[SSE]', err); }
    };
    eventSource.onerror = () => setIsConnectedSSE(false);
    return () => { eventSource.close(); setIsConnectedSSE(false); };
  }, [activeSession]);

  const handleLogout = () => {
    localStorage.removeItem('guru_token');
    localStorage.removeItem('guru_data');
    router.push('/guru/login');
  };

  const handleQuickStudentDemo = async () => {
    try {
      const res = await fetch('/api/auth/siswa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ahmad.fauzi', password: 'belajar123' }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('siswa_token', data.token);
        localStorage.setItem('siswa_data', JSON.stringify(data.student));
        localStorage.setItem('siswa_session', JSON.stringify(data.session));
        window.open('/siswa/chat', '_blank');
      } else { router.push('/siswa/login'); }
    } catch { router.push('/siswa/login'); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: '36px', height: '36px' }} />
      </div>
    );
  }

  const totalStudents = studentStats.length;
  const activeCount = studentStats.filter((s) => s.chatUsed > 0).length;
  const greenCount = studentStats.filter((s) => s.status === 'hijau').length;
  const redCount = studentStats.filter((s) => s.status === 'merah').length;
  const pemahamanCount = studentStats.filter(
    (s) => s.status === 'netral' && s.levels.hafalan + s.levels.pemahaman + s.levels.analisis > 0
  ).length;
  const hotsPercentage = activeCount > 0 ? Math.round((greenCount / activeCount) * 100) : 0;
  const pemahamanPercentage = activeCount > 0 ? Math.round((pemahamanCount / activeCount) * 100) : 0;
  const lotsPercentage = activeCount > 0 ? Math.round((redCount / activeCount) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ paddingBottom: '64px', background: 'var(--bg-base)' }}>
      {/* ── Top Nav ──────────────────────────────────────────── */}
      <header className="page-header justify-between">
        <div className="flex items-center gap-3">
          <div
            className="login-logo-icon"
            style={{ width: '42px', height: '42px', fontSize: '22px', borderRadius: '12px' }}
          >
            🦉
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
                Pamong AI
              </h1>
              <span
                style={{
                  fontSize: '0.6875rem',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  background: 'hsla(245, 62%, 60%, 0.15)',
                  color: 'var(--brand-accent)',
                  border: '1px solid hsla(245, 62%, 60%, 0.28)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Edutech Pro
              </span>
            </div>
            <div className="flex items-center gap-2" style={{ marginTop: '2px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: isConnectedSSE ? 'var(--status-green)' : 'var(--status-yellow)',
                  boxShadow: isConnectedSSE ? '0 0 8px var(--status-green)' : 'none',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {isConnectedSSE ? 'Live • Real-time SSE Aktif' : 'Menghubungkan ke Server...'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsOnboardingOpen(true)}
            className="btn btn-ghost"
            style={{
              width: 'auto', minHeight: '38px', padding: '6px 14px',
              fontSize: '0.875rem', fontWeight: 600, color: 'var(--status-yellow)',
              borderRadius: '10px',
            }}
          >
            ❓ Panduan
          </button>
          <button
            onClick={handleQuickStudentDemo}
            className="btn btn-secondary"
            style={{
              width: 'auto', minHeight: '38px', padding: '6px 16px',
              fontSize: '0.875rem', fontWeight: 600, borderRadius: '10px',
            }}
          >
            🎭 Siswa Demo
          </button>
          <button
            onClick={() => router.push('/guru/sesi/buat')}
            className="btn btn-primary"
            style={{
              width: 'auto', minHeight: '38px', padding: '6px 18px',
              fontSize: '0.875rem', fontWeight: 600, borderRadius: '10px',
            }}
          >
            + Sesi Baru
          </button>
          <button
            onClick={handleLogout}
            className="btn btn-ghost"
            style={{
              width: 'auto', minHeight: '38px', padding: '6px 12px',
              fontSize: '0.875rem', color: 'var(--text-muted)', borderRadius: '10px',
            }}
          >
            Keluar
          </button>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────── */}
      <main className="page-container" style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {sessions.length === 0 ? (
          <div className="card text-center" style={{ padding: '60px 24px' }}>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '10px' }}>
              Belum Ada Sesi Kelas
            </h2>
            <p className="text-secondary" style={{ fontSize: '0.9375rem', marginBottom: '24px', maxWidth: '440px', margin: '0 auto 24px' }}>
              Buat sesi kelas pertama Anda untuk mengunggah materi dan mendapatkan 20 akun siswa otomatis.
            </p>
            <button
              onClick={() => router.push('/guru/sesi/buat')}
              className="btn btn-primary"
              style={{ width: 'auto', margin: '0 auto', padding: '12px 28px', fontSize: '0.9375rem' }}
            >
              Buat Sesi Sekarang ➔
            </button>
          </div>
        ) : (
          <>
            {/* Multi-Class Switcher Bar */}
            <div
              className="card"
              style={{
                padding: '22px 26px',
                background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-surface) 100%)',
                border: '1px solid var(--border-default)',
                borderRadius: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--brand-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🏫</span> KELOLA KELAS & ROMBEL ({sessions.length} KELAS TERSEDIA)
                  </div>
                  <h2 style={{ fontSize: '1.1875rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '3px', letterSpacing: '-0.02em' }}>
                    {activeSession ? activeSession.title : 'Pilih Kelas'}
                  </h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setIsOnboardingOpen(true)}
                    className="btn btn-ghost"
                    style={{ width: 'auto', fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: '6px 12px', minHeight: '36px', borderRadius: '8px' }}
                  >
                    📖 Panduan Alur
                  </button>
                  <button
                    onClick={() => router.push(`/guru/sesi/${activeSession?.id}`)}
                    className="btn btn-secondary"
                    style={{ width: 'auto', fontSize: '0.8125rem', padding: '6px 14px', minHeight: '36px', borderRadius: '8px', fontWeight: 600 }}
                  >
                    ⚙️ Detail Siswa & Modul
                  </button>
                  <button
                    onClick={() => router.push('/guru/sesi/buat')}
                    className="btn btn-primary"
                    style={{ width: 'auto', fontSize: '0.8125rem', padding: '6px 14px', minHeight: '36px', borderRadius: '8px', fontWeight: 600 }}
                  >
                    ➕ Tambah Kelas Baru
                  </button>
                </div>
              </div>

              {/* Class Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
                {sessions.map((s) => {
                  const isSelected = s.id === activeSession?.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveSession(s)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: isSelected ? 700 : 500,
                        backgroundColor: isSelected ? 'var(--brand-primary)' : 'var(--bg-elevated)',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>🏫</span>
                      <span>{s.title.split('•')[0].trim() || s.title}</span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(99, 102, 241, 0.15)',
                          color: isSelected ? '#ffffff' : 'var(--brand-accent)',
                          fontWeight: 700,
                        }}
                      >
                        {s.subject.split('(')[0].trim()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              {/* Total */}
              <MetricCard
                label="Total Siswa Terdaftar"
                value={totalStudents}
                unit="Siswa"
                sub={`${activeCount} aktif (${totalStudents > 0 ? Math.round((activeCount / totalStudents) * 100) : 0}%)`}
              />
              {/* HOTS */}
              <MetricCard
                label="Analisis / Berpikir Kritis (HOTS)"
                value={greenCount}
                unit={`(${hotsPercentage}%)`}
                sub="Kategori C5 – C6"
                accent="var(--status-green)"
              />
              {/* MOTS */}
              <MetricCard
                label="Pemahaman / Konsep (MOTS)"
                value={pemahamanCount}
                unit={`(${pemahamanPercentage}%)`}
                sub="Kategori C3 – C4"
                accent="var(--status-blue)"
              />
              {/* LOTS */}
              <MetricCard
                label="Hafalan / Dasar (LOTS)"
                value={redCount}
                unit={`(${lotsPercentage}%)`}
                sub="Butuh Bimbingan"
                accent="var(--status-yellow)"
              />
            </div>

            {/* Student Table */}
            {activeSession && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                      Analisis Kognitif Siswa
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Klik baris siswa untuk memeriksa transkrip percakapan & diagnosa Taksonomi Bloom
                    </p>
                  </div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--brand-accent)',
                      background: 'hsla(245, 62%, 60%, 0.1)',
                      border: '1px solid hsla(245, 62%, 60%, 0.25)',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-mono), monospace',
                      fontWeight: 600,
                    }}
                  >
                    Kuota: {activeSession.quotaPerStudent} pesan / siswa
                  </div>
                </div>

                <StudentTable
                  students={studentStats}
                  quotaTotal={activeSession.quotaPerStudent}
                />
              </div>
            )}
          </>
        )}
      </main>

      <OnboardingTour
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onQuickStudentDemo={handleQuickStudentDemo}
      />
    </div>
  );
}

/* ── Metric Card Component ─────────────────────────────────── */
function MetricCard({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div
      className="card"
      style={{
        textAlign: 'center',
        padding: '20px 16px',
        background: accent
          ? `linear-gradient(180deg, color-mix(in srgb, ${accent} 5%, var(--bg-card)) 0%, var(--bg-card) 100%)`
          : 'var(--bg-card)',
        borderColor: accent ? `color-mix(in srgb, ${accent} 25%, transparent)` : 'var(--border-subtle)',
      }}
    >
      <div style={{ fontSize: '0.8125rem', color: accent || 'var(--text-secondary)', fontWeight: 700, letterSpacing: '-0.01em' }}>
        {label}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: accent || 'var(--text-primary)',
          marginTop: '6px',
          lineHeight: 1.2,
          letterSpacing: '-0.03em',
        }}
      >
        {value}{' '}
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, opacity: 0.75 }}>{unit}</span>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 500 }}>
        {sub}
      </div>
    </div>
  );
}

export default function GuruDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="spinner" style={{ width: '36px', height: '36px' }} />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}


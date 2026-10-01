'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Session, StudentStats } from '@/types';
import { StudentTable } from '@/components/guru/StudentTable';
import { OnboardingTour } from '@/components/guru/OnboardingTour';

type DataMode = 'demo' | 'real';

function DashboardContent() {
  const router = useRouter();
  const params = useSearchParams();
  const dataMode: DataMode = params.get('data') === 'real' ? 'real' : 'demo';

  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [stats, setStats] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamConnected, setStreamConnected] = useState(false);
  const [dataError, setDataError] = useState('');
  const [tour, setTour] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('guru_token');
    if (!token) {
      router.push('/guru/login');
      return;
    }

    setLoading(true);
    setDataError('');
    setSessions([]);
    setActive(null);
    setStats([]);

    fetch(`/api/sesi?mode=${dataMode}`, {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Gagal memuat data kelas.');
        }
        return data;
      })
      .then((data) => {
        const list = (data.sessions || []) as Session[];
        setSessions(list);
        const wanted = params.get('sesiId');
        setActive(list.find((session) => session.id === wanted) || list[0] || null);
      })
      .catch((err: unknown) => {
        setDataError(err instanceof Error ? err.message : 'Gagal memuat data kelas.');
      })
      .finally(() => setLoading(false));
  }, [router, params, dataMode]);

  useEffect(() => {
    if (!active) return;

    const token = localStorage.getItem('guru_token');
    if (!token) return;

    const url =
      '/api/dashboard/' +
      active.id +
      '/stream?token=' +
      encodeURIComponent(token) +
      '&mode=' +
      dataMode;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => setStreamConnected(true);
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setStats(Array.isArray(payload) ? payload : payload.stats || []);
      } catch {
        setStats([]);
      }
    };
    eventSource.onerror = () => setStreamConnected(false);

    return () => {
      eventSource.close();
      setStreamConnected(false);
    };
  }, [active, dataMode]);

  const activeCount = stats.filter((student) => student.chatUsed > 0).length;
  const valid = stats.reduce((sum, student) => sum + student.validClassified, 0);
  const classified = useMemo(
    () =>
      dataMode === 'demo'
        ? stats.reduce(
            (sum, student) =>
              sum +
              student.categories.hafalan +
              student.categories.pemahaman +
              student.categories.analisis,
            0
          )
        : valid,
    [dataMode, stats, valid]
  );
  const reviewCount = stats.reduce((sum, student) => sum + student.unclassified, 0);

  const setMode = (mode: DataMode) => {
    const next = new URLSearchParams(params.toString());
    next.set('data', mode);
    next.delete('sesiId');
    router.replace('/guru/dashboard?' + next.toString());
  };

  const selectSession = (session: Session) => {
    setActive(session);
    setStats([]);
    const next = new URLSearchParams(params.toString());
    next.set('data', dataMode);
    next.set('sesiId', session.id);
    router.replace('/guru/dashboard?' + next.toString(), { scroll: false });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', paddingBottom: 64 }}>
      <header className="page-header dashboard-header justify-between">
        <div>
          <h1 className="font-bold">🦉 Pamong AI</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`data-status-pill ${dataMode}`}>
              {dataMode === 'demo' ? 'Demo MVP' : 'Real Data'}
            </span>
            {dataMode === 'real' && (
              <span className="text-xs text-muted">
                {streamConnected
                  ? 'Terhubung'
                  : dataError
                    ? 'Backend tidak tersedia'
                    : 'Menghubungkan…'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap" style={{ justifyContent: 'flex-end' }}>
          <div className="data-mode-switch" role="group" aria-label="Pilih sumber data">
            <button
              type="button"
              className={`data-mode-option demo ${dataMode === 'demo' ? 'active' : ''}`}
              aria-pressed={dataMode === 'demo'}
              onClick={() => setMode('demo')}
            >
              Demo
              <span>MVP</span>
            </button>
            <button
              type="button"
              className={`data-mode-option real ${dataMode === 'real' ? 'active' : ''}`}
              aria-pressed={dataMode === 'real'}
              onClick={() => setMode('real')}
            >
              Real
              <span>Data</span>
            </button>
          </div>

          <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => setTour(true)}>
            ❓ Panduan
          </button>
          <button
            className="btn btn-primary"
            style={{ width: 'auto' }}
            disabled={dataMode === 'demo'}
            title={dataMode === 'demo' ? 'Pilih Real Data untuk membuat sesi baru.' : undefined}
            onClick={() => router.push('/guru/sesi/buat')}
          >
            + Sesi Baru
          </button>
        </div>
      </header>

      <main className="page-container dashboard-main">
        {dataError ? (
          <div className="card real-data-error">
            <h2 className="font-bold">Real Data belum tersedia</h2>
            <p className="text-sm text-secondary mt-2">{dataError}</p>
            <p className="text-xs text-muted mt-2">
              Deployment Cloudflare saat ini belum menyediakan persistence SQLite yang dipakai
              aplikasi. Mode Demo tetap dapat digunakan untuk presentasi MVP.
            </p>
            <button
              className="btn btn-secondary mt-4"
              style={{ width: 'auto' }}
              onClick={() => setMode('demo')}
            >
              Tampilkan Demo Data Sintetik
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="card text-center">
            <h2 className="font-bold">Belum ada sesi kelas</h2>
            <p className="text-xs text-muted mt-2">Buat sesi pertama untuk mulai memakai Real Data.</p>
            <button
              className="btn btn-primary mt-4"
              style={{ width: 'auto' }}
              onClick={() => router.push('/guru/sesi/buat')}
            >
              Buat Sesi
            </button>
          </div>
        ) : (
          <>
            <div className="card session-selector-card">
              <div className="dashboard-section-heading">
                <div>
                  <h2 className="font-bold">Kelas & sesi</h2>
                  <p className="text-sm text-muted">
                    Pilih kelas untuk melihat aktivitas dan pola pertanyaan siswa.
                  </p>
                </div>
              </div>
              <div className="session-tabs">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    className={'btn ' + (session.id === active?.id ? 'btn-primary' : 'btn-secondary')}
                    style={{ width: 'auto' }}
                    onClick={() => selectSession(session)}
                  >
                    {session.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-metric-grid">
              <Metric
                label="Total siswa"
                value={stats.length}
                sub={String(activeCount) + ' sudah bertanya'}
              />
              <Metric
                label="Sudah dikategorikan"
                value={classified}
                sub="Pertanyaan yang masuk salah satu kategori"
              />
              <Metric
                label="Perlu ditinjau"
                value={reviewCount}
                sub="Belum mendapat kategori pertanyaan"
              />
              <Metric
                label="Kuota per siswa"
                value={active?.quotaPerStudent || 0}
                sub="Maksimum pesan per siswa"
              />
            </div>

            <section className="dashboard-distribution-section">
              <div className="dashboard-section-heading distribution-heading">
                <div>
                  <h2 className="font-bold">Distribusi bentuk pertanyaan</h2>
                  <p className="text-sm text-muted">
                    Menunjukkan jenis pertanyaan yang muncul, bukan penilaian kemampuan siswa.
                  </p>
                </div>
                <div className="question-legend" aria-label="Legenda kategori pertanyaan">
                  <span><i className="legend-dot hafalan" />Fakta</span>
                  <span><i className="legend-dot pemahaman" />Penjelasan</span>
                  <span><i className="legend-dot analisis" />Penerapan / penalaran</span>
                </div>
              </div>
              {active && (
                <StudentTable
                  students={stats}
                  quotaTotal={active.quotaPerStudent}
                  dataMode={dataMode}
                />
              )}
            </section>
          </>
        )}
      </main>

      <OnboardingTour isOpen={tour} onClose={() => setTour(false)} />
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="card metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

export default function GuruDashboardPage() {
  return (
    <Suspense fallback={<div className="spinner" />}>
      <DashboardContent />
    </Suspense>
  );
}

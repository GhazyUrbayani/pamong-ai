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
  const syntheticClassified = useMemo(
    () =>
      stats.reduce(
        (sum, student) =>
          sum +
          student.categories.hafalan +
          student.categories.pemahaman +
          student.categories.analisis,
        0
      ),
    [stats]
  );
  const unknown = stats.reduce((sum, student) => sum + student.unclassified, 0);

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
      <header className="page-header justify-between">
        <div>
          <h1 className="font-bold">🦉 Pamong AI</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`data-status-pill ${dataMode}`}>
              {dataMode === 'demo' ? 'Demo • data sintetik' : 'Real Data'}
            </span>
            <span className="text-xs text-muted">
              {dataMode === 'demo'
                ? 'Preview MVP'
                : streamConnected
                  ? 'SSE aktif'
                  : dataError
                    ? 'Backend tidak tersedia'
                    : 'Menghubungkan…'}
            </span>
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
              <span>Data Sintetik</span>
            </button>
            <button
              type="button"
              className={`data-mode-option real ${dataMode === 'real' ? 'active' : ''}`}
              aria-pressed={dataMode === 'real'}
              onClick={() => setMode('real')}
            >
              Real
              <span>Database</span>
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

      <main className="page-container mt-6 flex flex-col gap-6">
        {dataMode === 'demo' && (
          <div className="demo-data-notice" role="status">
            <div>
              <strong>Mode Demo MVP</strong>
              <p>
                Kelas, siswa, distribusi pertanyaan, dan transcript pada mode ini adalah
                <strong> data sintetik</strong> untuk memperlihatkan alur dan UI. Bukan aktivitas
                siswa nyata dan bukan hasil klasifikasi model live.
              </p>
            </div>
          </div>
        )}

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
            <div className="card">
              <div className="flex justify-between items-center gap-3 flex-wrap mb-3">
                <div>
                  <h2 className="font-bold">Kelas & sesi</h2>
                  <p className="text-xs text-muted">
                    {dataMode === 'demo'
                      ? '3 skenario kelas sintetik untuk presentasi MVP.'
                      : 'Sesi yang tersimpan pada backend.'}
                  </p>
                </div>
                <span className={`data-status-pill ${dataMode}`}>
                  {dataMode === 'demo' ? 'SINTETIK' : 'DATABASE'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
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

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                gap: 16,
              }}
            >
              <Metric
                label="Total siswa"
                value={stats.length}
                sub={
                  String(activeCount) +
                  (dataMode === 'demo' ? ' sudah memiliki contoh aktivitas' : ' sudah bertanya')
                }
              />
              <Metric
                label={dataMode === 'demo' ? 'Contoh klasifikasi sintetik' : 'Klasifikasi model valid'}
                value={dataMode === 'demo' ? syntheticClassified : valid}
                sub={
                  dataMode === 'demo'
                    ? 'Hanya untuk visualisasi distribusi'
                    : 'Denominator distribusi pertanyaan'
                }
              />
              <Metric
                label="Belum terklasifikasi"
                value={unknown}
                sub={
                  dataMode === 'demo'
                    ? 'Contoh state unknown pada data sintetik'
                    : 'Unavailable, malformed/error, legacy, atau synthetic'
                }
              />
              <Metric
                label="Kuota per siswa"
                value={active?.quotaPerStudent || 0}
                sub="Pesan pengguna maksimum"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-bold">Distribusi bentuk pertanyaan</h2>
                  <p className="text-xs text-muted mb-3">
                    {dataMode === 'demo'
                      ? 'Visualisasi berikut memakai contoh sintetik dan tidak masuk statistik model valid.'
                      : 'Observasi jenis pertanyaan, bukan diagnosis kemampuan atau progres belajar.'}
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
            </div>
          </>
        )}
      </main>

      <OnboardingTour isOpen={tour} onClose={() => setTour(false)} />
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="card">
      <div className="text-xs text-secondary">{label}</div>
      <div className="font-mono" style={{ fontSize: '2rem', fontWeight: 800 }}>
        {value}
      </div>
      <div className="text-xs text-muted">{sub}</div>
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

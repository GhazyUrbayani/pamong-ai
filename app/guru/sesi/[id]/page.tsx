'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Session, Student } from '@/types';
import { UploadMateri } from '@/components/guru/UploadMateri';
import { KredensialList } from '@/components/guru/KredensialList';
import aiThemes from '@/config/ai-themes.json';

export default function DetailSesiPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSession = async () => {
    const token = localStorage.getItem('guru_token');
    if (!token) {
      router.push('/guru/login');
      return;
    }

    try {
      const res = await fetch(`/api/sesi/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Sesi tidak ditemukan atau akses ditolak.');
      const data = await res.json();
      setSession(data.session);
      setStudents(data.students);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat sesi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: '36px', height: '36px' }} />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-sm font-semibold mb-4 text-primary">{error || 'Sesi tidak ditemukan.'}</p>
        <button onClick={() => router.push('/guru/dashboard')} className="btn btn-secondary">
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  const theme = (aiThemes as Record<string, typeof aiThemes.umum>)[session.aiTheme] ?? aiThemes.umum;

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--bg-base)' }}>
      <header className="page-header justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/guru/dashboard')}
            className="btn btn-ghost"
            style={{ width: 'auto', minHeight: '36px', padding: '6px 12px' }}
          >
            ← Dashboard
          </button>
          <div>
            <h1 className="font-bold text-sm truncate">{session.title}</h1>
            <p className="text-xs text-muted">
              {session.subject} • Karakter: {theme.avatar} {theme.fullName}
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/guru/dashboard?sesiId=${session.id}`)}
          className="btn btn-primary text-xs"
          style={{ width: 'auto', minHeight: '36px', padding: '8px 14px' }}
        >
          📊 Pantau Dashboard Live
        </button>
      </header>

      <main className="page-container mt-6 flex flex-col gap-6">
        {/* Upload Materi Component */}
        <UploadMateri sessionId={session.id} />

        {/* Kredensial List Component */}
        <KredensialList students={students} sessionTitle={session.title} />
      </main>
    </div>
  );
}

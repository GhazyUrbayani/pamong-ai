'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

export default function GuruLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('guru@pamong-ai.id');
  const [password, setPassword] = useState('demo1234');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/guru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const raw = await res.text();
      let data: { error?: string; token?: string; teacher?: unknown } = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          // Some hosting/runtime failures can return HTML or an empty body.
          // Keep the UI actionable instead of throwing "Unexpected end of JSON input".
        }
      }
      if (!res.ok) {
        throw new Error(
          data.error || `Login gagal (HTTP ${res.status}). Backend tidak mengembalikan respons JSON yang valid.`
        );
      }

      if (!data.token || !data.teacher) throw new Error('Respons login MVP tidak lengkap.');
      localStorage.setItem('guru_token', data.token);
      localStorage.setItem('guru_data', JSON.stringify(data.teacher));
      router.push('/guru/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🦉</div>
          <div>
            <h1>PAMONG AI</h1>
            <p>Akses Demo MVP — Portal Guru</p>
          </div>
        </div>

        <div
          className="mb-4 p-3 rounded-lg text-xs"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: '#60a5fa',
            border: '1px solid rgba(59, 130, 246, 0.25)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold">Akun Demo MVP: </span>
              <code>guru@pamong-ai.id</code> / <code>demo1234</code>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail('guru@pamong-ai.id');
                setPassword('demo1234');
              }}
              className="text-xs underline hover:text-white"
              style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#93c5fd' }}
            >
              Isi Otomatis
            </button>
          </div>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-xs"
            style={{
              backgroundColor: 'var(--status-red-bg)',
              color: 'var(--status-red)',
              border: '1px solid var(--status-red)',
            }}
          >
            {error}
          </div>
        )}

        <p className="text-xs text-muted mb-4">
          Akses ini hanya untuk demonstrasi MVP kompetisi. Bukan sistem autentikasi production.
        </p>

        <form onSubmit={handleLogin}>
          <div className="field">
            <label className="label" htmlFor="email">
              Email Guru
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@sekolah.sch.id"
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">
              Kata Sandi
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="mt-6">
            <button
              id="guru-login-btn"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="spinner" />
                  <span>Memverifikasi...</span>
                </div>
              ) : (
                'Masuk Demo MVP ➔'
              )}
            </button>
          </div>
        </form>

        <div className="divider" />

        <div className="text-center">
          <p className="text-xs text-muted mb-2">Kamu siswa yang ingin bergabung?</p>
          <a
            href="/siswa/login"
            className="text-xs font-semibold text-brand hover:underline"
          >
            Masuk sebagai Siswa dengan Kode Akun ➔
          </a>
        </div>
      </div>

      <InstallPrompt variant="guru" />
    </div>
  );
}

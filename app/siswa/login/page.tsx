'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

const DEMO_PRESETS = [
  { name: 'Ahmad Fauzi (HOTS / Analisis)', username: 'ahmad.fauzi', password: 'belajar123' },
  { name: 'Dewi Lestari (HOTS / Analisis)', username: 'dewi.lestari', password: 'belajar123' },
  { name: 'Siti Nurhaliza (Pemahaman)', username: 'siti.nurhaliza', password: 'belajar123' },
  { name: 'Budi Santoso (Butuh Bimbingan)', username: 'budi.santoso', password: 'belajar123' },
];

export default function SiswaLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('ahmad.fauzi');
  const [password, setPassword] = useState('belajar123');
  const [roomCode, setRoomCode] = useState('');
  const [parentConsent, setParentConsent] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/siswa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login gagal.');
      }

      const studentData = {
        ...data.student,
        roomCode: roomCode.trim() || data.student.roomCode,
      };

      localStorage.setItem('siswa_token', data.token);
      localStorage.setItem('siswa_data', JSON.stringify(studentData));
      localStorage.setItem('siswa_session', JSON.stringify(data.session));

      router.push('/siswa/chat');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat masuk.');
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
            <p>Ruang Belajar Siswa Berbasis AI</p>
          </div>
        </div>

        {/* Demo Accounts Preset Pills */}
        <div
          className="mb-4 p-3 rounded-lg text-xs"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
          }}
        >
          <div className="text-xs font-semibold text-brand mb-2">
            💡 Pilih Akun Demo Siswa (Otomatis):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_PRESETS.map((preset) => (
              <button
                key={preset.username}
                type="button"
                onClick={() => {
                  setUsername(preset.username);
                  setPassword(preset.password);
                }}
                className="text-xs px-2.5 py-1 rounded-md transition-all font-mono"
                style={{
                  backgroundColor: username === preset.username ? 'var(--brand-primary)' : 'var(--bg-input)',
                  color: username === preset.username ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${username === preset.username ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                }}
              >
                {preset.name}
              </button>
            ))}
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

        <form onSubmit={handleLogin}>
          <div className="field">
            <label className="label" htmlFor="username">
              Username Siswa
            </label>
            <input
              id="username"
              type="text"
              className="input font-mono"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="contoh: ahmad.fauzi"
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">
              Password Akun
            </label>
            <input
              id="password"
              type="text"
              className="input font-mono"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="contoh: belajar123"
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="roomCode">
              Kode Room Kolaborasi <span className="text-muted">(Opsional)</span>
            </label>
            <input
              id="roomCode"
              type="text"
              className="input font-mono"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Isi sama dengan teman untuk chat bareng"
            />
            <p className="text-xs text-muted mt-1">
              Dua siswa yang memasukkan kode sama dapat berdiskusi dan belajar bersama AI.
            </p>
          </div>

          {/* Parental Consent */}
          <div className="field flex items-center gap-2 mt-3">
            <input
              id="consent"
              type="checkbox"
              checked={parentConsent}
              onChange={(e) => setParentConsent(e.target.checked)}
              style={{ accentColor: 'var(--brand-primary)', width: '16px', height: '16px' }}
            />
            <label htmlFor="consent" className="text-xs text-secondary cursor-pointer">
              Saya telah memperoleh izin orang tua/wali untuk belajar dengan AI
            </label>
          </div>

          <div className="mt-6">
            <button
              id="siswa-login-btn"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !parentConsent}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="spinner" />
                  <span>Memulai Ruang Belajar...</span>
                </div>
              ) : (
                'Mulai Belajar Sekarang ➔'
              )}
            </button>
          </div>
        </form>

        <div className="divider" />

        <div className="text-center">
          <p className="text-xs text-muted mb-2">Anda guru pengajar?</p>
          <a
            href="/guru/login"
            className="text-xs font-semibold text-brand hover:underline"
          >
            Masuk ke Portal Dashboard Guru ➔
          </a>
        </div>
      </div>

      <InstallPrompt variant="siswa" />
    </div>
  );
}

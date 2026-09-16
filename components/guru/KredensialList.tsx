'use client';

import React, { useState } from 'react';
import { Student, StudentCredential } from '@/types';

interface KredensialListProps {
  students: Student[];
  sessionTitle: string;
  sessionId: string;
}

/**
 * Student passwords are stored only as bcrypt hashes, so this list cannot display
 * them. A password exists in readable form for exactly one moment: right after it
 * is generated. The teacher issues a new one instead of recovering the old one.
 */
export function KredensialList({ students, sessionTitle, sessionId }: KredensialListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetCredentials = async (studentIds?: string[]): Promise<StudentCredential[]> => {
    const token = localStorage.getItem('guru_token');
    if (!token) throw new Error('Sesi guru berakhir. Masuk ulang.');

    const res = await fetch(`/api/sesi/${sessionId}/kredensial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(studentIds ? { studentIds } : {}),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal membuat ulang kredensial.');
    return data.credentials as StudentCredential[];
  };

  const handleResetOne = async (student: Student) => {
    setError(null);
    setBusyId(student.id);
    try {
      const [credential] = await resetCredentials([student.id]);
      setIssued((prev) => ({ ...prev, [student.id]: credential.password }));
      await navigator.clipboard.writeText(
        `Username: ${credential.username}\nPassword: ${credential.password}`
      );
      setCopiedId(student.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat ulang kredensial.');
    } finally {
      setBusyId(null);
    }
  };

  const handleResetAll = async () => {
    const confirmed = window.confirm(
      `Buat ulang password untuk seluruh ${students.length} siswa?\n\n` +
        'Password lama langsung tidak berlaku, dan password baru hanya ditampilkan sekali. ' +
        'Salin daftarnya sebelum menutup halaman ini.'
    );
    if (!confirmed) return;

    setError(null);
    setIsResettingAll(true);
    try {
      const credentials = await resetCredentials();
      setIssued(Object.fromEntries(credentials.map((c) => [c.id, c.password])));

      const header =
        `📋 DAFTAR AKUN PAMONG AI\nSesi: ${sessionTitle}\n` +
        `Link: ${window.location.origin}/siswa/login\n\n`;
      const body = credentials
        .map(
          (c, i) =>
            `${i + 1}. ${c.displayName}\n   Username: ${c.username}\n   Password: ${c.password}`
        )
        .join('\n\n');

      await navigator.clipboard.writeText(header + body);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat ulang kredensial.');
    } finally {
      setIsResettingAll(false);
    }
  };

  const hasIssued = Object.keys(issued).length > 0;

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div>
          <h3
            style={{
              fontSize: '1.0625rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Kredensial Siswa ({students.length} Akun Otomatis)
          </h3>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              marginTop: '2px',
            }}
          >
            Password disimpan terenkripsi dan tidak bisa dilihat lagi. Untuk siswa yang lupa,
            buat password baru lewat tombol 🔑.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          style={{
            width: 'auto',
            minHeight: '38px',
            padding: '8px 16px',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: '10px',
          }}
          onClick={handleResetAll}
          disabled={isResettingAll}
        >
          {isResettingAll
            ? 'Membuat ulang…'
            : copiedAll
              ? '✅ Tersalin untuk WhatsApp!'
              : '🔑 Buat Ulang Semua & Salin'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '0.8125rem',
            color: 'var(--status-red)',
            background: 'var(--status-red-bg)',
            border: '1px solid var(--status-red)',
          }}
        >
          {error}
        </div>
      )}

      {hasIssued && (
        <div
          role="status"
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '0.8125rem',
            color: 'var(--status-yellow)',
            background: 'var(--status-yellow-bg)',
            border: '1px solid var(--status-yellow)',
          }}
        >
          ⚠️ Password baru di bawah hanya ditampilkan sekali. Setelah halaman ini ditutup,
          password tidak dapat ditampilkan lagi — hanya bisa dibuat ulang.
        </div>
      )}

      <div className="credential-grid">
        {students.map((student) => {
          const password = issued[student.id];

          return (
            <div key={student.id} className="credential-item" style={{ padding: '12px 14px' }}>
              <div className="credential-info">
                <div
                  style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}
                  className="truncate"
                >
                  {student.displayName}
                </div>
                <div
                  className="credential-username"
                  style={{ fontSize: '0.8125rem', marginTop: '2px' }}
                >
                  {student.username}
                </div>
                <div
                  className="credential-password"
                  style={{
                    fontSize: '0.75rem',
                    marginTop: '2px',
                    color: password ? 'var(--status-yellow)' : 'var(--text-muted)',
                  }}
                >
                  {password ? `Pass: ${password}` : 'Pass: tersimpan terenkripsi'}
                </div>
              </div>
              <button
                className="btn btn-ghost"
                style={{
                  width: '36px',
                  height: '36px',
                  minHeight: '36px',
                  padding: 0,
                  borderRadius: '8px',
                  fontSize: '16px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                }}
                onClick={() => handleResetOne(student)}
                disabled={busyId === student.id}
                title="Buat password baru & salin"
                aria-label={`Buat password baru untuk ${student.displayName}`}
              >
                {busyId === student.id ? '…' : copiedId === student.id ? '✓' : '🔑'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

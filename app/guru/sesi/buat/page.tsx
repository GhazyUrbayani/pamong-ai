'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import aiThemes from '@/config/ai-themes.json';
import { GUARDIAN_CONSENT_STATEMENT } from '@/types';

export default function BuatSesiPage() {
  const router = useRouter();
  const [className, setClassName] = useState('Kelas 10-A');
  const [title, setTitle] = useState('Fotosintesis dan Ekosistem');
  const [subject, setSubject] = useState('Biologi');
  const [selectedTheme, setSelectedTheme] = useState('biologi');
  const [maxStudents, setMaxStudents] = useState(20);
  const [quotaPerStudent, setQuotaPerStudent] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);

  const CLASS_PRESETS = ['Kelas 10-A', 'Kelas 10-B', 'Kelas 10-C', 'Kelas 11-IPA 1', 'Kelas 11-IPA 2', 'Kelas 12-MIPA 1'];

  useEffect(() => {
    const token = localStorage.getItem('guru_token');
    if (!token) {
      router.push('/guru/login');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const token = localStorage.getItem('guru_token');

    try {
      const fullTitle = `${className} • ${title.trim()}`;
      const fullSubject = `${subject.trim()} (${className})`;

      const res = await fetch('/api/sesi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: fullTitle,
          subject: fullSubject,
          aiTheme: selectedTheme,
          maxStudents: Number(maxStudents),
          quotaPerStudent: Number(quotaPerStudent),
          guardianConsent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat sesi.');
      }

      router.push(`/guru/dashboard?sesiId=${data.session.id}`);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-12" style={{ background: 'var(--bg-base)' }}>
      <header className="page-header justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/guru/dashboard')}
            className="btn btn-ghost"
            style={{ width: 'auto', minHeight: '36px', padding: '6px 12px' }}
          >
            ← Kembali ke Dashboard
          </button>
          <h1 className="font-bold text-base">Buat Sesi Kelas Baru</h1>
        </div>
      </header>

      <main className="page-container mt-6">
        <div className="card-elevated" style={{ padding: '28px' }}>
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Rombel / Class Preset Selection */}
            <div className="field">
              <label className="label" htmlFor="className">
                Tingkat / Rombel Kelas
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                {CLASS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setClassName(preset)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      backgroundColor: className === preset ? 'var(--brand-primary)' : 'var(--bg-elevated)',
                      color: className === preset ? '#ffffff' : 'var(--text-secondary)',
                      border: `1px solid ${className === preset ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    🏫 {preset}
                  </button>
                ))}
              </div>
              <input
                id="className"
                className="input"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Contoh: Kelas 10-A atau Kelas 11-IPA 1"
                required
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="title">
                Judul Sesi / Materi Pelajaran
              </label>
              <input
                id="title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Fotosintesis & Metabolisme Tumbuhan"
                required
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="subject">
                Mata Pelajaran
              </label>
              <input
                id="subject"
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Contoh: Biologi / Fisika / Kimia / Matematika"
                required
              />
            </div>


            <div className="field">
              <label className="label">
                Pilih Karakter & Tema AI Tutor
              </label>
              <p className="text-xs text-muted mb-2">
                Tampilan visual, avatar, dan gaya bahasa tutor AI akan disesuaikan dengan mapel
              </p>
              <div className="theme-picker">
                {Object.entries(aiThemes).map(([key, theme]) => (
                  <button
                    type="button"
                    key={key}
                    className={`theme-option ${selectedTheme === key ? 'selected' : ''}`}
                    onClick={() => setSelectedTheme(key)}
                  >
                    <span style={{ fontSize: '20px' }}>{theme.avatar}</span>
                    <div className="text-left">
                      <div>{theme.fullName}</div>
                      <div className="text-xs text-muted capitalize">{key}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 my-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label className="label" htmlFor="maxStudents">
                  Kapasitas Siswa (Maks 20)
                </label>
                <input
                  id="maxStudents"
                  type="number"
                  min={1}
                  max={20}
                  className="input"
                  value={maxStudents}
                  onChange={(e) => setMaxStudents(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="quotaPerStudent">
                  Kuota Pesan / Siswa
                </label>
                <input
                  id="quotaPerStudent"
                  type="number"
                  min={5}
                  max={50}
                  className="input"
                  value={quotaPerStudent}
                  onChange={(e) => setQuotaPerStudent(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Guardian-consent attestation. The school obtains the consent itself;
                this records who attested, when, and to exactly which wording, which
                is what UU PDP requires a controller to be able to demonstrate. */}
            <label
              htmlFor="guardian-consent"
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                marginTop: '20px',
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg-elevated)',
                border: `1px solid ${guardianConsent ? 'var(--status-green)' : 'var(--border-subtle)'}`,
                cursor: 'pointer',
              }}
            >
              <input
                id="guardian-consent"
                type="checkbox"
                checked={guardianConsent}
                onChange={(e) => setGuardianConsent(e.target.checked)}
                style={{ marginTop: '3px', width: '18px', height: '18px', flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                {GUARDIAN_CONSENT_STATEMENT.replace(/^v\d+: /, '')}
                <br />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Konfirmasi ini dicatat bersama waktu dan versi pernyataannya.
                </span>
              </span>
            </label>

            <button
              id="buat-sesi-submit"
              type="submit"
              className="btn btn-primary mt-4"
              disabled={isLoading || !guardianConsent}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="spinner" />
                  <span>Membuat Sesi & 20 Akun Siswa...</span>
                </div>
              ) : (
                '🚀 Buat Sesi & Generate Kredensial Siswa'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

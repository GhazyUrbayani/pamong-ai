'use client';

import React, { useState } from 'react';

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onQuickStudentDemo?: () => void;
}

export function OnboardingTour({ isOpen, onClose, onQuickStudentDemo }: OnboardingTourProps) {
  const [activeTab, setActiveTab] = useState<'flow' | 'bloom' | 'demo'>('flow');
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const STEPS = [
    {
      title: 'Buat Sesi & Unggah Modul (RAG Anti-Halusinasi)',
      badge: 'Langkah 1',
      icon: '📚',
      desc: 'Guru membuat sesi kelas dan mengunggah dokumen materi (PDF/TXT). AI Tutor mengindeks konten tersebut sehingga seluruh jawaban siswa 100% terkunci pada modul resmi tanpa keluar topik atau halusinasi.',
      highlight: 'AI menolak menjawab hal di luar modul pembelajaran kelas.',
    },
    {
      title: 'Bagikan Akun Siswa (Tanpa Registrasi Rumit)',
      badge: 'Langkah 2',
      icon: '👥',
      desc: 'Setiap sesi otomatis menghasilkan 20 kredensial akun siswa Indonesia dengan username dan password mudah diingat. Guru dapat mengunduh daftar akun atau membagikan langsung.',
      highlight: 'Kode Room Kolaborasi untuk belajar bareng teman sejawat.',
    },
    {
      title: 'Pantau Distribusi Kognitif Bloom (Real-time)',
      badge: 'Langkah 3',
      icon: '📊',
      desc: 'Saat siswa berdiskusi dengan Pamong AI, setiap pertanyaan diklasifikasikan ke 3 tingkat kognitif: Hafalan (C1-C2), Pemahaman (C3-C4), dan Analisis (C5-C6). Dashboard guru diperbarui instan via Server-Sent Events.',
      highlight: 'Deteksi dini: langsung tahu siswa mana yang berpikir kritis vs terjebak hafalan.',
    },
    {
      title: 'Intervensi Pedagogis Terarah',
      badge: 'Langkah 4',
      icon: '💡',
      desc: 'Klik baris nama siswa di tabel dashboard untuk melihat transkrip percakapan turn-by-turn dan rekomendasi tindakan guru, misalnya pertanyaan pemantik "Mengapa" bagi siswa dominan hafalan.',
      highlight: 'Guru dapat memberikan bimbingan personal secara tepat sasaran.',
    },
  ];

  const TAB_ITEMS = [
    { key: 'flow' as const, label: 'Alur Kerja (4 Langkah)', icon: '🚀' },
    { key: 'bloom' as const, label: 'Taksonomi Bloom', icon: '🧠' },
    { key: 'demo' as const, label: 'Panduan Demo Siswa', icon: '🎭' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: 'hsla(230, 25%, 4%, 0.88)',
        backdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--border-radius-xl)',
          boxShadow: '0 24px 64px hsla(230, 50%, 4%, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px',
                fontSize: '22px',
                background: 'hsla(245, 62%, 60%, 0.15)',
                border: '1px solid hsla(245, 62%, 60%, 0.3)',
              }}
            >
              🦉
            </div>
            <div>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Panduan Guru — Pamong AI
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Platform AI Tutor Pembelajaran Taksonomi Bloom Berbasis Modul
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{
              width: '36px',
              height: '36px',
              minHeight: 'unset',
              padding: 0,
              fontSize: '1.125rem',
              borderRadius: '8px',
              color: 'var(--text-muted)',
            }}
            aria-label="Tutup panduan"
          >
            ✕
          </button>
        </div>

        {/* Tabs - using pure CSS class to avoid shorthand/longhand border conflict */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
            padding: '0 16px',
            gap: '8px',
          }}
        >
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tour-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, maxHeight: '60vh' }}>

          {/* TAB: Flow */}
          {activeTab === 'flow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Step pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {STEPS.map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    style={{
                      padding: '10px',
                      borderRadius: '12px',
                      textAlign: 'left',
                      background: currentStep === idx ? 'hsla(245, 62%, 60%, 0.12)' : 'var(--bg-input)',
                      borderTop: '1px solid ' + (currentStep === idx ? 'hsla(245, 62%, 60%, 0.4)' : 'var(--border-subtle)'),
                      borderLeft: '1px solid ' + (currentStep === idx ? 'hsla(245, 62%, 60%, 0.4)' : 'var(--border-subtle)'),
                      borderRight: '1px solid ' + (currentStep === idx ? 'hsla(245, 62%, 60%, 0.4)' : 'var(--border-subtle)'),
                      borderBottom: '1px solid ' + (currentStep === idx ? 'hsla(245, 62%, 60%, 0.4)' : 'var(--border-subtle)'),
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: currentStep === idx ? 'var(--brand-accent)' : 'var(--text-muted)' }}>
                      {step.badge}
                    </div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {step.icon} {step.title.split('(')[0].trim()}
                    </div>
                  </button>
                ))}
              </div>

              {/* Active step detail */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      background: 'hsla(245, 62%, 60%, 0.15)',
                      color: 'var(--brand-accent)',
                      border: '1px solid hsla(245, 62%, 60%, 0.3)',
                    }}
                  >
                    {STEPS[currentStep].badge}
                  </span>
                  <span style={{ fontSize: '1.5rem' }}>{STEPS[currentStep].icon}</span>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em' }}>
                  {STEPS[currentStep].title}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '14px' }}>
                  {STEPS[currentStep].desc}
                </p>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    background: 'hsla(152, 65%, 52%, 0.08)',
                    color: 'var(--status-green)',
                    border: '1px solid hsla(152, 65%, 52%, 0.2)',
                  }}
                >
                  ✦ {STEPS[currentStep].highlight}
                </div>

                {/* Navigation */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '18px',
                    paddingTop: '14px',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <button
                    disabled={currentStep === 0}
                    onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
                    className="btn btn-ghost"
                    style={{ width: 'auto', minHeight: '34px', padding: '6px 14px', fontSize: '0.8125rem' }}
                  >
                    ← Sebelumnya
                  </button>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {currentStep + 1} / {STEPS.length}
                  </span>
                  <button
                    onClick={() => currentStep < STEPS.length - 1 ? setCurrentStep((p) => p + 1) : setActiveTab('bloom')}
                    className="btn btn-primary"
                    style={{ width: 'auto', minHeight: '34px', padding: '6px 16px', fontSize: '0.8125rem' }}
                  >
                    {currentStep < STEPS.length - 1 ? 'Berikutnya →' : 'Lihat Status Bloom →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Bloom */}
          {activeTab === 'bloom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '4px' }}>
                Pamong AI menggunakan <strong>Gemini 3.7 Flash</strong> untuk mengklasifikasikan setiap pertanyaan siswa secara real-time ke dalam 3 spektrum Taksonomi Bloom:
              </p>

              <BloomLevelCard
                color="var(--status-green)"
                title="Analisis / HOTS (C5–C6)"
                desc="Siswa bertanya mengenai perbandingan sebab-akibat mendalam, evaluasi dampak, atau studi kasus kritis."
                example={'"Bagaimana jika intensitas cahaya dinaikkan tetapi CO₂ terbatas, apakah laju fotosintesis tetap naik?"'}
                tier="Tingkat Tinggi (HOTS)"
              />
              <BloomLevelCard
                color="var(--status-blue)"
                title="Pemahaman / MOTS (C3–C4)"
                desc='Siswa bertanya mengenai mekanisme proses, penjelasan konsep sistem, alasan "mengapa", atau fungsi keterkaitan.'
                example={'"Mengapa reaksi terang membutuhkan air (H₂O) dan apa fungsi fotolisis?"'}
                tier="Tingkat Sedang (MOTS)"
              />
              <BloomLevelCard
                color="var(--status-yellow)"
                title="Hafalan / LOTS (C1–C2)"
                desc="Siswa hanya menanyakan definisi kata, rumus singkat, atau hafalan nama tanpa menggali makna konsep lebih lanjut."
                example={'"Apa rumus glukosa?" • "Di mana letak klorofil?"'}
                tier="Tingkat Dasar (LOTS)"
              />
            </div>
          )}

          {/* TAB: Demo */}
          {activeTab === 'demo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  background: 'hsla(245, 62%, 60%, 0.06)',
                  border: '1px solid hsla(245, 62%, 60%, 0.2)',
                }}
              >
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Eksplorasi Pengalaman Siswa
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
                  Uji dan peragakan bagaimana siswa berinteraksi dengan AI Tutor di ruang belajar:
                </p>
                <ol style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', listStyle: 'decimal', paddingLeft: '20px', lineHeight: 2 }}>
                  <li><strong>Pratinjau 1-Klik:</strong> Buka ruang chat sebagai <code style={{ color: 'var(--brand-accent)', fontWeight: 600 }}>Ahmad Fauzi</code> (siswa HOTS).</li>
                  <li><strong>Coba Pertanyaan Pemantik:</strong> Klik prompt chip yang tersedia atau ketik pertanyaan biologi kritis.</li>
                  <li><strong>Cek Halaman Progres:</strong> Buka tab <em>Progress</em> di navigasi bawah siswa untuk melihat grafik Bloom pribadi.</li>
                </ol>

                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '14px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <span className="font-mono" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Preset: ahmad.fauzi / belajar123
                  </span>
                  {onQuickStudentDemo && (
                    <button
                      onClick={onQuickStudentDemo}
                      className="btn btn-primary"
                      style={{ width: 'auto', minHeight: '36px', padding: '8px 18px', fontSize: '0.875rem' }}
                    >
                      🎭 Buka Tampilan Siswa →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Pamong AI • Platform AI Pendidikan Generasi Baru
          </span>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ width: 'auto', minHeight: '36px', padding: '8px 18px', fontSize: '0.875rem' }}
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Bloom Level Card ──────────────────────────────────────── */
function BloomLevelCard({
  color,
  title,
  desc,
  example,
  tier,
}: {
  color: string;
  title: string;
  desc: string;
  example: string;
  tier: string;
}) {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '14px',
        background: `color-mix(in srgb, ${color} 6%, transparent)`,
        borderTop: `1px solid color-mix(in srgb, ${color} 24%, transparent)`,
        borderLeft: `1px solid color-mix(in srgb, ${color} 24%, transparent)`,
        borderRight: `1px solid color-mix(in srgb, ${color} 24%, transparent)`,
        borderBottom: `1px solid color-mix(in srgb, ${color} 24%, transparent)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.9375rem', fontWeight: 700, color }}>{title}</span>
        <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color, opacity: 0.9 }}>{tier}</span>
      </div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.6 }}>
        {desc}
      </p>
      <div
        className="font-mono"
        style={{
          fontSize: '0.8125rem',
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          border: '1px solid var(--border-subtle)',
        }}
      >
        {example}
      </div>
    </div>
  );
}


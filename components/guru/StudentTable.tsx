'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudentStats, Message } from '@/types';

interface StudentTableProps {
  students: StudentStats[];
  quotaTotal: number;
}

export function StudentTable({ students, quotaTotal }: StudentTableProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'hijau' | 'pemahaman' | 'merah' | 'netral'>('all');
  const [search, setSearch] = useState('');
  
  // Selected student for conversation detail modal
  const [selectedStudent, setSelectedStudent] = useState<StudentStats | null>(null);
  const [studentMessages, setStudentMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Filter students based on status and search query
  const filteredStudents = students.filter((student) => {
    const total = student.levels.hafalan + student.levels.pemahaman + student.levels.analisis;
    const matchesSearch =
      student.displayName.toLowerCase().includes(search.toLowerCase()) ||
      student.username.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'hijau') return student.status === 'hijau';
    if (filter === 'merah') return student.status === 'merah';
    if (filter === 'pemahaman') return student.status === 'netral' && total > 0;
    if (filter === 'netral') return total === 0;
    return true;
  });

  const greenCount = students.filter((s) => s.status === 'hijau').length;
  const redCount = students.filter((s) => s.status === 'merah').length;
  const pemahamanCount = students.filter(
    (s) => s.status === 'netral' && s.levels.hafalan + s.levels.pemahaman + s.levels.analisis > 0
  ).length;
  const inactiveCount = students.filter(
    (s) => s.levels.hafalan + s.levels.pemahaman + s.levels.analisis === 0
  ).length;

  const handleOpenStudentModal = async (student: StudentStats) => {
    setSelectedStudent(student);
    setIsLoadingMessages(true);

    try {
      const token = localStorage.getItem('guru_token');
      const res = await fetch(`/api/guru/student-chat/${student.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudentMessages(data.messages || []);
      }
    } catch (err) {
      console.error('[StudentTable] Failed to load messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleLoginAsStudent = async (student: StudentStats) => {
    try {
      const res = await fetch('/api/auth/siswa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: student.username,
          password: 'belajar123', // Demo default
        }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('siswa_token', data.token);
        localStorage.setItem('siswa_data', JSON.stringify(data.student));
        localStorage.setItem('siswa_session', JSON.stringify(data.session));
        window.open('/siswa/chat', '_blank');
      } else {
        router.push('/siswa/login');
      }
    } catch {
      router.push('/siswa/login');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className="transition-all"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              backgroundColor: filter === 'all' ? 'var(--brand-primary)' : 'var(--bg-card)',
              color: filter === 'all' ? '#ffffff' : 'var(--text-secondary)',
              border: `1px solid ${filter === 'all' ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
            }}
          >
            Semua ({students.length})
          </button>

          <button
            onClick={() => setFilter('hijau')}
            className="transition-all"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              backgroundColor: filter === 'hijau' ? 'var(--status-green-bg)' : 'var(--bg-card)',
              color: filter === 'hijau' ? 'var(--status-green)' : 'var(--text-secondary)',
              border: `1px solid ${filter === 'hijau' ? 'var(--status-green)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
            }}
          >
            🟢 HOTS / Analisis ({greenCount})
          </button>

          <button
            onClick={() => setFilter('pemahaman')}
            className="transition-all"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              backgroundColor: filter === 'pemahaman' ? 'var(--status-blue-bg)' : 'var(--bg-card)',
              color: filter === 'pemahaman' ? 'var(--status-blue)' : 'var(--text-secondary)',
              border: `1px solid ${filter === 'pemahaman' ? 'var(--status-blue)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
            }}
          >
            🔵 Pemahaman ({pemahamanCount})
          </button>

          <button
            onClick={() => setFilter('merah')}
            className="transition-all"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              backgroundColor: filter === 'merah' ? 'var(--status-red-bg)' : 'var(--bg-card)',
              color: filter === 'merah' ? 'var(--status-red)' : 'var(--text-secondary)',
              border: `1px solid ${filter === 'merah' ? 'var(--status-red)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
            }}
          >
            🟠 Butuh Bimbingan ({redCount})
          </button>

          <button
            onClick={() => setFilter('netral')}
            className="transition-all"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              backgroundColor: filter === 'netral' ? 'var(--bg-hover)' : 'var(--bg-card)',
              color: filter === 'netral' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: `1px solid ${filter === 'netral' ? 'var(--brand-accent)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
            }}
          >
            ⚪ Belum Aktif ({inactiveCount})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ minWidth: '260px', flex: '1', maxWidth: '340px' }}>
          <input
            type="text"
            className="input"
            placeholder="🔍 Cari nama atau username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 14px', height: '40px', fontSize: '0.875rem' }}
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border-default)' }}>
        {filteredStudents.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p className="text-secondary" style={{ fontSize: '0.9375rem' }}>Tidak ada siswa yang sesuai dengan filter pencarian.</p>
          </div>
        ) : (
          <table className="student-table">
            <thead>
              <tr>
                <th>Status Kognitif</th>
                <th>Siswa / Akun</th>
                <th>Chat Terpakai</th>
                <th>Distribusi Taksonomi Bloom</th>
                <th>Rekomendasi Pedagogis</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const total =
                  student.levels.hafalan +
                  student.levels.pemahaman +
                  student.levels.analisis;

                const hafalanPct = total > 0 ? Math.round((student.levels.hafalan / total) * 100) : 0;
                const pemahamanPct = total > 0 ? Math.round((student.levels.pemahaman / total) * 100) : 0;
                const analisisPct = total > 0 ? Math.round((student.levels.analisis / total) * 100) : 0;

                const statusLabel =
                  student.status === 'hijau'
                    ? 'Progresif HOTS'
                    : student.status === 'merah'
                    ? 'Perlu Bimbingan'
                    : total > 0
                    ? 'Pemahaman Aktif'
                    : 'Belum Mulai';

                const pedagogicalTip =
                  student.status === 'hijau'
                    ? '🧠 Pola pikir kritis sangat baik. Siap diberi studi kasus mandiri.'
                    : student.status === 'merah'
                    ? '⚠️ Terjebak hafalan. Berikan pertanyaan pemantik "Mengapa" & "Bagaimana".'
                    : total > 0
                    ? '💡 Memahami konsep dasar dengan baik. Dorong eksplorasi lebih dalam.'
                    : 'Belum ada interaksi chat.';

                return (
                  <tr
                    key={student.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleOpenStudentModal(student)}
                  >
                    <td>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          background:
                            student.status === 'hijau'
                              ? 'var(--status-green-bg)'
                              : student.status === 'merah'
                              ? 'var(--status-red-bg)'
                              : total > 0
                              ? 'var(--status-blue-bg)'
                              : 'transparent',
                        }}
                      >
                        <span
                          className={`status-dot ${
                            student.status === 'hijau'
                              ? 'hijau'
                              : student.status === 'merah'
                              ? 'merah'
                              : total > 0
                              ? 'netral'
                              : 'netral'
                          }`}
                        />
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            color:
                              student.status === 'hijau'
                                ? 'var(--status-green)'
                                : student.status === 'merah'
                                ? 'var(--status-red)'
                                : total > 0
                                ? 'var(--status-blue)'
                                : 'var(--text-muted)',
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex items-center justify-center rounded-full font-bold"
                          style={{
                            width: '38px',
                            height: '38px',
                            fontSize: '0.875rem',
                            backgroundColor:
                              student.status === 'hijau'
                                ? 'rgba(62, 201, 128, 0.15)'
                                : student.status === 'merah'
                                ? 'rgba(234, 84, 84, 0.15)'
                                : 'rgba(99, 102, 241, 0.15)',
                            color:
                              student.status === 'hijau'
                                ? 'var(--status-green)'
                                : student.status === 'merah'
                                ? 'var(--status-red)'
                                : 'var(--brand-accent)',
                            flexShrink: 0,
                          }}
                        >
                          {student.displayName.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                            {student.displayName}
                          </div>
                          <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {student.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="font-mono" style={{ fontSize: '0.875rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--brand-accent)' }}>{student.chatUsed}</span>
                        <span style={{ color: 'var(--text-muted)' }}> / {quotaTotal}</span>
                      </div>
                      <div
                        className="quota-track"
                        style={{ height: '5px', width: '90px', backgroundColor: 'var(--bg-input)', marginTop: '6px' }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, (student.chatUsed / quotaTotal) * 100)}%`,
                            height: '100%',
                            backgroundColor:
                              student.chatUsed >= quotaTotal
                                ? 'var(--status-red)'
                                : student.chatUsed >= quotaTotal * 0.75
                                ? 'var(--status-yellow)'
                                : 'var(--brand-primary)',
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                    </td>

                    <td>
                      <div style={{ minWidth: '190px' }}>
                        <div className="level-bar" style={{ height: '8px', marginBottom: '6px', borderRadius: '4px' }}>
                          <div
                            className="level-bar-segment hafalan"
                            style={{ width: `${hafalanPct}%` }}
                            title={`Hafalan C1-C2: ${student.levels.hafalan} (${hafalanPct}%)`}
                          />
                          <div
                            className="level-bar-segment pemahaman"
                            style={{ width: `${pemahamanPct}%` }}
                            title={`Pemahaman C3-C4: ${student.levels.pemahaman} (${pemahamanPct}%)`}
                          />
                          <div
                            className="level-bar-segment analisis"
                            style={{ width: `${analisisPct}%` }}
                            title={`Analisis C5-C6: ${student.levels.analisis} (${analisisPct}%)`}
                          />
                        </div>
                        <div
                          className="flex justify-between font-mono"
                          style={{ fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          <span style={{ color: 'var(--level-hafalan)' }}>H: {hafalanPct}%</span>
                          <span style={{ color: 'var(--level-pemahaman)' }}>P: {pemahamanPct}%</span>
                          <span style={{ color: 'var(--level-analisis)' }}>A: {analisisPct}%</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '280px' }}>
                        {pedagogicalTip}
                      </p>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenStudentModal(student);
                        }}
                        className="btn btn-secondary"
                        style={{
                          width: 'auto',
                          minHeight: '34px',
                          padding: '6px 14px',
                          fontSize: '0.8125rem',
                          borderRadius: '8px',
                          fontWeight: 600,
                        }}
                      >
                        🔍 Percakapan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Student Conversation Inspection Modal */}
      {selectedStudent && (
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
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="card-elevated"
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 24px 64px hsla(230, 50%, 4%, 0.8)',
              borderRadius: 'var(--border-radius-xl)',
              overflow: 'hidden',
              padding: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
              <div className="flex items-center gap-3.5">
                <div
                  className="flex items-center justify-center rounded-full font-bold"
                  style={{
                    width: '46px',
                    height: '46px',
                    fontSize: '1.125rem',
                    backgroundColor: 'hsla(245, 62%, 60%, 0.2)',
                    color: 'var(--brand-accent)',
                  }}
                >
                  {selectedStudent.displayName.charAt(0)}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedStudent.displayName}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        backgroundColor:
                          selectedStudent.status === 'hijau'
                            ? 'var(--status-green-bg)'
                            : selectedStudent.status === 'merah'
                            ? 'var(--status-red-bg)'
                            : 'var(--bg-hover)',
                        color:
                          selectedStudent.status === 'hijau'
                            ? 'var(--status-green)'
                            : selectedStudent.status === 'merah'
                            ? 'var(--status-red)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      {selectedStudent.status === 'hijau'
                        ? '🟢 Progresif HOTS'
                        : selectedStudent.status === 'merah'
                        ? '🟠 Butuh Bimbingan'
                        : '🔵 Pemahaman Aktif'}
                    </span>
                  </h3>
                  <p className="font-mono" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Username: {selectedStudent.username} • Chat Terpakai: {selectedStudent.chatUsed}/{quotaTotal} pesan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => handleLoginAsStudent(selectedStudent)}
                  className="btn btn-primary"
                  style={{ width: 'auto', minHeight: '36px', padding: '6px 14px', fontSize: '0.8125rem' }}
                  title="Buka interface ruang belajar siswa ini"
                >
                  🎭 Coba Sebagai Siswa Ini ➔
                </button>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="btn btn-ghost"
                  style={{ width: '36px', height: '36px', minHeight: 'unset', padding: 0, fontSize: '1.125rem', borderRadius: '8px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: Transcript */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '58vh' }}>
              {isLoadingMessages ? (
                <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Memuat percakapan siswa...</p>
                </div>
              ) : studentMessages.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Siswa ini belum memulai percakapan dengan PAMONG AI.
                </div>
              ) : (
                studentMessages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id || index}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}
                    >
                      {/* Level Indicator for student question */}
                      {isUser && msg.questionLevel && (
                        <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              fontWeight: 700,
                              backgroundColor:
                                msg.questionLevel === 'analisis'
                                  ? 'var(--level-analisis-bg)'
                                  : msg.questionLevel === 'pemahaman'
                                  ? 'var(--level-pemahaman-bg)'
                                  : 'var(--level-hafalan-bg)',
                              color:
                                msg.questionLevel === 'analisis'
                                  ? 'var(--level-analisis)'
                                  : msg.questionLevel === 'pemahaman'
                                  ? 'var(--level-pemahaman)'
                                  : 'var(--level-hafalan)',
                              border: `1px solid ${
                                msg.questionLevel === 'analisis'
                                  ? 'var(--level-analisis)'
                                  : msg.questionLevel === 'pemahaman'
                                  ? 'var(--level-pemahaman)'
                                  : 'var(--level-hafalan)'
                              }`,
                            }}
                          >
                            {msg.questionLevel === 'analisis'
                              ? '🧠 Analisis / HOTS (C5-C6)'
                              : msg.questionLevel === 'pemahaman'
                              ? '💡 Pemahaman / Konsep (C3-C4)'
                              : '📖 Hafalan / Fakta (C1-C2)'}
                          </span>
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        style={{
                          padding: '14px 18px',
                          borderRadius: '16px',
                          fontSize: '0.9375rem',
                          maxWidth: '85%',
                          backgroundColor: isUser ? 'var(--brand-primary)' : 'var(--bg-elevated)',
                          color: isUser ? '#ffffff' : 'var(--text-primary)',
                          border: isUser ? 'none' : '1px solid var(--border-default)',
                          borderBottomRightRadius: isUser ? '3px' : '16px',
                          borderBottomLeftRadius: !isUser ? '3px' : '16px',
                          lineHeight: 1.6,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '4px', opacity: 0.8 }}>
                          {isUser ? selectedStudent.displayName : '🦉 PAMONG AI Tutor'}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer: Pedagogical Recommendations */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Analisis Kognitif AI: Evaluasi berkala berdasarkan Taksonomi Bloom (C1-C6).
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="btn btn-secondary"
                style={{ width: 'auto', minHeight: '34px', padding: '6px 16px', fontSize: '0.8125rem' }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


'use client';

import React, { useState } from 'react';
import { Message, StudentStats } from '@/types';
import { Badge } from '@/components/ui/Badge';

type DataMode = 'demo' | 'real';

export function StudentTable({
  students,
  quotaTotal,
  dataMode,
}: {
  students: StudentStats[];
  quotaTotal: number;
  dataMode: DataMode;
}) {
  type FilterKey = 'all' | 'active' | 'unknown' | 'inactive';

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Sudah bertanya' },
    { key: 'unknown', label: 'Ada belum terklasifikasi' },
    { key: 'inactive', label: 'Belum aktif' },
  ];

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StudentStats | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const filtered = students.filter((student) => {
    const match =
      student.displayName.toLowerCase().includes(search.toLowerCase()) ||
      student.username.toLowerCase().includes(search.toLowerCase());
    if (!match) return false;
    if (filter === 'active') return student.chatUsed > 0;
    if (filter === 'unknown') return student.unclassified > 0;
    if (filter === 'inactive') return student.chatUsed === 0;
    return true;
  });

  const open = async (student: StudentStats) => {
    setSelected(student);
    setLoading(true);
    setMessages([]);

    try {
      const token = localStorage.getItem('guru_token');
      const response = await fetch(
        '/api/guru/student-chat/' + student.id + '?mode=' + dataMode,
        { headers: { Authorization: 'Bearer ' + token } }
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        {filters.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={'btn ' + (filter === item.key ? 'btn-secondary filter-active' : 'btn-ghost')}
            style={{ width: 'auto', minHeight: 36 }}
          >
            {item.label}
          </button>
        ))}
        <input
          className="input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari siswa..."
          style={{ maxWidth: 300 }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="student-table">
          <thead>
            <tr>
              <th>Siswa</th>
              <th>Chat</th>
              <th>{dataMode === 'demo' ? 'Distribusi contoh sintetik' : 'Distribusi pertanyaan valid'}</th>
              <th>Belum terklasifikasi</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => {
              const syntheticTotal =
                student.categories.hafalan +
                student.categories.pemahaman +
                student.categories.analisis;
              const denominator = dataMode === 'demo' ? syntheticTotal : student.validClassified;
              const percentage = (count: number) =>
                denominator ? Math.round((count / denominator) * 100) : 0;

              return (
                <tr
                  key={student.id}
                  onClick={() => open(student)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <strong>{student.displayName}</strong>
                    <div className="font-mono text-xs text-muted">{student.username}</div>
                  </td>
                  <td>
                    {student.chatUsed} / {quotaTotal}
                  </td>
                  <td>
                    <div className="level-bar" style={{ minWidth: 180, height: 8 }}>
                      <div
                        className="level-bar-segment hafalan"
                        style={{ width: String(percentage(student.categories.hafalan)) + '%' }}
                      />
                      <div
                        className="level-bar-segment pemahaman"
                        style={{ width: String(percentage(student.categories.pemahaman)) + '%' }}
                      />
                      <div
                        className="level-bar-segment analisis"
                        style={{ width: String(percentage(student.categories.analisis)) + '%' }}
                      />
                    </div>
                    <div className="text-xs mt-1">
                      F {percentage(student.categories.hafalan)}% · P{' '}
                      {percentage(student.categories.pemahaman)}% · R{' '}
                      {percentage(student.categories.analisis)}%
                    </div>
                  </td>
                  <td>{student.unclassified}</td>
                  <td className="text-xs text-secondary">
                    {dataMode === 'demo'
                      ? denominator
                        ? 'Data sintetik untuk preview UI — bukan hasil model.'
                        : 'Belum ada contoh aktivitas sintetik.'
                      : denominator
                        ? 'Distribusi dari ' + denominator + ' klasifikasi model valid.'
                        : 'Belum ada klasifikasi model valid.'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'hsla(230,25%,4%,.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            className="card-elevated"
            style={{ maxWidth: 720, width: '100%', maxHeight: '88vh', overflow: 'auto' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold">{selected.displayName}</h3>
                  {dataMode === 'demo' && <span className="data-status-pill demo">SINTETIK</span>}
                </div>
                <p className="text-xs text-muted mt-1">
                  {selected.chatUsed} pesan · {selected.unclassified} belum terklasifikasi
                </p>
              </div>
              <button
                className="btn btn-ghost"
                style={{ width: 'auto', minHeight: 36 }}
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>

            {dataMode === 'demo' && (
              <div className="demo-transcript-note">
                Transcript ini contoh sintetik untuk presentasi MVP, bukan percakapan siswa nyata.
              </div>
            )}

            <div className="divider" />

            {loading ? (
              <div className="spinner" />
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    marginBottom: 14,
                    textAlign: message.role === 'user' ? 'right' : 'left',
                  }}
                >
                  {message.role === 'user' && message.questionLevel && (
                    <div style={{ marginBottom: 4 }}>
                      {message.classificationProvenance === 'model' ? (
                        <Badge level={message.questionLevel} />
                      ) : message.classificationProvenance === 'synthetic' ? (
                        <span className="synthetic-category-label">
                          <Badge level={message.questionLevel} />
                          <span>Data sintetik</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted">
                          ❔ Belum terklasifikasi ({message.classificationProvenance || 'legacy'})
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'inline-block',
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background:
                        message.role === 'user'
                          ? 'var(--brand-primary)'
                          : 'var(--bg-elevated)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {message.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

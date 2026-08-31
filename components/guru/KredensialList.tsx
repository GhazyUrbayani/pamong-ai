'use client';

import React, { useState } from 'react';
import { Student } from '@/types';

interface KredensialListProps {
  students: Student[];
  sessionTitle: string;
}

export function KredensialList({ students, sessionTitle }: KredensialListProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copySingle = (student: Student, index: number) => {
    const text = `Username: ${student.username}\nPassword: ${student.passwordPlain}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = () => {
    const header = `📋 DAFTAR AKUN PAMONG AI\nSesi: ${sessionTitle}\nLink: ${window.location.origin}/siswa/login\n\n`;
    const body = students
      .map(
        (s, i) =>
          `${i + 1}. ${s.displayName}\n   Username: ${s.username}\n   Password: ${s.passwordPlain}`
      )
      .join('\n\n');

    navigator.clipboard.writeText(header + body);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 3000);
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div>
          <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Kredensial Siswa ({students.length} Akun Otomatis)
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Bagikan username & password default ini kepada siswa untuk langsung masuk tanpa registrasi.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          style={{ width: 'auto', minHeight: '38px', padding: '8px 16px', fontSize: '0.875rem', fontWeight: 600, borderRadius: '10px' }}
          onClick={copyAll}
        >
          {copiedAll ? '✅ Tersalin untuk WhatsApp!' : '📋 Salin Semua Kredensial'}
        </button>
      </div>

      <div className="credential-grid">
        {students.map((student, idx) => (
          <div key={student.id} className="credential-item" style={{ padding: '12px 14px' }}>
            <div className="credential-info">
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }} className="truncate">
                {student.displayName}
              </div>
              <div className="credential-username" style={{ fontSize: '0.8125rem', marginTop: '2px' }}>
                {student.username}
              </div>
              <div className="credential-password" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                Pass: {student.passwordPlain}
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
              onClick={() => copySingle(student, idx)}
              title="Salin kredensial"
            >
              {copiedIndex === idx ? '✓' : '📋'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


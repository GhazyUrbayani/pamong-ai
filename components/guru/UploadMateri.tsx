'use client';

import React, { useState, useRef } from 'react';

interface UploadMateriProps {
  sessionId: string;
  onSuccess?: (chunksCount: number) => void;
}

export function UploadMateri({ sessionId, onSuccess }: UploadMateriProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setStatusMsg(null);

    const token = localStorage.getItem('guru_token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/sesi/${sessionId}/materi`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengunggah file materi.');
      }

      setStatusMsg({
        type: 'success',
        text: `✅ Berhasil memproses "${file.name}"! AI siap menjawab materi (${data.chunksCount} potongan knowledge base dibuat).`,
      });
      if (onSuccess) onSuccess(data.chunksCount);
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Terjadi kesalahan saat memproses materi.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
        Unggah Modul / Materi Pelajaran (RAG Anti-Halusinasi)
      </h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
        AI Tutor akan mengunci seluruh jawabannya hanya dari materi yang diunggah di sini sehingga 100% relevan dengan kurikulum kelas. Format: PDF, TXT, atau MD (Maks. 10MB).
      </p>

      <div
        className={`upload-area ${isDragging ? 'drag-over' : ''}`}
        style={{ padding: '36px 20px', borderRadius: '16px' }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          onChange={onFileChange}
          disabled={isUploading}
        />
        <div className="flex flex-col items-center gap-3">
          <span style={{ fontSize: '42px' }}>{isUploading ? '⚙️' : '📄'}</span>
          {isUploading ? (
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                Sedang mengekstrak teks & membuat RAG embedding...
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Proses ini memakan waktu beberapa detik.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                Klik atau tarik file modul ke sini
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Mendukung PDF Modul Ajar, Ringkasan Bab, atau Catatan Materi Pelajaran
              </p>
            </div>
          )}
        </div>
      </div>

      {statusMsg && (
        <div
          className="mt-4 p-3.5 rounded-xl text-xs"
          style={{
            backgroundColor: statusMsg.type === 'success' ? 'var(--status-green-bg)' : 'var(--status-red-bg)',
            color: statusMsg.type === 'success' ? 'var(--status-green)' : 'var(--status-red)',
            border: `1px solid ${statusMsg.type === 'success' ? 'var(--status-green)' : 'var(--status-red)'}`,
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          {statusMsg.text}
        </div>
      )}
    </div>
  );
}


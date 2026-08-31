'use client';

import React, { useState, useRef, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  isQuotaExceeded?: boolean;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  isQuotaExceeded = false,
  isLoading = false,
  placeholder = 'Tanyakan sesuatu tentang materi...',
}: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!text.trim() || disabled || isQuotaExceeded || isLoading) return;
    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  if (isQuotaExceeded) {
    return (
      <div className="chat-input-area">
        <div className="card text-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--status-red)' }}>
          <p className="text-sm font-semibold text-primary">
            🎉 Kuota Sesi Ini Telah Terpakai
          </p>
          <p className="text-xs text-secondary mt-1">
            Kamu telah mencapai batas maksimal pesan untuk sesi ini. Silakan berdiskusi dengan guru untuk membuka sesi materi berikutnya!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-input-area">
      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          rows={1}
          className="chat-textarea"
          placeholder={isLoading ? 'Sedang memproses jawaban...' : placeholder}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          aria-label="Ketik pesan pertanyaan ke AI"
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!text.trim() || disabled || isLoading}
          title="Kirim pesan (Enter)"
          aria-label="Kirim pesan"
        >
          {isLoading ? (
            <div className="spinner" style={{ width: '16px', height: '16px' }} />
          ) : (
            '➔'
          )}
        </button>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { AITheme } from '@/types';

interface AICharacterProps {
  theme: AITheme;
  subject: string;
  isTyping?: boolean;
}

export function AICharacter({ theme, subject, isTyping }: AICharacterProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="ai-avatar"
        style={{
          backgroundColor: theme.primaryColor,
          boxShadow: `0 0 15px ${theme.primaryColor}66`,
        }}
      >
        <span>{theme.avatar}</span>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            {theme.fullName}
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${theme.primaryColor}22`,
              color: theme.primaryColor,
              border: `1px solid ${theme.primaryColor}55`,
              fontWeight: 600,
            }}
          >
            {subject}
          </span>
        </div>
        <p className="text-xs text-muted">
          {isTyping ? 'Sedang mengetik jawaban...' : 'Online • Panduan Berbasis Modul'}
        </p>
      </div>
    </div>
  );
}

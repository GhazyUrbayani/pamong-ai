'use client';

import React from 'react';
import { QuestionLevel } from '@/types';

interface BadgeProps {
  level: QuestionLevel;
  className?: string;
}

export function Badge({ level, className = '' }: BadgeProps) {
  const labels: Record<QuestionLevel, { label: string; icon: string }> = {
    hafalan: { label: 'Hafalan / C1-C2', icon: '📖' },
    pemahaman: { label: 'Pemahaman / C3-C4', icon: '💡' },
    analisis: { label: 'Analisis / C5-C6', icon: '🧠' },
  };

  const info = labels[level] || { label: level, icon: '📌' };

  return (
    <span className={`level-badge ${level} ${className}`} title={`Level Kognitif: ${info.label}`}>
      <span>{info.icon}</span>
      <span>{info.label}</span>
    </span>
  );
}

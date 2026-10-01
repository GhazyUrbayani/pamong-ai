'use client';
import React from 'react';
import { QuestionCategory } from '@/types';
export function Badge({ level, className = '' }: { level: QuestionCategory; className?: string }) {
  const labels: Record<QuestionCategory, { label: string; icon: string }> = {
    hafalan: { label: 'Pertanyaan fakta', icon: '📖' },
    pemahaman: { label: 'Pertanyaan penjelasan', icon: '💡' },
    analisis: { label: 'Penerapan / penalaran', icon: '🧠' },
    unclassified: { label: 'Belum terklasifikasi', icon: '❔' },
  };
  const info=labels[level];
  return <span className={'level-badge '+level+' '+className} title={'Kategori pertanyaan: '+info.label}><span>{info.icon}</span><span>{info.label}</span></span>;
}

'use client';

import React from 'react';

interface QuotaCounterProps {
  used: number;
  total: number;
}

export function QuotaCounter({ used, total }: QuotaCounterProps) {
  const percentage = Math.min(100, Math.round((used / total) * 100));
  const remaining = Math.max(0, total - used);

  let fillClass = '';
  if (percentage >= 85) {
    fillClass = 'critical';
  } else if (percentage >= 60) {
    fillClass = 'warning';
  }

  return (
    <div className="quota-bar" title={`Kuota: ${used}/${total} pesan terpakai`}>
      <div className="flex items-center gap-1 text-xs text-secondary font-mono">
        <span>⚡</span>
        <span>Kuota:</span>
      </div>
      <div className="quota-track">
        <div
          className={`quota-fill ${fillClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="quota-label font-mono font-semibold">
        {remaining} sisa ({used}/{total})
      </span>
    </div>
  );
}

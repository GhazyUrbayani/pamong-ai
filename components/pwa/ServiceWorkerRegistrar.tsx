'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker on the client side.
 * This is a client component so it can use useEffect.
 * Kept separate from layout so it's a thin wrapper with no UI.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[SW] Registered, scope:', reg.scope);
        })
        .catch((err) => {
          console.error('[SW] Registration failed:', err);
        });
    }
  }, []);

  return null;
}

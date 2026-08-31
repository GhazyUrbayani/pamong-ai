'use client';

import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { id: 'chat',     label: 'Chat',     icon: '💬', path: '/siswa/chat' },
  { id: 'progress', label: 'Progress', icon: '📊', path: '/siswa/progress' },
  { id: 'profil',   label: 'Profil',   icon: '👤', path: '/siswa/profil' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navigasi utama siswa">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.path);
        return (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => router.push(item.path)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

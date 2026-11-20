'use client';
import { useRouter } from 'next/navigation';
import { EXTRA_MENUS, useExtraMenus } from '@/lib/menuSettings';

// Strip menu aktif (Pengaturan > Menu Tambahan) yang bisa digeser ke samping. Tidak ada yang aktif = tidak tampil.
export default function QuickMenu() {
  const router = useRouter();
  const extras = useExtraMenus();
  const items = EXTRA_MENUS.filter((m) => extras.includes(m.key));
  if (items.length === 0) return null;

  return (
    <nav aria-label="Menu cepat" className="glass rounded-3xl py-2">
      <div className="flex gap-1 overflow-x-auto px-2.5 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((m) => (
          <button
            key={m.key}
            onClick={() => router.push(m.href)}
            className="glass-pressable snap-start shrink-0 w-[62px] flex flex-col items-center gap-1.5 py-2 rounded-2xl"
          >
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-[color:var(--teal-primary)]" style={{ background: 'rgba(2, 132, 199, 0.14)', boxShadow: 'inset 0 0 0 1px rgba(2, 132, 199, 0.30)' }}>
              <m.Icon className="w-[18px] h-[18px]" />
            </span>
            <span className="text-[10.5px] font-bold leading-tight text-center line-clamp-2" style={{ color: 'var(--text-main)' }}>{m.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

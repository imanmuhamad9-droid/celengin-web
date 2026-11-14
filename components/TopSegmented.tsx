'use client';
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Segmented control kaca melayang di bawah Top Bar. 6 menu utama, tersambung ke route yang sudah ada.
// Item aktif: latar teal transparan + teks teal. Di layar sempit bisa digeser ke samping.
export const MAIN_MENUS = [
  { key: 'home', label: 'Home', href: '/dashboard' },
  { key: 'target', label: 'Tantangan', href: '/spending-challenge' },
  { key: 'impian', label: 'Impian', href: '/dream-planner' },
  { key: 'bareng', label: 'Kolektif', href: '/couple' },
  { key: 'splitbill', label: 'Split Bill', href: '/splitbill', also: ['/gantian'] },
  { key: 'laporan', label: 'Laporan', href: '/reports', also: ['/transactions', '/bills'] },
] as const;

type Menu = (typeof MAIN_MENUS)[number];
const isOn = (pathname: string, m: Menu) =>
  [m.href, ...(('also' in m ? m.also : []) as readonly string[])].some((p) => pathname === p || pathname.startsWith(p + '/'));

export default function TopSegmented() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Pastikan item aktif terlihat saat daftar bisa digeser
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [pathname]);

  return (
    <nav aria-label="Menu halaman" className="glass rounded-full p-1">
      <div className="flex gap-0.5 overflow-x-auto hide-scrollbar" role="tablist">
        {MAIN_MENUS.map((m) => {
          const on = isOn(pathname, m);
          return (
            <button
              key={m.key}
              ref={on ? activeRef : undefined}
              role="tab"
              aria-selected={on}
              onClick={() => { if (!on) router.push(m.href); }}
              className={`glass-pressable flex-1 shrink-0 whitespace-nowrap px-2 py-2 rounded-full text-[11px] font-bold ${on ? 'text-[color:var(--teal-primary)]' : 'text-[color:var(--text-muted)]'}`}
              style={on ? { background: 'rgba(44, 143, 126, 0.14)' } : undefined}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

'use client';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type SubTabItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  /** Awalan alamat lain yang juga dianggap tab ini */
  also?: string[];
};

const isOn = (pathname: string, it: SubTabItem) =>
  [it.href, ...(it.also || [])].some((p) => pathname === p || pathname.startsWith(p + '/'));

// Tab di bawah header untuk satu menu utama yang punya beberapa isi. Sengaja besar dan berwarna supaya jelas
// bahwa di dalam menu ini ada beberapa pilihan: tab aktif berwarna teal tebal, yang lain putih bergaris.
export default function SubTabs({ items }: { items: SubTabItem[] }) {
  const router = useRouter();
  const pathname = usePathname() || '';

  return (
    <div role="tablist" className="rounded-3xl p-1.5 bg-teal-500/10 dark:bg-teal-400/10 border border-teal-500/20 dark:border-teal-400/20">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const on = isOn(pathname, it);
          return (
            <button
              key={it.href}
              role="tab"
              aria-selected={on}
              onClick={() => { if (!on) router.replace(it.href); }}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl text-[11px] font-extrabold transition-all active:scale-95 ${on
                ? 'bg-teal-600 text-white shadow-md shadow-teal-900/20'
                : 'bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 border border-gray-200/80 dark:border-gray-700'}`}
            >
              {it.icon}
              <span className="truncate max-w-full px-1">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ic = 'w-8 h-8 object-contain';
const img = (src: string) => <img src={src} alt="" className={ic} />;

// Menu Laporan: Tagihan, Riwayat, Laporan
export const LAPORAN_TABS: SubTabItem[] = [
  { label: 'Tagihan', href: '/bills', icon: img('/menu-icons/tagihan.png') },
  { label: 'Riwayat', href: '/transactions', icon: img('/menu-icons/riwayat.png') },
  { label: 'Laporan', href: '/reports', icon: img('/menu-icons/laporan.png') },
];
export const RIWAYAT_TABS = LAPORAN_TABS;

// Menu Kolektif: Nabung Bareng, Patungan, Bayarin
export const BARENG_TABS: SubTabItem[] = [
  { label: 'Nabung Bareng', href: '/couple', icon: img('/nav-icons/kolektif.png') },
  { label: 'Patungan', href: '/splitbill', icon: img('/menu-icons/split.png') },
  { label: 'Bayarin', href: '/gantian', icon: img('/menu-icons/gantian.png') },
];

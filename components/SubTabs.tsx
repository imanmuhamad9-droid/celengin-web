'use client';
import { useRouter, usePathname } from 'next/navigation';

export type SubTabItem = {
  label: string;
  href: string;
  /** Awalan alamat lain yang juga dianggap tab ini (mis. /gantian untuk tab Patungan & Bayarin) */
  also?: string[];
};

const isOn = (pathname: string, it: SubTabItem) =>
  [it.href, ...(it.also || [])].some((p) => pathname === p || pathname.startsWith(p + '/'));

// Baris tab di bawah header untuk menggabungkan beberapa halaman dalam satu menu.
// size="sub" = pil kecil untuk pilihan di dalam sebuah tab.
export default function SubTabs({ items, size = 'main' }: { items: SubTabItem[]; size?: 'main' | 'sub' }) {
  const router = useRouter();
  const pathname = usePathname() || '';

  if (size === 'sub') {
    return (
      <div className="flex gap-2">
        {items.map((it) => {
          const on = isOn(pathname, it);
          return (
            <button
              key={it.href}
              onClick={() => { if (!on) router.replace(it.href); }}
              aria-current={on ? 'page' : undefined}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${on ? 'bg-teal-600 border-teal-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex p-1 rounded-2xl bg-white/70 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700 shadow-sm">
      {items.map((it) => {
        const on = isOn(pathname, it);
        return (
          <button
            key={it.href}
            onClick={() => { if (!on) router.replace(it.href); }}
            aria-current={on ? 'page' : undefined}
            className={`flex-1 min-w-0 py-2 rounded-xl text-xs font-bold truncate px-2 transition-all active:scale-95 ${on ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export const RIWAYAT_TABS: SubTabItem[] = [
  { label: 'Riwayat', href: '/transactions' },
  { label: 'Laporan', href: '/reports' },
  { label: 'Tagihan', href: '/bills' },
];

export const BARENG_TABS: SubTabItem[] = [
  { label: 'Nabung Bareng', href: '/couple' },
  { label: 'Patungan & Bayarin', href: '/splitbill', also: ['/gantian'] },
];

export const PATUNGAN_TABS: SubTabItem[] = [
  { label: 'Patungan', href: '/splitbill' },
  { label: 'Bayarin', href: '/gantian' },
];

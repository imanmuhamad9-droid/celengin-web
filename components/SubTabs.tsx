'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CalendarClock, History, BarChart3, Receipt, Wallet } from 'lucide-react';

export type SubTabItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  /** Awalan alamat lain yang juga dianggap tab ini */
  also?: string[];
};

const isOn = (pathname: string, it: SubTabItem) =>
  [it.href, ...(it.also || [])].some((p) => pathname === p || pathname.startsWith(p + '/'));

// Posisi sorotan terakhir per kelompok tab. Pindah tab = pindah halaman (komponen dipasang ulang),
// jadi posisi disimpan di level modul supaya sorotan terlihat meluncur dari tab lama ke tab baru.
const lastPos: Record<string, number> = {};

// Tab di bawah header, bergaya seperti bottom navbar: tab aktif disorot pil warna aksen,
// tab lain transparan, dan sorotan meluncur mulus saat berpindah.
export default function SubTabs({ items }: { items: SubTabItem[] }) {
  const router = useRouter();
  const pathname = usePathname() || '';

  const key = items.map((i) => i.href).join('|');
  const cur = items.findIndex((it) => isOn(pathname, it));
  const [pos, setPos] = useState<number>(lastPos[key] ?? Math.max(cur, 0));
  useEffect(() => {
    if (cur < 0) return;
    const t = setTimeout(() => { setPos(cur); lastPos[key] = cur; }, 30);
    return () => clearTimeout(t);
  }, [cur, key]);

  return (
    <div role="tablist" className="relative rounded-full px-2 py-1.5 seg-glass">
      {cur >= 0 && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-2 transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
          style={{ width: `calc((100% - 1rem) / ${items.length})`, transform: `translateX(${pos * 100}%)` }}
        >
          <span className="block h-full mx-0.5 rounded-full seg-pill" />
        </span>
      )}
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const on = isOn(pathname, it);
          return (
            <button
              key={it.href}
              role="tab"
              aria-selected={on}
              onClick={() => {
                if (on) return;
                // Sorotan langsung meluncur ke tab tujuan selagi halaman dimuat
                const i = items.indexOf(it);
                if (i >= 0 && cur >= 0) { setPos(i); lastPos[key] = i; }
                router.replace(it.href);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full text-[10px] font-bold transition-colors duration-300 active:scale-95 ${on ? 'seg-active' : 'text-gray-500 dark:text-gray-400'}`}
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

// Ikon general (lucide), seragam dengan ikon di bottom nav; warnanya mengikuti teks tab
const ic = 'w-5 h-5';

// Menu Laporan: Tagihan, Riwayat, Laporan
export const LAPORAN_TABS: SubTabItem[] = [
  { label: 'Tagihan', href: '/bills', icon: <CalendarClock className={ic} /> },
  { label: 'Riwayat', href: '/transactions', icon: <History className={ic} /> },
  { label: 'Laporan', href: '/reports', icon: <BarChart3 className={ic} /> },
];
export const RIWAYAT_TABS = LAPORAN_TABS;

// Menu Split Bill: Patungan, Bayarin (Nabung Bareng pindah ke menu Kolektif tersendiri tanpa tab)
export const SPLIT_TABS: SubTabItem[] = [
  { label: 'Patungan', href: '/splitbill', icon: <Receipt className={ic} /> },
  { label: 'Bayarin', href: '/gantian', icon: <Wallet className={ic} /> },
];

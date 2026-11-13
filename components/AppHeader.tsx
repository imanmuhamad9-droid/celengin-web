'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Info, X } from 'lucide-react';
import { MENU_INFO } from '@/lib/menuInfo';

type Props = {
  /** Nama menu yang sedang dibuka. Kosong = Home (menampilkan "Celengin."). */
  title?: string;
  /** Hanya untuk kasus khusus (mis. dari dalam sebuah buku Split Bill kembali ke daftar). Kembali ke Home cukup dengan menekan logo. */
  onBack?: () => void;
  /** Elemen di pojok kanan, mis. lonceng notifikasi */
  topRight?: React.ReactNode;
  /** Tombol aksi di pojok kanan, mis. "+ Tambah" */
  action?: React.ReactNode;
  z?: 'z-40' | 'z-50';
  /** Kunci penjelasan ⓘ bila berbeda dari judul (mis. judul 'Kolektif' tapi penjelasannya milik tab Patungan) */
  infoKey?: string;
};

const SEEN_PREFIX = 'celengin:menu-info-seen:';

// Header seragam satu baris: logo + nama menu (Home = "Celengin."). Menekan logo selalu kembali ke Home.
// Menu yang punya penjelasan (lib/menuInfo.ts) otomatis mendapat tombol ⓘ di pojok kanan. Penjelasannya terbuka
// saat menu pertama kali dibuka, lalu tersembunyi setelah ditutup dan bisa dibuka lagi lewat ⓘ.
export default function AppHeader({ title, onBack, topRight, action, z = 'z-50', infoKey }: Props) {
  const router = useRouter();
  const key = infoKey || title;
  const info = key ? MENU_INFO[key] : undefined;
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    if (!key || !MENU_INFO[key]) { setInfoOpen(false); return; }
    try { setInfoOpen(localStorage.getItem(SEEN_PREFIX + key) !== '1'); } catch (_) { setInfoOpen(true); }
  }, [key]);

  const closeInfo = () => {
    setInfoOpen(false);
    if (!key) return;
    try { localStorage.setItem(SEEN_PREFIX + key, '1'); } catch (_) { /* abaikan */ }
  };

  return (
    <>
      <header className={`sticky top-0 ${z} bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors`}>
        <div className="px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button onClick={onBack} aria-label="Kembali" className="shrink-0 -ml-2 p-1.5 text-gray-500 dark:text-gray-400 hover:text-teal-600 active:scale-95 transition-transform">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => router.push('/dashboard')} aria-label="Ke Home" className="shrink-0 active:scale-90 transition-transform">
              <img src="/icon.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
            </button>
            <h1 className="font-bold text-xl text-teal-800 dark:text-teal-400 truncate">{title || 'Celengin.'}</h1>
          </div>
          {(action || topRight || info) && (
            <div className="shrink-0 flex items-center gap-2">
              {action}
              {topRight}
              {info && (
                <button
                  onClick={() => (infoOpen ? closeInfo() : setInfoOpen(true))}
                  aria-label="Menu ini untuk apa?"
                  aria-expanded={infoOpen}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors active:scale-95 ${infoOpen ? 'bg-teal-600 border-teal-600 text-white' : 'bg-teal-50 dark:bg-teal-900/30 border-teal-100 dark:border-teal-800 text-teal-600 dark:text-teal-300'}`}
                >
                  <Info className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {info && infoOpen && (
        <div className="max-w-md mx-auto px-5 pt-3">
          <div className="relative bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-2xl p-4">
            <button onClick={closeInfo} aria-label="Sembunyikan penjelasan" className="absolute top-3 right-3 text-teal-600/60 hover:text-teal-700 dark:text-teal-300/60"><X className="w-4 h-4" /></button>
            <p className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-1 pr-6">{info.heading}</p>
            <p className="text-[11px] text-teal-700/80 dark:text-teal-400/80 leading-relaxed">{info.body}</p>
            {info.points && (
              <ul className="mt-2 text-[11px] text-teal-700/80 dark:text-teal-400/80 leading-relaxed space-y-1 list-disc pl-4">
                {info.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
            <button onClick={closeInfo} className="mt-3 text-[11px] font-bold text-teal-700 dark:text-teal-300 underline underline-offset-2">Mengerti, sembunyikan</button>
            <p className="text-[10px] text-teal-700/60 dark:text-teal-400/60 mt-1">Bisa dibuka lagi lewat tombol ⓘ di pojok kanan atas.</p>
          </div>
        </div>
      )}
    </>
  );
}

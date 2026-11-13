'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, X, Star, ChevronUp, ChevronDown, Check, Pencil } from 'lucide-react';
import {
  SHORTCUTS, DEFAULT_SHORTCUTS, MAX_FAVS, ShortcutKey,
  parseShortcuts, readLocalShortcuts, saveShortcuts, shortcutByKey,
} from '@/lib/shortcuts';

type Props = {
  userId: string | null;
  /** Nilai profiles.shortcuts (null = belum pernah diatur) */
  initial: unknown;
  /** Angka merah kecil di ikon, mis. { tagihan: 2 } */
  counts?: Partial<Record<ShortcutKey, number>>;
  /** Tampilan chip ramping satu baris (untuk Home) */
  compact?: boolean;
};

// Semua ikon memakai satu warna yang sama
const TILE = 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400';

export default function FeatureShortcuts({ userId, initial, counts = {}, compact = false }: Props) {
  const router = useRouter();
  const [favs, setFavs] = useState<ShortcutKey[]>(DEFAULT_SHORTCUTS);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hint, setHint] = useState('');
  const touched = useRef(false); // sudah diubah di perangkat ini -> jangan ditimpa data profil yang lama

  // Urutan prioritas: profil (akun) -> perangkat ini -> bawaan
  useEffect(() => {
    if (touched.current) return;
    const fromProfile = parseShortcuts(initial);
    setFavs(fromProfile ?? readLocalShortcuts() ?? DEFAULT_SHORTCUTS);
  }, [initial]);

  // Tutup dengan tombol Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSheet(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (next: ShortcutKey[]) => {
    touched.current = true;
    setFavs(next);
    saveShortcuts(userId, next);
  };

  const closeSheet = () => { setOpen(false); setEditing(false); setHint(''); };

  const go = (href: string) => { closeSheet(); router.push(href); };

  const toggleFav = (key: ShortcutKey) => {
    if (favs.includes(key)) { setHint(''); commit(favs.filter((k) => k !== key)); return; }
    if (favs.length >= MAX_FAVS) { setHint(`Maksimal ${MAX_FAVS} pintasan. Lepas salah satu dulu.`); return; }
    setHint('');
    commit([...favs, key]);
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= favs.length) return;
    const next = [...favs];
    [next[index], next[j]] = [next[j], next[index]];
    commit(next);
  };

  const renderTile = (k: ShortcutKey, onClick: () => void) => {
    const s = shortcutByKey(k);
    const count = counts[k] || 0;
    return (
      <button key={k} onClick={onClick} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform min-w-0">
        <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center ${TILE}`}>
          <s.Icon className="w-5 h-5" />
          {count > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{count}</span>}
        </div>
        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 truncate max-w-full">{s.label}</span>
      </button>
    );
  };

  return (
    <>
      {/* DI HOME: favorit + Semua */}
      {compact ? (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
          {favs.map((k) => {
            const s = shortcutByKey(k);
            const count = counts[k] || 0;
            return (
              <button key={k} onClick={() => go(s.href)} className="relative shrink-0 flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-full pl-3 pr-3.5 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 active:scale-95 transition-transform">
                <s.Icon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                {s.label}
                {count > 0 && <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{count}</span>}
              </button>
            );
          })}
          <button onClick={() => setOpen(true)} className="shrink-0 flex items-center gap-1.5 bg-teal-50 dark:bg-teal-900/30 rounded-full pl-3 pr-3.5 py-2 text-xs font-bold text-teal-700 dark:text-teal-300 active:scale-95 transition-transform">
            <LayoutGrid className="w-4 h-4" /> Semua
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
          <div className="grid grid-cols-5 gap-2">
            {favs.map((k) => renderTile(k, () => go(shortcutByKey(k).href)))}
            {/* Sel kosong menjaga tombol "Semua" tetap di kolom paling kanan */}
            {Array.from({ length: MAX_FAVS - favs.length }).map((_, i) => <div key={`gap-${i}`} />)}
            <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${TILE}`}>
                <LayoutGrid className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Semua</span>
            </button>
          </div>
        </div>
      )}

      {/* DAFTAR SEMUA MENU */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div onClick={closeSheet} className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200" />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300">
            <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto mb-4" />

            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{editing ? 'Atur Pintasan' : 'Semua Menu'}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditing((v) => !v); setHint(''); }}
                  className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${editing ? 'bg-teal-600 text-white' : 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'}`}
                >
                  {editing ? <><Check className="w-3.5 h-3.5" /> Selesai</> : <><Pencil className="w-3.5 h-3.5" /> Atur</>}
                </button>
                <button onClick={closeSheet} aria-label="Tutup" className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {editing ? `Ketuk ikon untuk memilih sampai ${MAX_FAVS} pintasan yang tampil di Home.` : 'Menu utama (Home, Target, Catat, Impian, Bareng) ada di tombol burger.'}
            </p>

            <div className="grid grid-cols-4 gap-x-2 gap-y-4">
              {SHORTCUTS.map((s) => {
                const isFav = favs.includes(s.key);
                const count = counts[s.key] || 0;
                return (
                  <button
                    key={s.key}
                    onClick={() => (editing ? toggleFav(s.key) : go(s.href))}
                    className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform min-w-0"
                  >
                    <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center ${TILE} ${editing && isFav ? 'ring-2 ring-teal-500' : ''}`}>
                      <s.Icon className="w-6 h-6" />
                      {!editing && count > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{count}</span>}
                      {editing && (
                        <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 ${isFav ? 'bg-teal-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                          <Star className={`w-3 h-3 ${isFav ? 'fill-white' : ''}`} />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate max-w-full">{s.label}</span>
                  </button>
                );
              })}
            </div>

            {editing && (
              <div className="mt-5">
                {hint && <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-3">{hint}</p>}
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Urutan di Home ({favs.length}/{MAX_FAVS})</p>
                {favs.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-3">Belum ada pintasan. Ketuk ikon di atas untuk menambah.</p>
                ) : (
                  <div className="space-y-2">
                    {favs.map((k, i) => {
                      const s = shortcutByKey(k);
                      return (
                        <div key={k} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl px-3 py-2">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${TILE}`}><s.Icon className="w-4 h-4" /></div>
                          <span className="flex-1 text-sm font-bold text-gray-700 dark:text-gray-200">{s.label}</span>
                          <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naikkan" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 disabled:opacity-30 active:bg-gray-200 dark:active:bg-gray-700"><ChevronUp className="w-4 h-4" /></button>
                          <button onClick={() => move(i, 1)} disabled={i === favs.length - 1} aria-label="Turunkan" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 disabled:opacity-30 active:bg-gray-200 dark:active:bg-gray-700"><ChevronDown className="w-4 h-4" /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

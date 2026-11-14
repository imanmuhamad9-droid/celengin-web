'use client';
import { useRouter } from 'next/navigation';
import { SHORTCUTS, ShortcutKey } from '@/lib/shortcuts';

type Props = {
  /** Tidak lagi dipakai (pintasan tidak perlu diatur), dibiarkan supaya pemanggil lama tetap valid */
  userId?: string | null;
  initial?: unknown;
  /** Angka merah kecil di ikon, mis. { tagihan: 2 } */
  counts?: Partial<Record<ShortcutKey, number>>;
  /** Tampilan kaca untuk Home */
  compact?: boolean;
};

// Pintasan Home: 4 fitur tetap, tanpa pengaturan. Mau lebih banyak? Menu utama ada di bar bawah.
export default function FeatureShortcuts({ counts = {}, compact = false }: Props) {
  const router = useRouter();

  const wrap = compact
    ? 'bg-white/60 dark:bg-gray-800/50 backdrop-blur-md border border-white/70 dark:border-gray-700/60 shadow-sm rounded-3xl px-3 py-4'
    : 'glass p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors';

  return (
    <div className={wrap}>
      <div className="grid grid-cols-4 gap-1">
        {SHORTCUTS.map((s) => {
          const count = counts[s.key] || 0;
          return (
            <button key={s.key} onClick={() => router.push(s.href)} className="flex flex-col items-center gap-2 active:scale-95 transition-transform min-w-0">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <img src={s.img} alt="" draggable={false} className="w-14 h-14 object-contain" />
                {count > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full glass glass-danger text-[10px] font-bold flex items-center justify-center">{count}</span>}
              </div>
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate max-w-full">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

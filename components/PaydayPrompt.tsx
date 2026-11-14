'use client';
import { useState } from 'react';
import { CalendarClock, X } from 'lucide-react';

// Kartu pertanyaan sekali saja: "Biasanya gajian tanggal berapa?"
export default function PaydayPrompt({ onPick, onLater }: { onPick: (day: number) => void | Promise<void>; onLater: () => void }) {
  const [other, setOther] = useState(false);
  const [day, setDay] = useState(10);
  const [busy, setBusy] = useState(false);

  const pick = async (d: number) => {
    if (busy) return;
    setBusy(true);
    try { await onPick(d); } finally { setBusy(false); }
  };

  const chip = 'px-4 py-2 rounded-full text-xs font-bold border transition-all active:scale-95 disabled:opacity-50';
  const chipCls = `${chip} glass border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300`;

  return (
    <div className="relative bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-3xl p-4">
      <button onClick={onLater} aria-label="Nanti saja" className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-4 h-4" /></button>
      <div className="flex items-start gap-3 pr-5">
        <div className="w-9 h-9 shrink-0 rounded-xl glass flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm"><CalendarClock className="w-5 h-5" /></div>
        <div>
          <p className="font-bold text-sm text-teal-900 dark:text-teal-200">Biasanya gajian tanggal berapa?</p>
          <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80 mt-0.5 leading-relaxed">Statistik dan laporan akan dihitung dari tanggal itu, jadi tidak terlihat minus sebelum gajian masuk. Bisa diubah kapan saja di Pengaturan.</p>
        </div>
      </div>

      {!other ? (
        <div className="flex flex-wrap gap-2 mt-3">
          <button disabled={busy} onClick={() => pick(1)} className={chipCls}>Tanggal 1</button>
          <button disabled={busy} onClick={() => pick(25)} className={chipCls}>Tanggal 25</button>
          <button disabled={busy} onClick={() => setOther(true)} className={chipCls}>Lainnya</button>
          <button disabled={busy} onClick={() => pick(1)} className={`${chip}bg-transparent border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400`}>Tidak tentu</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs font-bold text-teal-900 dark:text-teal-200">Tanggal</span>
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} className="px-3 py-2 rounded-xl border border-teal-200 dark:border-teal-800 glass text-gray-900 dark:text-white text-base font-bold">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button disabled={busy} onClick={() => pick(day)} className="glass glass-teal px-4 py-2 rounded-xl text-xs font-bold active:scale-95 disabled:opacity-50">Simpan</button>
          <button onClick={() => setOther(false)} className="text-xs text-gray-500 dark:text-gray-400 px-2">Batal</button>
        </div>
      )}
    </div>
  );
}

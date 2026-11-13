'use client';
import { ChevronDown } from 'lucide-react';

// Kepala bagian yang bisa dilipat: judul polos + tombol pil seragam (Sembunyikan / Tampilkan).
export default function SectionToggle({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 min-w-0">{title}</h3>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 text-[11px] font-bold text-teal-700 dark:text-teal-300 active:scale-95 transition-all"
      >
        {open ? 'Sembunyikan' : 'Tampilkan'}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}

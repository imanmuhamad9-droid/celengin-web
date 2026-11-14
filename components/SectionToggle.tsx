'use client';
import { ChevronDown } from 'lucide-react';

// Kepala bagian yang bisa dilipat: judul + tombol pil mencolok. Tertutup = tombol penuh (ajakan membuka), terbuka = tombol lembut.
export default function SectionToggle({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-extrabold text-base text-gray-800 dark:text-gray-100 min-w-0">{title}</h3>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`shrink-0 inline-flex items-center gap-1.5 px-4 min-h-[38px] rounded-full text-xs font-extrabold border active:scale-95 transition-all ${open
          ? 'glass glass-teal'
          : 'glass glass-teal'}`}
      >
        {open ? 'Sembunyikan' : 'Tampilkan'}
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}

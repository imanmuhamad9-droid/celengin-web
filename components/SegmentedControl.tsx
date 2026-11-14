'use client';
import type { ReactNode } from 'react';

// Pilihan bergaya bottom navbar untuk state di dalam satu halaman (bukan pindah halaman):
// pilihan aktif disorot pil warna aksen, yang lain transparan, sorotan meluncur mulus.
// Warna pil mengikuti aksen + gaya tombol dari Pengaturan (kelas seg-pill / seg-active di globals.css).
export default function SegmentedControl<T extends string>({ options, value, onChange, className = '' }: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`relative rounded-full px-1.5 py-1 seg-glass ${className}`}>
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1.5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
        style={{ width: `calc((100% - 0.75rem) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      >
        <span className="block h-full mx-0.5 rounded-full seg-pill" />
      </span>
      <div className="relative flex">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => { if (!on) onChange(o.value); }}
              className={`flex-1 min-w-0 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-300 active:scale-95 ${on ? 'seg-active' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

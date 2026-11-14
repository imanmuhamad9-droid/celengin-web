'use client';

const DEFAULT_OPTIONS = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
];

// Pilihan frekuensi berulang (chip kecil). Gaya sama dengan tombol tipe Masuk/Keluar.
export default function FrequencyPicker({ value, onChange, options = DEFAULT_OPTIONS }: {
  value: string;
  onChange: (v: any) => void;
  options?: { value: string; label: string }[];
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border-2 transition-all ${value === o.value ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

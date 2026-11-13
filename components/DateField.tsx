'use client';
import { CalendarDays } from 'lucide-react';
import { formatDateID } from '@/lib/utils';

interface Props {
  value: string;                       // YYYY-MM-DD
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  required?: boolean;
  compact?: boolean;                   // tinggi lebih kecil untuk baris padat
  className?: string;                  // untuk pembungkus (lebar, margin)
}

/**
 * Kolom tanggal yang konsisten di semua HP.
 * Tampilannya kotak biasa yang menulis tanggal (mis. "13 Nov 2026"), sedangkan input date
 * bawaan browser ditaruh transparan di atasnya, jadi tetap membuka kalender native.
 * Ini menghindari kotak tanggal yang tinggi/menimpa kolom lain di iOS dan Android.
 */
export default function DateField({ value, onChange, label, placeholder = 'Pilih tanggal', min, max, required, compact, className = '' }: Props) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
      <div className={`relative w-full ${compact ? 'h-10' : 'h-11'}`}>
        <div className="absolute inset-0 flex items-center gap-2 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 transition-colors">
          <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
          <span className={`truncate ${compact ? 'text-xs' : 'text-sm'} ${value ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-400'}`}>
            {value ? formatDateID(value) : placeholder}
          </span>
        </div>
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* abaikan */ } }}
          aria-label={label || placeholder}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

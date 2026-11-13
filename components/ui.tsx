'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Plus } from 'lucide-react';

// Komponen UI bersama supaya semua tombol di Celengin seragam: tebal, bertuliskan jelas, area ketuk >= 36px,
// dan memakai latar tembus pandang (tint) kecuali tombol utama.
export type BtnVariant = 'primary' | 'success' | 'red' | 'soft' | 'danger' | 'neutral' | 'pink' | 'blue';
export type BtnSize = 'sm' | 'md';

const BASE = 'inline-flex items-center justify-center gap-1.5 font-bold rounded-xl border transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none';
const SIZE: Record<BtnSize, string> = {
  sm: 'px-3.5 min-h-[36px] text-xs',
  md: 'px-5 min-h-[46px] text-sm',
};
const VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-teal-600 border-teal-600 text-white hover:bg-teal-700 shadow-sm',
  success: 'bg-green-600 border-green-600 text-white hover:bg-green-700 shadow-sm',
  red: 'bg-red-500 border-red-500 text-white hover:bg-red-600 shadow-sm',
  soft: 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20',
  danger: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20',
  neutral: 'bg-gray-500/10 border-gray-400/30 text-gray-700 dark:text-gray-200 hover:bg-gray-500/20',
  pink: 'bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-300 hover:bg-pink-500/20',
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20',
};

export const btnClass = (variant: BtnVariant = 'soft', size: BtnSize = 'sm', full = false) =>
  `${BASE} ${SIZE[size]} ${VARIANT[variant]} ${full ? 'w-full' : ''}`;

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; full?: boolean; children: ReactNode };

export function Btn({ variant = 'soft', size = 'sm', full = false, className = '', type = 'button', children, ...rest }: BtnProps) {
  return <button type={type} className={`${btnClass(variant, size, full)} ${className}`} {...rest}>{children}</button>;
}

// Tombol "+ Buat" di pojok kanan atas header, sama di semua menu
export function HeaderBtn({ onClick, label = 'Buat' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className={`${BASE} ${SIZE.sm} ${VARIANT.soft} h-8 min-h-0 px-3`}>
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}

// Pasangan tombol Ubah + Hapus berbentuk tulisan, bukan ikon kecil
export function RowActions({ onEdit, onDelete, editLabel = 'Ubah', deleteLabel = 'Hapus', vertical = false }: { onEdit?: () => void; onDelete?: () => void; editLabel?: string; deleteLabel?: string; vertical?: boolean }) {
  return (
    <div className={vertical ? 'flex flex-col items-stretch gap-1.5 w-[72px] shrink-0' : 'flex items-center gap-2'}>
      {onEdit && <Btn variant="soft" size="sm" onClick={onEdit}>{editLabel}</Btn>}
      {onDelete && <Btn variant="danger" size="sm" onClick={onDelete}>{deleteLabel}</Btn>}
    </div>
  );
}

// Saklar standar: ada tulisan statusnya supaya jelas, area ketuk besar
export function Toggle({ checked, onChange, label, onText = 'Aktif', offText = 'Mati', disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; onText?: string; offText?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || (checked ? onText : offText)}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`shrink-0 inline-flex items-center gap-2 pl-1 pr-3 h-9 rounded-full border transition-colors active:scale-95 disabled:opacity-40 ${checked ? 'bg-teal-500/15 border-teal-500/40' : 'bg-gray-500/10 border-gray-400/30'}`}
    >
      <span className={`relative w-9 h-6 rounded-full transition-colors ${checked ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[16px]' : 'left-0.5'}`} />
      </span>
      <span className={`text-[11px] font-bold ${checked ? 'text-teal-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400'}`}>{checked ? onText : offText}</span>
    </button>
  );
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Tanggal tegak: hari besar, bulan, lalu tahun (dd / mmm / yyyy). Masukan: 'YYYY-MM-DD'
export function DateStack({ ymd }: { ymd: string }) {
  const [y = '', m = '1', d = ''] = (ymd || '').slice(0, 10).split('-');
  return (
    <div className="w-12 shrink-0 text-center rounded-xl bg-gray-50 dark:bg-gray-700/60 border border-gray-100 dark:border-gray-600 py-1.5 leading-none">
      <p className="text-lg font-extrabold text-gray-800 dark:text-gray-100">{d}</p>
      <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 mt-1 uppercase">{BULAN[Math.max(0, Number(m) - 1)] || ''}</p>
      <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 mt-0.5">{y}</p>
    </div>
  );
}

'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';

// Komponen UI bersama supaya semua tombol di Celengin seragam: tebal, bertuliskan jelas, area ketuk >= 36px,
// dan memakai latar tembus pandang (tint) kecuali tombol utama.
export type BtnVariant = 'primary' | 'success' | 'red' | 'soft' | 'danger' | 'neutral';
export type BtnSize = 'sm' | 'md' | 'lg';

// Liquid Glass: semua tombol berbentuk pil kaca. Hanya "primary" yang pekat teal (submit utama);
// "teal"/"soft"/"success" = kaca teal; "danger"/"red" = kaca merah transparan (bukan solid); "neutral" = kaca polos.
const BASE = 'glass glass-pressable inline-flex items-center justify-center gap-1.5 font-bold rounded-full whitespace-nowrap select-none';
const SIZE: Record<BtnSize, string> = {
  sm: 'px-3 min-h-[32px] text-xs',
  md: 'px-4 min-h-[40px] text-[13px]',
  lg: 'px-5 min-h-[48px] text-[15px]',
};
const VARIANT: Record<BtnVariant, string> = {
  primary: 'glass-solid-teal',                    // aksi utama: Simpan, submit
  success: 'glass-teal',
  red: 'glass-danger',
  soft: 'glass-teal',                             // aksi pendukung: Batal, Ubah
  danger: 'glass-danger',                         // Hapus, Tolak
  neutral: 'text-[color:var(--text-main)]',
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
    <button type="button" onClick={onClick} className={`${BASE} ${SIZE.sm}glass-teal h-8 min-h-0 px-3`}>
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}

// Pasangan tombol Ubah + Hapus berbentuk tulisan, bukan ikon kecil
export function RowActions({ onEdit, onDelete, editLabel = 'Ubah', deleteLabel = 'Hapus', vertical = false }: { onEdit?: () => void; onDelete?: () => void; editLabel?: string; deleteLabel?: string; vertical?: boolean }) {
  return (
    <div className={vertical ? 'flex flex-col items-stretch gap-1.5 w-[72px] shrink-0' : 'flex items-center gap-2'}>
      {onEdit && <Btn variant="soft" size="sm" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /> {editLabel}</Btn>}
      {onDelete && <Btn variant="danger" size="sm" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /> {deleteLabel}</Btn>}
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
      className={`shrink-0 inline-flex items-center gap-2 pl-1 pr-3 h-9 rounded-full border border-transparent transition-colors active:scale-95 disabled:opacity-40 ${checked ? 'bg-[var(--teal-tint)]' : 'glass'}`}
    >
      <span className={`relative w-9 h-6 rounded-full transition-colors ${checked ? 'bg-[var(--teal-primary)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[16px]' : 'left-0.5'}`} />
      </span>
      <span className={`text-[11px] font-bold ${checked ? 'text-[var(--teal-primary)]' : 'text-gray-500 dark:text-gray-400'}`}>{checked ? onText : offText}</span>
    </button>
  );
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Tanggal tegak: hari besar, bulan, lalu tahun (dd / mmm / yyyy). Masukan: 'YYYY-MM-DD'
export function DateStack({ ymd }: { ymd: string }) {
  const [y = '', m = '1', d = ''] = (ymd || '').slice(0, 10).split('-');
  return (
    <div className="glass w-12 shrink-0 text-center rounded-2xl py-1.5 leading-none">
      <p className="text-lg font-extrabold" style={{ color: 'var(--text-main)' }}>{d}</p>
      <p className="text-[10px] font-bold text-[color:var(--teal-primary)] mt-1 uppercase">{BULAN[Math.max(0, Number(m) - 1)] || ''}</p>
      <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 mt-0.5">{y}</p>
    </div>
  );
}

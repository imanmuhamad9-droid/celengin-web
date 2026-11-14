'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Varian: primary = teal pekat (HANYA Catat & submit utama), teal = kaca teal (Ubah, aksi pendukung),
// danger = kaca merah transparan (Hapus), neutral = kaca polos (Batal, Settings, dst.)
export type GlassVariant = 'primary' | 'teal' | 'danger' | 'neutral';
export type GlassSize = 'sm' | 'md' | 'lg' | 'icon';

const SIZE: Record<GlassSize, string> = {
  sm: 'px-3 min-h-[32px] text-xs rounded-full',
  md: 'px-4 min-h-[40px] text-[13px] rounded-full',
  lg: 'px-5 min-h-[48px] text-[15px] rounded-full',
  icon: 'w-10 h-10 rounded-full',
};
const VARIANT: Record<GlassVariant, string> = {
  primary: 'glass glass-solid-teal',
  teal: 'glass glass-teal',
  danger: 'glass glass-danger',
  neutral: 'glass',
};

export const glassBtnClass = (variant: GlassVariant = 'neutral', size: GlassSize = 'md', full = false) =>
  `inline-flex items-center justify-center gap-1.5 font-bold whitespace-nowrap select-none glass-pressable ${SIZE[size]} ${VARIANT[variant]} ${variant === 'neutral' ? 'text-[color:var(--text-main)]' : ''} ${full ? 'w-full' : ''}`;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: GlassVariant;
  size?: GlassSize;
  full?: boolean;
  children: ReactNode;
};

export default function GlassButton({ variant = 'neutral', size = 'md', full = false, className = '', type = 'button', children, ...rest }: Props) {
  return (
    <button type={type} className={`${glassBtnClass(variant, size, full)} ${className}`} {...rest}>
      {children}
    </button>
  );
}

'use client';
// Logo Celengin: huruf "C" dengan panah naik gradasi teal-mint, tanpa bingkai.
// Murni presentasi, tanpa state/hooks.
import { useId } from 'react';

export function CelenginMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={`g${gid}`} x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2C8F7E" />
          <stop offset="1" stopColor="#7FE0C4" />
        </linearGradient>
      </defs>
      {/* huruf C */}
      <path d="M25 7.6A12.6 12.6 0 1 0 25 24.4" stroke={`url(#g${gid})`} strokeWidth="4" strokeLinecap="round" />
      {/* panah naik di dalam C */}
      <path d="M11.5 20.5 20 12m0 0h-6.2M20 12v6.2" stroke={`url(#g${gid})`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CelenginLogo({ size = 40, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <CelenginMark size={size} />
      {withText && <span className="font-bold text-xl tracking-tight" style={{ color: 'var(--text-main)' }}>Celengin</span>}
    </span>
  );
}

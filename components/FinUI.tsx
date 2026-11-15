'use client';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

// Potongan tampilan bersama untuk halaman Dompet, Dana Darurat, Anggaran, dan Kekayaan Bersih
// (semuanya memakai gaya kaca yang sama dengan menu lain).

export const inputCls = 'glass w-full min-w-0 h-11 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--teal-primary)] text-[color:var(--text-main)]';
export const labelCls = 'block text-xs font-medium mb-1 text-[color:var(--text-muted)]';
export const chipOn = 'glass glass-teal';
export const chipOff = 'glass text-[color:var(--text-muted)]';

/** Lembar formulir dari bawah (bottom sheet) bergaya kaca. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="glass glass-sheet rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[94vh] flex flex-col transition-colors">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-[color:var(--text-main)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="text-[color:var(--text-muted)]"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">{children}</div>
        {footer && <div className="shrink-0 px-5 pt-3 pb-5 border-t border-black/[0.07] dark:border-white/10">{footer}</div>}
      </div>
    </div>
  );
}

/** Batang progres. over = melewati batas (memakai warna Krisis). */
export function ProgressBar({ pct, over = false, label }: { pct: number; over?: boolean; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped)} className="h-2.5 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${clamped}%`, background: over ? 'var(--danger)' : 'var(--teal-primary)' }} />
    </div>
  );
}

/** Lencana status kaca: ok = teal, warn = netral, bad = kaca merah transparan. */
export function StatusBadge({ tone, children }: { tone: 'ok' | 'warn' | 'bad'; children: ReactNode }) {
  const cls = tone === 'ok' ? 'glass-teal' : tone === 'bad' ? 'glass-danger' : 'text-[color:var(--text-muted)]';
  return <span className={`glass ${cls} shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold`}>{children}</span>;
}

/** Penjelasan saat tabel database belum dibuat. */
export function SqlNotice({ file }: { file: string }) {
  return (
    <div className="glass glass-teal rounded-3xl p-4 text-xs leading-relaxed">
      <p className="font-bold mb-1">Database belum siap</p>
      <p>Jalankan file <strong>{file}</strong> di Supabase (SQL Editor, New query, tempel isinya, lalu Run), kemudian muat ulang halaman ini.</p>
    </div>
  );
}

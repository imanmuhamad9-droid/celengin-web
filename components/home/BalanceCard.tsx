'use client';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronRight, Eye, EyeOff } from 'lucide-react';
import type { Profile } from '@/lib/types';
import { formatRupiah } from '@/lib/utils';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';

export interface DailyAllowance {
  /** Patokan per hari dari tantangan utama */
  perDay: number;
  /** Sisa jatah hari ini */
  left: number;
  /** Pengeluaran hari ini */
  spentToday: number;
  /** Persen target tantangan utama yang sudah terpakai */
  targetUsedPct: number;
}

// Kotak ringkasan: Uang Sisa, uang masuk/keluar, dan jatah yang boleh dipakai hari ini.
// Latar kartu kustom dari profil tetap dipakai di bawah kaca.
export default function BalanceCard({ profile, balance, totalIncome, totalExpense, hidden, onToggleHidden, allowance, onInfoAllowance }: {
  profile: Profile | null;
  balance: number;
  totalIncome: number;
  totalExpense: number;
  hidden: boolean;
  onToggleHidden: () => void;
  /** null = belum ada tantangan utama */
  allowance: DailyAllowance | null;
  onInfoAllowance: () => void;
}) {
  const router = useRouter();
  const safe = Boolean(profile?.safe_limit) && balance >= (profile?.safe_limit ?? 0);
  const hasBg = Boolean(profile?.safe_limit && profile?.bg_safe_url);
  const zoom = (safe ? profile?.bg_safe_zoom : profile?.bg_low_zoom) || 1;
  const pos = (safe ? profile?.bg_safe_pos : profile?.bg_low_pos) || 'center';

  return (
    <GlassCard padded={false} className="relative overflow-hidden">
      {hasBg && (
        <>
          <div className="absolute inset-0 z-0" style={{ backgroundImage: `url(${safe ? profile?.bg_safe_url : profile?.bg_low_url})`, backgroundSize: `${zoom * 100}%`, backgroundPosition: pos, backgroundRepeat: 'no-repeat' }} />
          <div className="absolute inset-0 z-0 bg-white/60 dark:bg-black/50" />
        </>
      )}

      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-[color:var(--text-muted)]">Uang Sisa</p>
              <GlassButton size="icon" onClick={onToggleHidden} aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'} className="!w-7 !h-7 text-[color:var(--text-muted)]">
                {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </GlassButton>
            </div>
            <h3 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-main)' }}>{hidden ? 'Rp ******' : formatRupiah(balance)}</h3>
          </div>
          {profile?.safe_limit && (
            <span className={`glass shrink-0 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${safe ? 'glass-teal' : 'glass-danger'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {safe ? 'Aman' : 'Krisis'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <div className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
            <p className="text-[11px] font-semibold flex items-center gap-1 text-[color:var(--text-muted)]"><ArrowDownLeft className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> Uang Masuk</p>
            <p className="text-sm font-extrabold mt-0.5 text-green-600 dark:text-green-400">{hidden ? 'Rp ***' : formatRupiah(totalIncome)}</p>
          </div>
          <div className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
            <p className="text-[11px] font-semibold flex items-center gap-1 text-[color:var(--text-muted)]"><ArrowUpRight className="w-3.5 h-3.5 text-red-500 dark:text-red-400" /> Uang Keluar</p>
            <p className="text-sm font-extrabold mt-0.5 text-red-500 dark:text-red-400">{hidden ? 'Rp ***' : formatRupiah(totalExpense)}</p>
          </div>
        </div>

        {allowance ? (
          <button onClick={onInfoAllowance} className="glass-pressable mt-3 w-full rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-left bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[color:var(--text-muted)]">Boleh dipakai hari ini</p>
              <p className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-main)' }}>{hidden ? 'Rp ***' : formatRupiah(allowance.left)}</p>
              <p className="text-[11px] text-[color:var(--text-muted)]">
                {allowance.spentToday > allowance.perDay
                  ? `Jatah habis, lewat ${formatRupiah(allowance.spentToday - allowance.perDay)}`
                  : allowance.left < allowance.perDay * 0.25
                    ? 'Jatah tinggal sedikit'
                    : `Dari jatah ${formatRupiah(allowance.perDay)} per hari`} · target bulan ini {allowance.targetUsedPct}%
              </p>
            </div>
            {allowance.spentToday > allowance.perDay
              ? <AlertCircle className="w-6 h-6 shrink-0 text-[color:var(--text-muted)]" />
              : <CheckCircle2 className="w-6 h-6 shrink-0 text-[color:var(--teal-primary)]" />}
          </button>
        ) : (
          <button onClick={() => router.push('/spending-challenge')} className="glass-pressable mt-3 w-full rounded-2xl px-4 py-3 flex items-center justify-between text-left bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Atur tantangan utama</p>
              <p className="text-[11px] text-[color:var(--text-muted)]">Biar kamu tahu boleh jajan berapa tiap hari</p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0 text-[color:var(--text-muted)]" />
          </button>
        )}
      </div>
    </GlassCard>
  );
}

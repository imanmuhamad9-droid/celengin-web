'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { setActiveWallet } from '@/lib/activeWallet';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronRight, Eye, EyeOff, Plus } from 'lucide-react';
import { computeWalletBalances, type Wallet, type WalletTransfer } from '@/lib/wallets';
import type { Profile } from '@/lib/types';
import { formatRupiah } from '@/lib/utils';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
import CardBgLayer from '@/components/CardBgLayer';

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
type Tx = { wallet_id?: string | null; type: string; amount: number | string };

export default function BalanceCard({ profile, balance, totalIncome, totalExpense, hidden, onToggleHidden, allowance, onInfoAllowance, wallets = [], transactions = [], transfers = [], onAddWallet }: {
  profile: Profile | null;
  balance: number;
  totalIncome: number;
  totalExpense: number;
  hidden: boolean;
  onToggleHidden: () => void;
  /** null = belum ada tantangan utama */
  allowance: DailyAllowance | null;
  onInfoAllowance: () => void;
  /** Dompet yang bisa digeser di kartu. Kosong = kartu tunggal. */
  wallets?: Wallet[];
  transactions?: Tx[];
  transfers?: WalletTransfer[];
  onAddWallet?: () => void;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const { balances } = computeWalletBalances(wallets, transactions, transfers);
  const sumBy = (wid: string, type: string) => transactions.filter((t) => t.wallet_id === wid && t.type === type).reduce((a, t) => a + Number(t.amount), 0);
  const slideCount = wallets.length > 0 ? wallets.length + 2 : 1; // Semua + tiap dompet + tombol tambah
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setPage(i);
    setActiveWallet(i >= 1 && i <= wallets.length ? wallets[i - 1].id : null);
  };
  useEffect(() => () => setActiveWallet(null), []);
  const safe = Boolean(profile?.safe_limit) && balance >= (profile?.safe_limit ?? 0);
  const hasBg = Boolean(profile?.safe_limit && profile?.bg_safe_url);
  const zoom = (safe ? profile?.bg_safe_zoom : profile?.bg_low_zoom) || 1;
  const pos = (safe ? profile?.bg_safe_pos : profile?.bg_low_pos) || 'center';

  return (
    <GlassCard padded={false} className="relative overflow-hidden">
      {hasBg && (
        <>
          <CardBgLayer url={(safe ? profile?.bg_safe_url : profile?.bg_low_url) ?? ''} pos={pos} zoom={zoom} />
          <div className="absolute inset-0 z-0 bg-white/60 dark:bg-black/50" />
        </>
      )}

      <div className="relative z-10 p-5">
        <div ref={scroller} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory -mx-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Slide 1: semua dompet */}
          <div className="snap-center shrink-0 w-full px-5">
            <Slide label="Uang Sisa" amount={balance} income={totalIncome} expense={totalExpense} hidden={hidden} onToggleHidden={onToggleHidden}
              badge={profile?.safe_limit ? <span className={`glass shrink-0 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${safe ? 'glass-teal' : 'glass-danger'}`}><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />{safe ? 'Aman' : 'Krisis'}</span> : null} />
          </div>
          {wallets.map((w) => (
            <div key={w.id} className="snap-center shrink-0 w-full px-5">
              <Slide label={`${w.emoji} ${w.name}`} amount={balances[w.id] || 0} income={sumBy(w.id, 'income')} expense={sumBy(w.id, 'expense')} hidden={hidden} onToggleHidden={onToggleHidden}
                badge={<button onClick={() => router.push('/wallets')} className="glass glass-pressable shrink-0 px-3 py-1 rounded-full text-[11px] font-bold text-[color:var(--teal-primary)]">Detail</button>} />
            </div>
          ))}
          {wallets.length > 0 && (
            <div className="snap-center shrink-0 w-full px-5 flex">
              <button onClick={onAddWallet} className="glass glass-pressable w-full rounded-2xl flex flex-col items-center justify-center gap-2 text-sm font-bold text-[color:var(--teal-primary)] border-dashed">
                <Plus className="w-7 h-7" /> Dompet baru
              </button>
            </div>
          )}
        </div>
        {slideCount > 1 && (
          <div className="flex justify-center gap-1.5 mt-3" aria-hidden="true">
            {Array.from({ length: slideCount }).map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === page ? 'w-4 bg-[color:var(--teal-primary)]' : 'w-1.5 bg-black/20 dark:bg-white/25'}`} />)}
          </div>
        )}

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

function Slide({ label, amount, income, expense, hidden, onToggleHidden, badge }: {
  label: string; amount: number; income: number; expense: number; hidden: boolean; onToggleHidden: () => void; badge: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-semibold truncate text-[color:var(--text-muted)]">{label}</p>
            <GlassButton size="icon" onClick={onToggleHidden} aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'} className="!w-7 !h-7 text-[color:var(--text-muted)]">
              {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </GlassButton>
          </div>
          <h3 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-main)' }}>{hidden ? 'Rp ******' : formatRupiah(amount)}</h3>
        </div>
        {badge}
      </div>
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <div className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
          <p className="text-[11px] font-semibold flex items-center gap-1 text-[color:var(--text-muted)]"><ArrowDownLeft className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> Uang Masuk</p>
          <p className="text-sm font-extrabold mt-0.5 text-green-600 dark:text-green-400">{hidden ? 'Rp ***' : formatRupiah(income)}</p>
        </div>
        <div className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
          <p className="text-[11px] font-semibold flex items-center gap-1 text-[color:var(--text-muted)]"><ArrowUpRight className="w-3.5 h-3.5 text-red-500 dark:text-red-400" /> Uang Keluar</p>
          <p className="text-sm font-extrabold mt-0.5 text-red-500 dark:text-red-400">{hidden ? 'Rp ***' : formatRupiah(expense)}</p>
        </div>
      </div>
    </div>
  );
}

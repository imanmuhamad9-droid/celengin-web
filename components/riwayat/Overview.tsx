'use client';
import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { formatRupiah, toLocalDateStr } from '@/lib/utils';
import GlassCard from '@/components/GlassCard';

const COLORS = ['#ec4899', '#8b5cf6', '#f97316', '#0ea5e9', '#22c55e', '#94a3b8'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const ymOf = (d: string) => d.slice(0, 7);
const shiftMonth = (ym: string, delta: number) => {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const short = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)} jt` : n >= 1000 ? `${Math.round(n / 1000)} rb` : String(Math.round(n)));

// Ringkasan Riwayat: donat pengeluaran per kategori, perbandingan 12 bulan, dan pengeluaran terbesar.
export default function Overview({ transactions, onSeeAll }: { transactions: Transaction[]; onSeeAll: () => void }) {
  const [mode, setMode] = useState<'expense' | 'income'>('expense');
  const [picked, setPicked] = useState<string | null>(null);
  const cur = toLocalDateStr(new Date()).slice(0, 7);
  const prev = shiftMonth(cur, -1);

  const { cats, total, prevTotal, months, topCats } = useMemo(() => {
    const byCat = new Map<string, { sum: number; n: number }>();
    let total = 0, prevTotal = 0;
    const perMonth = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== mode) continue;
      const ym = ymOf(t.transaction_date);
      const amt = Number(t.amount) || 0;
      perMonth.set(ym, (perMonth.get(ym) || 0) + amt);
      if (ym === prev) prevTotal += amt;
      if (ym !== cur) continue;
      total += amt;
      const c = byCat.get(t.merchant_name) || { sum: 0, n: 0 };
      c.sum += amt; c.n += 1;
      byCat.set(t.merchant_name, c);
    }
    const sorted = [...byCat.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.sum - a.sum);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, c) => s + c.sum, 0);
    const cats = rest > 0 ? [...top, { name: 'Lainnya', sum: rest, n: 0 }] : top;
    const months = Array.from({ length: 12 }, (_, i) => { const ym = shiftMonth(cur, i - 11); return { ym, value: perMonth.get(ym) || 0 }; });
    return { cats, total, prevTotal, months, topCats: sorted.slice(0, 5) };
  }, [transactions, mode, cur, prev]);

  const change = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const maxMonth = Math.max(1, ...months.map((m) => m.value));
  const shown = picked ? months.find((m) => m.ym === picked) : null;
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([['expense', 'Pengeluaran'], ['income', 'Pemasukan']] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setMode(k); setPicked(null); }} className={`px-4 h-9 rounded-full text-xs font-bold ${mode === k ? 'glass glass-solid-teal' : 'glass text-[color:var(--text-muted)]'}`}>{label}</button>
        ))}
      </div>

      <GlassCard>
        <p className="text-sm font-extrabold mb-3" style={{ color: 'var(--text-main)' }}>{mode === 'expense' ? 'Ke mana uangmu pergi' : 'Dari mana uangmu datang'}</p>
        {total === 0 ? (
          <p className="text-xs py-6 text-center text-[color:var(--text-muted)]">Belum ada data bulan ini.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative shrink-0 w-[150px] h-[150px]">
              <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90" role="img" aria-label="Diagram donat per kategori">
                <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="20" />
                {cats.map((c, i) => {
                  const len = (c.sum / total) * C;
                  const el = <circle key={c.name} cx="70" cy="70" r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="20" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-offset} />;
                  offset += len;
                  return el;
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <span className="text-[10px] text-[color:var(--text-muted)]">Total</span>
                <span className="text-sm font-extrabold leading-tight" style={{ color: 'var(--text-main)' }}>{formatRupiah(total)}</span>
                {change !== null && (
                  <span className={`text-[10px] font-bold flex items-center ${(mode === 'expense') === (change > 0) ? 'text-red-500' : 'text-green-600'}`}>
                    {change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(change)}%
                  </span>
                )}
              </div>
            </div>
            <ul className="flex-1 min-w-0 space-y-2">
              {cats.map((c, i) => (
                <li key={c.name} className="flex items-center gap-2 text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="truncate flex-1 font-semibold" style={{ color: 'var(--text-main)' }}>{c.name}</span>
                  <span className="font-bold shrink-0 text-[color:var(--text-muted)]">{Math.round((c.sum / total) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {change !== null && total > 0 && <p className="text-[10px] mt-3 text-[color:var(--text-muted)]">Dibanding bulan lalu ({formatRupiah(prevTotal)})</p>}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between mb-3 gap-2">
          <p className="text-sm font-extrabold" style={{ color: 'var(--text-main)' }}>Per bulan</p>
          <p className="text-[11px] font-bold text-[color:var(--teal-primary)]">{shown ? `${MONTHS[Number(shown.ym.slice(5, 7)) - 1]}: ${formatRupiah(shown.value)}` : 'Ketuk batang'}</p>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {months.map((m) => {
            const isCur = m.ym === cur;
            const active = picked === m.ym;
            return (
              <button key={m.ym} onClick={() => setPicked(active ? null : m.ym)} aria-label={`${MONTHS[Number(m.ym.slice(5, 7)) - 1]} ${formatRupiah(m.value)}`} className="flex-1 min-w-0 h-full flex flex-col justify-end">
                <span className="w-full rounded-t-lg block transition-all" style={{ height: `${Math.max(4, (m.value / maxMonth) * 100)}%`, background: isCur || active ? 'var(--accent-solid)' : 'var(--accent-tint-strong)' }} />
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {months.map((m) => <span key={m.ym} className="flex-1 min-w-0 text-center text-[8px] text-[color:var(--text-muted)]">{MONTHS[Number(m.ym.slice(5, 7)) - 1]}</span>)}
        </div>
        <p className="text-[10px] mt-2 text-[color:var(--text-muted)]">Tertinggi {short(maxMonth)}</p>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-extrabold" style={{ color: 'var(--text-main)' }}>{mode === 'expense' ? 'Pengeluaran terbesar' : 'Pemasukan terbesar'}</p>
          <button onClick={onSeeAll} className="text-xs font-bold text-[color:var(--teal-primary)]">Lihat semua</button>
        </div>
        {topCats.length === 0 ? <p className="text-xs py-3 text-center text-[color:var(--text-muted)]">Belum ada data bulan ini.</p> : (
          <ul className="space-y-3.5">
            {topCats.map((c, i) => {
              const pct = total > 0 ? Math.round((c.sum / total) * 100) : 0;
              const color = COLORS[i % COLORS.length];
              return (
                <li key={c.name} className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center text-sm font-extrabold text-white" style={{ background: color }}>{c.name.trim().charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>{c.name}</p>
                      <p className="text-sm font-extrabold shrink-0" style={{ color: 'var(--text-main)' }}>{formatRupiah(c.sum)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[color:var(--text-muted)] shrink-0">{c.n} transaksi</span>
                      <span className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></span>
                      <span className="text-[10px] font-bold text-[color:var(--text-muted)] shrink-0">{pct}%</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

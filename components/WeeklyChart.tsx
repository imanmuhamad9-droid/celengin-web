'use client';
import { useEffect, useState } from 'react';
import { formatRupiah } from '@/lib/utils';
import GlassCard from './GlassCard';

// Statistik mingguan: kurva halus. Pilihan Keluar/Masuk menentukan kurva yang disorot (area berwarna);
// kurva satunya tampil sebagai garis putus tipis sebagai pembanding.
export interface WeekDay { date: string; dayName: string; income: number; expense: number }
type Mode = 'expense' | 'income';

// Keluar = merah, Masuk = hijau (sesuai makna warna di seluruh aplikasi)
const COLOR = { expense: '#ef4444', income: '#22c55e' } as const;
const MODE_KEY = 'celengin:weekly-mode';
const W = 320, H = 176, BASE = 146, TOP = 84;

const short = (n: number) => {
  if (n >= 1_000_000) return `Rp${(Math.round(n / 100_000) / 10).toString().replace('.', ',')}jt`;
  if (n >= 1000) return `Rp${Math.round(n / 1000)}rb`;
  return `Rp${Math.round(n)}`;
};
const px = (i: number, n: number) => 24 + (i * (W - 48)) / Math.max(n - 1, 1);
const smooth = (p: number[][]) => {
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const m = (p[i][0] + p[i + 1][0]) / 2;
    d += ` C${m},${p[i][1]} ${m},${p[i + 1][1]} ${p[i + 1][0]},${p[i + 1][1]}`;
  }
  return d;
};

export default function WeeklyChart({ days, rangeLabel }: { days: WeekDay[]; rangeLabel: string }) {
  const [mode, setMode] = useState<Mode>('expense');
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    try { const m = localStorage.getItem(MODE_KEY); if (m === 'income' || m === 'expense') setMode(m); } catch (_) { /* abaikan */ }
  }, []);
  const pick = (m: Mode) => { setMode(m); try { localStorage.setItem(MODE_KEY, m); } catch (_) { /* abaikan */ } };

  const n = days.length;
  if (n === 0) return null;
  const active = sel === null || sel >= n ? n - 1 : sel;

  const main = days.map((d) => (mode === 'expense' ? d.expense : d.income));
  const other = days.map((d) => (mode === 'expense' ? d.income : d.expense));
  const max = Math.max(...main, ...other, 10000);
  const pts = (arr: number[]) => arr.map((v, i) => [px(i, n), BASE - (v / max) * TOP]);
  const pm = pts(main);
  const po = pts(other);
  const mc = COLOR[mode];
  const oc = COLOR[mode === 'expense' ? 'income' : 'expense'];

  const maxMain = Math.max(...main);
  const maxIdx = main.indexOf(maxMain);
  const chip = maxMain <= 0
    ? (mode === 'expense' ? 'Belum ada pengeluaran' : 'Belum ada pemasukan')
    : `${mode === 'expense' ? 'Paling boros' : 'Terbesar'} ${days[maxIdx].dayName}, ${short(maxMain)}`;

  const bx = Math.min(Math.max(pm[active][0] - 32, 4), W - 68);
  const by = Math.max(pm[active][1] - 34, 34);
  const d = days[active];
  const dateNum = (s: string) => Number(s.slice(8, 10));

  return (
    <GlassCard className="!p-5">
      <div className="flex justify-between items-start mb-3 gap-3">
        <div>
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>Statistik Mingguan</h3>
          <p className="text-[10px] text-[color:var(--text-muted)] mt-0.5">{rangeLabel}</p>
        </div>
        <div className="glass flex p-0.5 rounded-full shrink-0">
          {(['expense', 'income'] as Mode[]).map((m) => (
            <button key={m} onClick={() => pick(m)} className={`glass-pressable px-3 h-7 rounded-full text-[11px] font-bold ${mode === m ? 'text-[color:var(--teal-primary)]' : 'text-[color:var(--text-muted)]'}`} style={mode === m ? { background: 'rgba(44, 143, 126, 0.14)' } : undefined}>{m === 'expense' ? 'Keluar' : 'Masuk'}</button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 z-10 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${mc}1f`, color: mc }}>{chip}</div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Grafik ${mode === 'expense' ? 'pengeluaran' : 'pemasukan'} 7 hari`} className="text-gray-400 dark:text-gray-500">
          {[0, 1, 2, 3].map((g) => <line key={g} x1={8} x2={W - 8} y1={BASE - g * (TOP / 3)} y2={BASE - g * (TOP / 3)} stroke="currentColor" strokeOpacity={0.18} strokeWidth={0.6} />)}
          <path d={smooth(po)} fill="none" stroke={oc} strokeWidth={2} strokeLinecap="round" strokeDasharray="4 6" opacity={0.75} />
          <path d={`${smooth(pm)} L${pm[n - 1][0]},${BASE} L${pm[0][0]},${BASE} Z`} fill={mc} opacity={0.14} />
          <path d={smooth(pm)} fill="none" stroke={mc} strokeWidth={3} strokeLinecap="round" />
          <line x1={pm[active][0]} x2={pm[active][0]} y1={pm[active][1]} y2={BASE} stroke={mc} strokeWidth={1} strokeDasharray="3 3" />
          {pm.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={i === active ? 6 : 3.5} fill={i === active ? mc : '#fff'} stroke={mc} strokeWidth={2} />)}
          <rect x={bx} y={by} width={64} height={22} rx={11} fill={mc} />
          <text x={bx + 32} y={by + 15} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">{short(main[active])}</text>
          {pm.map((q, i) => <rect key={`h${i}`} x={q[0] - 22} y={0} width={44} height={BASE + 4} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => setSel(i)} />)}
        </svg>
      </div>

      <div className="flex justify-between mt-1">
        {days.map((x, i) => (
          <button key={x.date} onClick={() => setSel(i)} className={`flex-1 text-center text-[10px] leading-tight py-1 rounded-lg transition-colors ${i === active ? 'text-[color:var(--teal-primary)] font-bold' : 'text-[color:var(--text-muted)]'}`}>
            {x.dayName}<br />{dateNum(x.date)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 text-[11px]">
        <span className="font-bold" style={{ color: 'var(--text-main)' }}>{d.dayName}, {dateNum(d.date)}</span>
        <span className="flex gap-3">
          <span className="font-bold" style={{ color: 'var(--text-main)' }}>Masuk {formatRupiah(d.income)}</span>
          <span className="font-bold" style={{ color: 'var(--text-main)' }}>Keluar {formatRupiah(d.expense)}</span>
        </span>
      </div>
      <p className="text-[10px] text-[color:var(--text-muted)] mt-2 flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: oc }} /> Garis putus: {mode === 'expense' ? 'pemasukan' : 'pengeluaran'} sebagai pembanding</p>
    </GlassCard>
  );
}

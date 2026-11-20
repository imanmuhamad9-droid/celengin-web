'use client';
import { useState } from 'react';
import type { Transaction } from '@/lib/types';
import type { RangeInfo } from '@/lib/insights';
import { formatRupiah } from '@/lib/utils';
import GlassCard from '@/components/GlassCard';
import SectionToggle from '@/components/SectionToggle';
import SegmentedControl from '@/components/SegmentedControl';

const PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#0ea5e9', '#94a3b8'];

const sumBy = (tx: Transaction[], type: 'income' | 'expense') => tx.filter((t) => t.type === type).reduce((a, t) => a + Number(t.amount), 0);
const groupBy = (tx: Transaction[], type: 'income' | 'expense') =>
  Object.entries(
    tx.filter((t) => t.type === type).reduce((acc: Record<string, number>, t) => {
      acc[t.merchant_name] = (acc[t.merchant_name] || 0) + Number(t.amount);
      return acc;
    }, {}),
  ).sort(([, a], [, b]) => b - a);

// Lipatan Statistik: ringkasan satu kalimat, uang masuk/keluar, dan rincian per kategori.
// Bisa dilihat per minggu (Senin-Minggu) atau per bulan / siklus gajian.
export default function StatsCard({ monthlyTx, allTx, weekRange, cycleLabel, cycleBased, onCategoryClick }: {
  /** Transaksi pada bulan / siklus gajian berjalan */
  monthlyTx: Transaction[];
  allTx: Transaction[];
  weekRange: RangeInfo | null;
  cycleLabel: string | null;
  /** Tanggal gajian bukan tanggal 1: tab bulanan dinamai "Siklus Gajian" */
  cycleBased: boolean;
  onCategoryClick: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'week' | 'month'>('month');

  const tx = view === 'week' && weekRange
    ? allTx.filter((t) => t.transaction_date >= weekRange.start && t.transaction_date <= weekRange.end)
    : monthlyTx;
  const income = sumBy(tx, 'income');
  const expense = sumBy(tx, 'expense');
  const incomeRows = groupBy(tx, 'income');
  const expenseRows = groupBy(tx, 'expense');

  const spentPct = income > 0 ? Math.round((expense / income) * 100) : null;
  const net = income - expense;
  const mood = spentPct === null
    ? { color: '#f59e0b', title: 'Belum ada pemasukan', sub: 'Pengeluaran sudah tercatat, tapi belum ada uang masuk di periode ini.' }
    : spentPct <= 70
      ? { color: '#10b981', title: 'Aman, masih longgar', sub: `Baru ${spentPct}% dari pemasukan yang terpakai.` }
      : spentPct <= 100
        ? { color: '#f59e0b', title: 'Hati-hati, hampir habis', sub: `${spentPct}% dari pemasukan sudah terpakai.` }
        : { color: '#ef4444', title: 'Boncos, lebih besar pasak', sub: `Pengeluaran ${spentPct}% dari pemasukan.` };

  return (
    <GlassCard>
      <SectionToggle title="Statistik" open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
          <div className="mb-4">
            <SegmentedControl
              options={[{ value: 'week', label: 'Mingguan' }, { value: 'month', label: cycleBased ? 'Siklus Gajian' : 'Bulanan' }]}
              value={view}
              onChange={setView}
            />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
              {view === 'week' && weekRange ? `Minggu ini: ${weekRange.label}` : cycleBased && cycleLabel ? cycleLabel : 'Bulan ini'}
            </p>
          </div>

          {income + expense === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">{view === 'week' ? 'Belum ada transaksi minggu ini.' : 'Belum ada transaksi di periode ini.'}</p>
          ) : (
            <>
              {/* Ringkasan: satu kalimat + satu bar */}
              <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: mood.color + '1a' }}>
                <p className="text-sm font-extrabold" style={{ color: mood.color }}>{mood.title}</p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">{mood.sub}</p>
                <div className="w-full h-3 rounded-full bg-white/70 dark:bg-gray-700 mt-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(spentPct ?? 100, 100)}%`, backgroundColor: mood.color }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                  <span>Terpakai</span><span>Pemasukan {formatRupiah(income)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 px-3 py-2.5"><p className="text-[10px] text-gray-500 dark:text-gray-400">Masuk</p><p className="text-sm font-extrabold text-green-600 dark:text-green-400">{formatRupiah(income)}</p></div>
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2.5"><p className="text-[10px] text-gray-500 dark:text-gray-400">Keluar</p><p className="text-sm font-extrabold text-red-500 dark:text-red-400">{formatRupiah(expense)}</p></div>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 mb-5 flex items-center justify-between">
                <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{net >= 0 ? 'Sisa' : 'Kurang'}</p>
                <p className="text-sm font-extrabold" style={{ color: net >= 0 ? '#0284c7' : '#ef4444' }}>{formatRupiah(Math.abs(net))}</p>
              </div>

              {expenseRows.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Uangmu habis buat apa?</p>
                  <div className="space-y-3">
                    {expenseRows.map(([name, amount], i) => {
                      const pct = expense > 0 ? Math.round((Number(amount) / expense) * 100) : 0;
                      const color = PALETTE[Math.min(i, PALETTE.length - 1)];
                      return (
                        <div key={name} onClick={() => onCategoryClick(name)} className="cursor-pointer">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className={`truncate text-sm ${i === 0 ? 'font-extrabold text-gray-800 dark:text-gray-100' : 'font-semibold text-gray-700 dark:text-gray-200'}`}>{i === 0 ? '🔥 ' : ''}{name}</span>
                            <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white" style={{ backgroundColor: color }}>{pct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} /></div>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">{formatRupiah(Number(amount))}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {incomeRows.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Uang datang dari mana?</p>
                  <div className="space-y-3">
                    {incomeRows.map(([name, amount]) => {
                      const pct = income > 0 ? Math.round((Number(amount) / income) * 100) : 0;
                      return (
                        <div key={name} onClick={() => onCategoryClick(name)} className="cursor-pointer">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="truncate text-sm font-semibold text-gray-700 dark:text-gray-200">{name}</span>
                            <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white bg-green-500">{pct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"><div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%` }} /></div>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">{formatRupiah(Number(amount))}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </GlassCard>
  );
}

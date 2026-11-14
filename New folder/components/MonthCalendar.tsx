'use client';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Flame, Plus, Receipt } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import { addDays, nextOccurrence, Frequency } from '@/lib/recurring';
import { holidayOn, holidaysInMonth } from '@/lib/holidays';

// Kalender bulanan: titik merah = ada pengeluaran, hijau = ada pemasukan, ikon tagihan = jatuh tempo,
// hijau muda = hari tanpa jajan. Tanggal merah / cuti bersama mengikuti SKB 3 Menteri (lib/holidays.ts).
// Mengetuk tanggal membuka rincian di bawah kalender, tanpa pindah halaman.
interface Tx { transaction_date: string; type: 'income' | 'expense'; amount: number | string; merchant_name: string }
interface Bill { id: string; name: string; amount: number | string; frequency: string; due_date: string; anchor_day: number }

interface Props {
  transactions: Tx[];
  bills: Bill[];
  todayStr: string;
  onOpenHistory: (date: string) => void;
  onAddOnDate: (date: string) => void;
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const pad = (n: number) => String(n).padStart(2, '0');
const short = (n: number) => (n >= 1_000_000 ? `${(Math.round(n / 100_000) / 10).toString().replace('.', ',')}jt` : n >= 1000 ? `${Math.round(n / 1000)}rb` : `${Math.round(n)}`);

export default function MonthCalendar({ transactions, bills, todayStr, onOpenHistory, onAddOnDate }: Props) {
  const [ym, setYm] = useState<{ y: number; m: number } | null>(null); // m: 0..11
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    if (todayStr && !ym) { setYm({ y: Number(todayStr.slice(0, 4)), m: Number(todayStr.slice(5, 7)) - 1 }); setSel(todayStr); }
  }, [todayStr, ym]);

  const data = useMemo(() => {
    const exp: Record<string, number> = {};
    const inc: Record<string, number> = {};
    const list: Record<string, Tx[]> = {};
    let first = '';
    for (const t of transactions) {
      const d = t.transaction_date;
      if (!d) continue;
      if (!first || d < first) first = d;
      (list[d] = list[d] || []).push(t);
      if (t.type === 'expense') exp[d] = (exp[d] || 0) + Number(t.amount);
      else inc[d] = (inc[d] || 0) + Number(t.amount);
    }
    return { exp, inc, list, first };
  }, [transactions]);

  if (!ym) return null;
  const { y, m } = ym;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstDow = new Date(y, m, 1).getDay();
  const mp = `${y}-${pad(m + 1)}`;
  const dateOf = (d: number) => `${mp}-${pad(d)}`;
  const monthEnd = dateOf(daysInMonth);

  // Tagihan jatuh tempo di bulan ini (hanya dari jatuh tempo berikutnya ke depan)
  const billsByDate: Record<string, Bill[]> = {};
  for (const b of bills) {
    let cur = b.due_date;
    let guard = 0;
    while (cur && cur <= monthEnd && guard < 400) {
      if (cur >= `${mp}-01`) (billsByDate[cur] = billsByDate[cur] || []).push(b);
      if (b.frequency === 'once') break;
      const nx = nextOccurrence(cur, b.frequency as Frequency, b.anchor_day);
      if (nx === cur) break;
      cur = nx;
      guard += 1;
    }
  }

  let monthIn = 0, monthOut = 0;
  for (let d = 1; d <= daysInMonth; d++) { monthIn += data.inc[dateOf(d)] || 0; monthOut += data.exp[dateOf(d)] || 0; }

  // Hari tanpa jajan: dihitung sejak transaksi pertama yang pernah dicatat
  const noSpend = (ds: string) => !!data.first && ds >= data.first && ds <= todayStr && !data.exp[ds];
  let streak = 0;
  if (data.first && todayStr) {
    let cur = todayStr;
    while (cur >= data.first && !data.exp[cur] && streak < 366) { streak += 1; cur = addDays(cur, -1); }
  }
  let record = 0, run = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateOf(d);
    if (noSpend(ds)) { run += 1; record = Math.max(record, run); } else run = 0;
  }

  const monthHolidays = holidaysInMonth(y, m + 1);
  const go = (delta: number) => {
    const nm = m + delta;
    const ny = y + Math.floor(nm / 12);
    const mm = ((nm % 12) + 12) % 12;
    setYm({ y: ny, m: mm });
    setSel(todayStr.startsWith(`${ny}-${pad(mm + 1)}`) ? todayStr : null);
  };

  const monthLabel = new Date(y, m, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const selInMonth = sel && sel.startsWith(mp) ? sel : null;
  const selHoliday = selInMonth ? holidayOn(selInMonth) : undefined;
  const selTx = selInMonth ? data.list[selInMonth] || [] : [];
  const selBills = selInMonth ? billsByDate[selInMonth] || [] : [];
  const selDow = selInMonth ? new Date(`${selInMonth}T00:00:00`).getDay() : 0;
  const diff = monthIn - monthOut;

  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
      <div className="flex justify-between items-center mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100">Kalender</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => go(-1)} aria-label="Bulan sebelumnya" className="p-1 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-500 hover:text-teal-600"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 w-28 text-center capitalize">{monthLabel}</span>
          <button onClick={() => go(1)} aria-label="Bulan berikutnya" className="p-1 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-500 hover:text-teal-600"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2"><p className="text-[10px] text-gray-500 dark:text-gray-400">Masuk</p><p className="text-xs font-bold text-green-600 dark:text-green-400">{formatRupiah(monthIn)}</p></div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2"><p className="text-[10px] text-gray-500 dark:text-gray-400">Keluar</p><p className="text-xs font-bold text-red-500 dark:text-red-400">{formatRupiah(monthOut)}</p></div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2"><p className="text-[10px] text-gray-500 dark:text-gray-400">Selisih</p><p className="text-xs font-bold text-gray-800 dark:text-gray-100">{diff < 0 ? '-' : diff > 0 ? '+' : ''}{formatRupiah(Math.abs(diff))}</p></div>
          </div>

          {data.first && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full"><Flame className="w-3.5 h-3.5" /> {streak} hari tanpa jajan</span>
              {record > 0 && <span className="text-[10px] text-gray-500 dark:text-gray-400">Rekor bulan ini: {record} hari</span>}
            </div>
          )}

          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((d, i) => <span key={i} className="text-[10px] font-bold text-gray-400">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const ds = dateOf(d);
              const hol = holidayOn(ds);
              const e = data.exp[ds] || 0;
              const inn = data.inc[ds] || 0;
              const hasBill = !!billsByDate[ds];
              const isToday = ds === todayStr;
              const isSel = ds === sel;
              const quiet = noSpend(ds);
              const numCls = hol ? (hol.kind === 'libur' ? 'text-red-500 dark:text-red-400' : 'text-amber-600 dark:text-amber-400') : 'text-gray-700 dark:text-gray-200';
              return (
                <button
                  key={ds}
                  onClick={() => setSel(ds)}
                  aria-label={`${d} ${monthLabel}${hol ? `, ${hol.name}` : ''}`}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 border-2 transition-colors ${quiet ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/40'} ${isSel ? 'border-gray-800 dark:border-gray-100' : isToday ? 'border-teal-500' : 'border-transparent'}`}
                >
                  <span className={`text-[11px] font-bold leading-none ${numCls}`}>{d}</span>
                  <span className="flex items-center justify-center gap-[3px] h-2.5">
                    {e > 0 && <i className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
                    {inn > 0 && <i className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
                    {hasBill && <Receipt className="w-2.5 h-2.5 text-amber-600" />}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">Titik merah: pengeluaran. Hijau: pemasukan. Ikon tagihan: jatuh tempo. Latar hijau muda: hari tanpa jajan. Angka merah: libur nasional, oranye: cuti bersama.</p>

          {monthHolidays.length > 0 && (
            <div className="mt-3 space-y-1">
              {monthHolidays.map((h) => (
                <div key={h.date} className="flex items-start gap-2 text-[11px]">
                  <span className={`shrink-0 font-bold w-5 text-right ${h.kind === 'libur' ? 'text-red-500' : 'text-amber-600'}`}>{Number(h.date.slice(8))}</span>
                  <span className="text-gray-600 dark:text-gray-300">{h.name}</span>
                </div>
              ))}
            </div>
          )}

          {selInMonth && (
            <div className="border-t border-gray-100 dark:border-gray-700 mt-4 pt-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{DAY_NAMES[selDow]}, {Number(selInMonth.slice(8))} {new Date(y, m, 1).toLocaleDateString('id-ID', { month: 'short' })}</p>
                {selInMonth === todayStr && <span className="text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">Hari ini</span>}
              </div>
              {selHoliday && <p className={`text-[11px] font-bold mb-2 ${selHoliday.kind === 'libur' ? 'text-red-500' : 'text-amber-600'}`}>{selHoliday.kind === 'libur' ? 'Libur nasional' : 'Cuti bersama'}: {selHoliday.name}</p>}

              {selTx.slice(0, 6).map((t, i) => (
                <div key={i} className="flex justify-between gap-3 text-xs py-1">
                  <span className="text-gray-700 dark:text-gray-200 truncate">{t.merchant_name}</span>
                  <span className={`font-bold shrink-0 ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{t.type === 'income' ? '+' : '-'}{formatRupiah(Number(t.amount))}</span>
                </div>
              ))}
              {selTx.length > 6 && <p className="text-[11px] text-gray-400">+{selTx.length - 6} transaksi lainnya</p>}
              {selBills.map((b) => (
                <div key={b.id} className="flex justify-between gap-3 text-xs py-1">
                  <span className="text-amber-700 dark:text-amber-400 truncate flex items-center gap-1"><Receipt className="w-3 h-3 shrink-0" /> {b.name}</span>
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">jatuh tempo {formatRupiah(Number(b.amount))}</span>
                </div>
              ))}
              {selTx.length === 0 && selBills.length === 0 && (
                <p className="text-xs text-gray-400 py-1">{selInMonth > todayStr ? 'Belum ada catatan.' : 'Tidak ada transaksi di hari ini.'}</p>
              )}

              <div className="flex gap-2 mt-3">
                <button onClick={() => onAddOnDate(selInMonth)} className="flex-1 h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> Catat di tanggal ini</button>
                <button onClick={() => onOpenHistory(selInMonth)} className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200">Buka di riwayat</button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

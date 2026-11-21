'use client';
import { useEffect, useMemo, useState } from 'react';
import { Delete, Pencil, Trash2, X } from 'lucide-react';
import { evaluate, formatExpr, insertNumber, numToExpr, pressKey } from '@/lib/calc';
import { toLocalDateStr } from '@/lib/utils';
import { activeMonth, addMonthKey, groupMonthTotal } from '@/lib/installments';
import { billAmount, installmentTotal, loadBills, loadInstallments, loadRules, ruleAmount, type InstData } from '@/lib/simulasiData';
import type { Bill, RecurringRule } from '@/lib/types';
import GlassCard from '@/components/GlassCard';
import SectionToggle from '@/components/SectionToggle';

interface Chip { key: string; label: string; amount: number }
interface HistoryItem { id: string; expr: string; result: number; at: string }

// Riwayat disimpan di perangkat ini (localStorage), maksimal 50 hitungan terakhir.
const HISTORY_KEY = 'celengin:calc-history';
const HISTORY_MAX = 50;
function readHistory(): HistoryItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((h): h is HistoryItem => h && typeof h.id === 'string' && typeof h.expr === 'string' && typeof h.result === 'number' && typeof h.at === 'string').slice(0, HISTORY_MAX);
  } catch { return []; }
}
const newId = () => Math.random().toString(36).slice(2, 10);

interface Loaded { income: RecurringRule[]; expense: RecurringRule[]; bills: Bill[]; inst: InstData }

const monthName = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('id-ID', { month: 'long' });

// [teks, tombol, gaya]
const KEYS: [string, string, 'fn' | 'op' | 'num' | 'eq'][] = [
  ['C', 'C', 'fn'], ['⌫', 'BACK', 'fn'], ['%', '%', 'fn'], ['÷', '/', 'op'],
  ['7', '7', 'num'], ['8', '8', 'num'], ['9', '9', 'num'], ['×', '*', 'op'],
  ['4', '4', 'num'], ['5', '5', 'num'], ['6', '6', 'num'], ['−', '-', 'op'],
  ['1', '1', 'num'], ['2', '2', 'num'], ['3', '3', 'num'], ['+', '+', 'op'],
  ['0', '0', 'num'], ['00', '00', 'num'], [',', '.', 'num'], ['=', '=', 'eq'],
];

// Kalkulator biasa dengan tombol pintas angka dari datamu (gaji, cicilan, tagihan), supaya tidak bolak-balik menu.
export default function Calculator({ userId }: { userId: string }) {
  const [expr, setExpr] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(readHistory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [chipsOpen, setChipsOpen] = useState<boolean>(() => { try { return localStorage.getItem('celengin:calc-chips-open') === '1'; } catch { return false; } });
  const toggleChips = () => setChipsOpen((v) => {
    try { localStorage.setItem('celengin:calc-chips-open', v ? '0' : '1'); } catch { /* abaikan */ }
    return !v;
  });
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [cur] = useState(() => toLocalDateStr(new Date()).slice(0, 7));

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [income, expense, bills, inst] = await Promise.all([loadRules(userId, 'income'), loadRules(userId, 'expense'), loadBills(userId), loadInstallments(userId)]);
        if (!off) setData({ income, expense, bills, inst });
      } catch { if (!off) setFailed(true); }
    })();
    return () => { off = true; };
  }, [userId]);

  const chips = useMemo<Chip[]>(() => {
    if (!data) return [];
    const next = addMonthKey(cur, 1);
    const sum = <T,>(xs: T[], fn: (x: T) => number) => xs.reduce((s, x) => s + fn(x), 0);
    const list: Chip[] = [
      { key: 'gaji', label: `Pemasukan rutin ${monthName(cur)}`, amount: sum(data.income, (r) => ruleAmount(r, cur)) },
      { key: 'cicilan', label: `Cicilan ${monthName(cur)}`, amount: installmentTotal(data.inst, cur, cur) },
      { key: 'cicilan-next', label: `Cicilan ${monthName(next)}`, amount: installmentTotal(data.inst, cur, next) },
      ...data.inst.groups.map((g): Chip => {
        const gm = activeMonth(g, cur);
        return { key: `g-${g.id}`, label: g.name, amount: groupMonthTotal(g, data.inst.items.filter((x) => x.group_id === g.id), data.inst.pays.filter((x) => x.group_id === g.id), cur, gm) };
      }),
      { key: 'tagihan', label: `Tagihan ${monthName(cur)}`, amount: sum(data.bills, (b) => billAmount(b, cur)) },
      { key: 'rutin', label: `Pengeluaran rutin ${monthName(cur)}`, amount: sum(data.expense, (r) => ruleAmount(r, cur)) },
    ];
    return list.filter((c) => c.amount > 0);
  }, [data, cur]);

  const saveHistory = (next: HistoryItem[]) => {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* penyimpanan penuh atau dinonaktifkan */ }
  };

  const result = evaluate(expr);
  const hasOperation = /[+\-*/%]/.test(expr.replace(/^-/, ''));
  const shown = formatExpr(expr);
  const pieces = expr.match(/-?\d[\d.]*%?[+\-*/]?|[+\-*/]/g) ?? [];
  // Hasil otomatis hanya muncul bila ada operasi, jadi angka tunggal tidak diulang dua kali
  const showPreview = result !== null && hasOperation;

  const press = (key: string) => {
    if (key === 'C') return setExpr('');
    if (key === 'BACK') return setExpr((e) => e.slice(0, -1));
    if (key === '=') {
      if (result === null) return;
      if (editingId) {
        saveHistory(history.map((h) => (h.id === editingId ? { ...h, expr, result } : h)));
        setEditingId(null);
      } else if (hasOperation) {
        saveHistory([{ id: newId(), expr, result, at: new Date().toISOString() }, ...history].slice(0, HISTORY_MAX));
      }
      return setExpr(numToExpr(result));
    }
    setExpr((e) => pressKey(e, key));
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        {editingId && (
          <div className="flex items-center justify-between gap-2 mb-2 rounded-xl px-3 py-1.5 glass-teal glass text-[11px] font-bold">
            <span className="flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> Mengedit hitungan dari riwayat. Tekan = untuk menyimpan.</span>
            <button type="button" onClick={() => { setEditingId(null); setExpr(''); }} aria-label="Batal mengedit"><X className="w-4 h-4" /></button>
          </div>
        )}
        {/* Tiap angka (beserta operator di belakangnya) satu paket: baris baru hanya terjadi di antara paket */}
        <div
          className={`flex flex-wrap justify-end font-extrabold tracking-tight leading-tight ${shown.length > 22 ? 'text-2xl' : shown.length > 13 ? 'text-3xl' : 'text-5xl'}`}
          style={{ color: 'var(--text-main)' }}
          aria-live="polite"
          aria-label={shown || '0'}
        >
          {pieces.length === 0 ? <span>0</span> : pieces.map((p, i) => <span key={i} className="whitespace-nowrap">{formatExpr(p)}</span>)}
        </div>
        <p className="text-right text-sm font-semibold mt-1.5 min-h-[20px] break-all text-[color:var(--text-muted)]">
          {showPreview ? `= ${formatExpr(numToExpr(result as number))}` : ' '}
        </p>
      </GlassCard>

      <GlassCard>
        <SectionToggle title="Ambil dari datamu" open={chipsOpen} onToggle={toggleChips} />
        {chipsOpen && <div className="mt-3">
        {failed && <p className="text-[11px] text-[color:var(--text-muted)]">Data belum bisa diambil. Kalkulator tetap bisa dipakai.</p>}
        {!failed && !data && <p className="text-[11px] text-[color:var(--text-muted)]">Mengambil data...</p>}
        {data && chips.length === 0 && <p className="text-[11px] text-[color:var(--text-muted)]">Belum ada cicilan, tagihan, atau transaksi rutin yang tercatat.</p>}
        {chips.length > 0 && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {chips.map((c) => (
                <button key={c.key} type="button" onClick={() => setExpr((e) => insertNumber(e, Math.round(c.amount)))} className="glass glass-teal glass-pressable shrink-0 rounded-2xl px-3 py-2 text-left">
                  <span className="block text-[10px] font-semibold opacity-80 max-w-[130px] truncate">{c.label}</span>
                  <span className="block text-xs font-extrabold">{formatExpr(numToExpr(Math.round(c.amount)))}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] mt-1.5 text-[color:var(--text-muted)]">Ketuk untuk memasukkan angkanya ke hitungan.</p>
          </>
        )}
        </div>}
      </GlassCard>

      <div className="grid grid-cols-4 gap-2.5">
        {KEYS.map(([text, key, style]) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === 'BACK' ? 'Hapus satu karakter' : key === 'C' ? 'Bersihkan' : undefined}
            className={`glass-pressable h-14 rounded-2xl text-lg font-extrabold flex items-center justify-center ${
              style === 'eq' ? 'glass glass-solid-teal' : style === 'op' ? 'glass glass-teal' : 'glass'
            }`}
            style={style === 'num' || style === 'fn' ? { color: 'var(--text-main)' } : undefined}
          >
            {key === 'BACK' ? <Delete className="w-5 h-5" /> : text}
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>Riwayat hitungan</p>
            <button type="button" onClick={() => { saveHistory([]); setEditingId(null); }} className="text-[11px] font-bold text-[color:var(--text-muted)] underline">Hapus semua</button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-black/[0.07] dark:divide-white/10">
            {history.map((h) => (
              <div key={h.id} className={`flex items-center gap-2 py-2 ${editingId === h.id ? 'text-[color:var(--teal-primary)]' : ''}`}>
                <button type="button" onClick={() => { setExpr(h.expr); setEditingId(h.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex-1 min-w-0 text-left" aria-label="Edit hitungan ini">
                  <span className="block text-xs truncate text-[color:var(--text-muted)]">{formatExpr(h.expr)}</span>
                  <span className="block text-sm font-extrabold" style={{ color: 'var(--text-main)' }}>= {formatExpr(numToExpr(h.result))}</span>
                  <span className="block text-[10px] text-[color:var(--text-muted)]">{new Date(h.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </button>
                <button type="button" onClick={() => setExpr((e) => insertNumber(e, h.result))} className="glass glass-teal glass-pressable shrink-0 px-2.5 h-8 rounded-full text-[11px] font-bold">Pakai hasil</button>
                <button type="button" onClick={() => { saveHistory(history.filter((x) => x.id !== h.id)); if (editingId === h.id) { setEditingId(null); setExpr(''); } }} aria-label="Hapus dari riwayat" className="shrink-0 text-[color:var(--text-muted)]"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-2 text-[color:var(--text-muted)]">Ketuk sebuah hitungan untuk mengeditnya. Riwayat tersimpan di perangkat ini.</p>
        </GlassCard>
      )}
    </div>
  );
}

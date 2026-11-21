'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Wand2 } from 'lucide-react';
import { formatRupiah, parseRupiahInput } from '@/lib/utils';
import { toLocalDateStr } from '@/lib/utils';
import { installmentTotal, loadBills, loadInstallments, loadRules, billAmount, ruleAmount } from '@/lib/simulasiData';
import {
  GROUP_LABEL, addMonthKey, byMonths, daysInMonth, levelOf, mergeAutoRows, newRowId, perDay, rowAmount, totalsFor,
  type SimData, type SimGroup, type SimRow,
} from '@/lib/simulasi';
import GlassCard from '@/components/GlassCard';
import SegmentedControl from '@/components/SegmentedControl';
import { inputCls } from '@/components/FinUI';

type ShowDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;

const GROUPS: SimGroup[] = ['income', 'duty', 'plan'];
const monthName = (ym: string, withYear = true) =>
  new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('id-ID', withYear ? { month: 'long', year: 'numeric' } : { month: 'short' });
const monthShort = (ym: string) =>
  new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });

function MoneyField({ value, onChange, compact = false, label }: { value: number; onChange: (n: number) => void; compact?: boolean; label: string }) {
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      value={value > 0 ? parseRupiahInput(String(value)).display : ''}
      onChange={(e) => onChange(parseRupiahInput(e.target.value).raw)}
      placeholder="0"
      className={`${inputCls} text-right font-bold ${compact ? '!h-9 !px-2 text-xs !w-[104px]' : '!w-36'}`}
    />
  );
}

const LEVEL_STYLE = {
  ok: { color: 'var(--teal-primary)', note: '' },
  thin: { color: '#f59e0b', note: 'Sisa tipis: kurang dari 10% dari pemasukan.' },
  negative: { color: '#ef4444', note: 'Kewajiban dan rencana melebihi pemasukan.' },
} as const;

// Editor satu rencana: tampilan 1 bulan (daftar) dan 3 bulan (tabel). Semua perubahan lewat onChange; menyimpan urusan halaman.
export default function PlanEditor({ data, onChange, userId, showDialog, onSave, saving, dirty }: {
  data: SimData;
  onChange: (d: SimData) => void;
  userId: string;
  showDialog: ShowDialog;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  const [view, setView] = useState<'1' | '3'>('1');
  const [busy, setBusy] = useState<string | null>(null);

  const months = view === '1' ? [data.month] : [data.month, addMonthKey(data.month, 1), addMonthKey(data.month, 2)];
  const setRows = (rows: SimRow[]) => onChange({ ...data, rows });
  const patch = (id: string, p: Partial<SimRow>) => setRows(data.rows.map((r) => (r.id === id ? { ...r, ...p } : r)));

  // Mengubah jumlah: di tampilan 1 bulan, baris yang punya nilai khusus bulan itu ikut diubah per bulan; selain itu jumlah bawaan.
  const setAmount = (r: SimRow, ym: string, n: number, forceMonth: boolean) => {
    if (forceMonth || r.by?.[ym] !== undefined) patch(r.id, { by: { ...(r.by || {}), [ym]: n } });
    else patch(r.id, { amount: n });
  };
  const addRow = (group: SimGroup) => setRows([...data.rows, { id: newRowId(), group, label: '', amount: 0, on: true }]);
  const removeRow = (id: string) => setRows(data.rows.filter((r) => r.id !== id));

  // ---- Isi otomatis dari data aplikasi (hanya membaca) ----
  const horizon = Array.from({ length: 12 }, (_, i) => addMonthKey(data.month, i));
  const run = async (key: string, fn: () => Promise<SimRow[] | string>) => {
    setBusy(key);
    try {
      const out = await fn();
      if (typeof out === 'string') showDialog('Tidak ada data', out, 'info');
      else setRows(mergeAutoRows(data.rows, out));
    } catch {
      showDialog('Gagal mengambil data', 'Coba lagi sebentar lagi.', 'danger');
    } finally {
      setBusy(null);
    }
  };
  const autoRow = (group: SimGroup, label: string, auto: string, fn: (ym: string) => number): SimRow =>
    ({ id: newRowId(), group, label, amount: fn(data.month), by: byMonths(horizon, fn), on: true, auto });

  const importRules = (type: 'income' | 'expense') => run(`rule-${type}`, async () => {
    const rules = await loadRules(userId, type);
    if (rules.length === 0) return type === 'income' ? 'Belum ada transaksi rutin pemasukan (mis. gaji). Atur di Pengaturan > Transaksi Rutin, atau tambah baris sendiri.' : 'Belum ada transaksi rutin pengeluaran.';
    return rules.map((r) => autoRow(type === 'income' ? 'income' : 'duty', r.merchant_name, `rule:${r.id}`, (ym) => ruleAmount(r, ym)));
  });

  const importBills = () => run('bills', async () => {
    const bills = await loadBills(userId);
    if (bills.length === 0) return 'Belum ada tagihan aktif.';
    return bills.map((b) => autoRow('duty', b.name, `bill:${b.id}`, (ym) => billAmount(b, ym)));
  });

  const importInstallments = () => run('cicilan', async () => {
    const inst = await loadInstallments(userId);
    if (inst.groups.length === 0) return 'Belum ada bucket cicilan.';
    const cur = toLocalDateStr(new Date()).slice(0, 7);
    return [autoRow('duty', 'Cicilan', 'cicilan', (ym) => installmentTotal(inst, cur, ym))];
  });

  // ---- Hasil ----
  const t0 = totalsFor(data.rows, data.month);
  const lv = levelOf(t0);

  return (
    <div className="space-y-4">
      {/* Bulan + tampilan */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Bulan sebelumnya" onClick={() => onChange({ ...data, month: addMonthKey(data.month, -1) })} className="glass glass-pressable w-9 h-9 rounded-full flex items-center justify-center text-[color:var(--text-muted)]"><ChevronLeft className="w-4 h-4" /></button>
          <span className="min-w-[116px] text-center text-sm font-extrabold" style={{ color: 'var(--text-main)' }}>{monthName(data.month)}</span>
          <button type="button" aria-label="Bulan berikutnya" onClick={() => onChange({ ...data, month: addMonthKey(data.month, 1) })} className="glass glass-pressable w-9 h-9 rounded-full flex items-center justify-center text-[color:var(--text-muted)]"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="w-40 shrink-0">
          <SegmentedControl options={[{ value: '1', label: '1 bulan' }, { value: '3', label: '3 bulan' }]} value={view} onChange={setView} />
        </div>
      </div>

      {/* Hasil bulan pertama */}
      <GlassCard>
        <p className="text-xs font-semibold text-[color:var(--text-muted)]">Sisa untuk dipakai · {monthName(data.month)}</p>
        <p className="text-3xl font-extrabold tracking-tight mt-1" style={{ color: LEVEL_STYLE[lv].color }}>{t0.left < 0 ? '-' : ''}{formatRupiah(Math.abs(t0.left))}</p>
        <p className="text-[11px] mt-1 text-[color:var(--text-muted)]">
          {t0.left > 0 ? `Sekitar ${formatRupiah(perDay(t0.left, data.month))} per hari (dibagi ${daysInMonth(data.month)} hari)` : 'Tidak ada sisa untuk dibagi per hari'}
        </p>
        {LEVEL_STYLE[lv].note && <p className="text-[11px] font-bold mt-2" style={{ color: LEVEL_STYLE[lv].color }}>{LEVEL_STYLE[lv].note}</p>}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {([['Pemasukan', t0.income], ['Kewajiban', t0.duty], ['Rencana', t0.plan]] as const).map(([l, v]) => (
            <div key={l} className="rounded-2xl px-3 py-2 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
              <p className="text-[10px] font-semibold text-[color:var(--text-muted)]">{l}</p>
              <p className="text-xs font-extrabold mt-0.5" style={{ color: 'var(--text-main)' }}>{formatRupiah(v)}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Isi otomatis */}
      <GlassCard>
        <p className="text-sm font-extrabold flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}><Wand2 className="w-4 h-4 text-[color:var(--teal-primary)]" /> Isi otomatis dari datamu</p>
        <p className="text-[11px] mt-0.5 mb-3 text-[color:var(--text-muted)]">Mengambil angka yang sudah tercatat (hanya dibaca), lalu bisa kamu ubah. Mengambil ulang menimpa baris yang sama.</p>
        <div className="flex flex-wrap gap-2">
          {([
            ['rule-income', 'Gaji & pemasukan rutin', () => importRules('income')],
            ['cicilan', 'Cicilan', importInstallments],
            ['bills', 'Tagihan', importBills],
            ['rule-expense', 'Pengeluaran rutin', () => importRules('expense')],
          ] as const).map(([k, label, fn]) => (
            <button key={k} type="button" disabled={busy !== null} onClick={() => void fn()} className="glass glass-teal glass-pressable px-3.5 h-9 rounded-full text-xs font-bold disabled:opacity-50">
              {busy === k ? 'Mengambil...' : `+ ${label}`}
            </button>
          ))}
        </div>
      </GlassCard>

      {view === '1' ? (
        GROUPS.map((g) => (
          <GlassCard key={g}>
            <p className="text-sm font-extrabold mb-2" style={{ color: 'var(--text-main)' }}>{GROUP_LABEL[g]}</p>
            <div className="space-y-2">
              {data.rows.filter((r) => r.group === g).map((r) => (
                <div key={r.id} className={`flex items-center gap-2 ${r.on ? '' : 'opacity-50'}`}>
                  <input type="checkbox" checked={r.on} onChange={(e) => patch(r.id, { on: e.target.checked })} aria-label={`Ikut hitung ${r.label || 'baris'}`} className="w-4 h-4 shrink-0 accent-sky-600" />
                  <input value={r.label} onChange={(e) => patch(r.id, { label: e.target.value })} placeholder="Nama" aria-label="Nama baris" className={`${inputCls} flex-1 !h-10`} />
                  <MoneyField label={`Jumlah ${r.label || 'baris'}`} value={rowAmount(r, data.month)} onChange={(n) => setAmount(r, data.month, n, false)} />
                  <button type="button" onClick={() => removeRow(r.id)} aria-label="Hapus baris" className="shrink-0 text-[color:var(--text-muted)]"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {data.rows.every((r) => r.group !== g) && <p className="text-[11px] text-[color:var(--text-muted)]">Belum ada baris.</p>}
            </div>
            <button type="button" onClick={() => addRow(g)} className="mt-3 text-xs font-bold flex items-center gap-1 text-[color:var(--teal-primary)]"><Plus className="w-3.5 h-3.5" /> Tambah baris</button>
          </GlassCard>
        ))
      ) : (
        <GlassCard padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 glass-sheet text-left px-3 py-2.5 font-bold text-[color:var(--text-muted)] min-w-[110px]">Bulan</th>
                  {months.map((m) => <th key={m} className="px-2 py-2.5 font-bold text-right text-[color:var(--text-muted)]">{monthShort(m)}</th>)}
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((g) => {
                  const rows = data.rows.filter((r) => r.group === g);
                  return [
                    <tr key={`h-${g}`}><td colSpan={months.length + 1} className="px-3 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[color:var(--text-muted)]">{GROUP_LABEL[g]}</td></tr>,
                    ...rows.map((r) => (
                      <tr key={r.id} className={r.on ? '' : 'opacity-50'}>
                        <td className="sticky left-0 z-10 glass-sheet px-3 py-1">
                          <div className="flex items-center gap-1.5">
                            <input type="checkbox" checked={r.on} onChange={(e) => patch(r.id, { on: e.target.checked })} aria-label={`Ikut hitung ${r.label || 'baris'}`} className="w-3.5 h-3.5 shrink-0 accent-sky-600" />
                            <input value={r.label} onChange={(e) => patch(r.id, { label: e.target.value })} placeholder="Nama" aria-label="Nama baris" className="w-[84px] min-w-0 bg-transparent outline-none font-semibold text-[color:var(--text-main)] truncate" />
                          </div>
                        </td>
                        {months.map((m) => (
                          <td key={m} className="px-1.5 py-1"><MoneyField compact label={`${r.label || 'Baris'} ${monthShort(m)}`} value={rowAmount(r, m)} onChange={(n) => setAmount(r, m, n, true)} /></td>
                        ))}
                      </tr>
                    )),
                    <tr key={`a-${g}`}><td className="sticky left-0 z-10 glass-sheet px-3 py-1"><button type="button" onClick={() => addRow(g)} className="text-[11px] font-bold text-[color:var(--teal-primary)]">+ Baris</button></td>{months.map((m) => <td key={m} />)}</tr>,
                  ];
                })}
                <tr>
                  <td className="sticky left-0 z-10 glass-sheet px-3 py-2.5 font-extrabold border-t border-black/[0.07] dark:border-white/10" style={{ color: 'var(--text-main)' }}>Sisa</td>
                  {months.map((m) => {
                    const t = totalsFor(data.rows, m);
                    return <td key={m} className="px-2 py-2.5 text-right font-extrabold border-t border-black/[0.07] dark:border-white/10" style={{ color: LEVEL_STYLE[levelOf(t)].color }}>{t.left < 0 ? '-' : ''}{formatRupiah(Math.abs(t.left))}</td>;
                  })}
                </tr>
                <tr>
                  <td className="sticky left-0 z-10 glass-sheet px-3 pb-3 text-[11px] text-[color:var(--text-muted)]">Per hari</td>
                  {months.map((m) => <td key={m} className="px-2 pb-3 text-right text-[11px] text-[color:var(--text-muted)]">{formatRupiah(perDay(totalsFor(data.rows, m).left, m))}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] px-3 pb-3 text-[color:var(--text-muted)]">Ketik di kolom sebuah bulan untuk mengubah jumlah bulan itu saja. Geser ke samping bila tabel terpotong.</p>
        </GlassCard>
      )}

      {/* Bilah bawah: total tetap terlihat tanpa perlu menggulir ke atas */}
      <div className="sticky z-[45]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}>
        <div className="glass glass-sheet rounded-3xl px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-[color:var(--text-muted)] truncate">Sisa {monthName(data.month)}</p>
            <p className="text-lg font-extrabold leading-tight truncate" style={{ color: LEVEL_STYLE[lv].color }}>{t0.left < 0 ? '-' : ''}{formatRupiah(Math.abs(t0.left))}</p>
            <p className="text-[10px] text-[color:var(--text-muted)] truncate">{t0.left > 0 ? `≈ ${formatRupiah(perDay(t0.left, data.month))} per hari` : 'Tidak ada sisa'}</p>
          </div>
          <button type="button" onClick={onSave} disabled={saving || !dirty} className="glass glass-solid-teal shrink-0 h-11 px-5 rounded-2xl font-bold text-sm disabled:opacity-50">
            {saving ? 'Menyimpan...' : dirty ? 'Simpan' : 'Tersimpan ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, parseRupiahInput, rupiahDisplay, toLocalDateStr } from '@/lib/utils';
import { Cycle, cycleFor, paydayRuleFrom, shiftCycle, type PaydayRule } from '@/lib/cycle';
import { BudgetRow, budgetUsage, catLabel, normCat } from '@/lib/finance';
import { useCatatAction } from '@/lib/catatAction';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SkeletonLoader from '@/components/SkeletonLoader';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
import { ProgressBar, Sheet, SqlNotice, StatusBadge, chipOff, chipOn, inputCls, labelCls } from '@/components/FinUI';

interface ExpenseRow { merchant_name: string | null; amount: number | string }
// Form: null = tertutup. category kosong = pilih kategori baru; budget terisi = mengubah batas.
interface FormState { budget: BudgetRow | null; category: string }

const dayDiff = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);

export default function BudgetsPage() {
  const router = useRouter();
  const [today, setToday] = useState('');          // diisi saat data dimuat (bukan saat render)
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [payday, setPayday] = useState<PaydayRule>({ day: 1, shift: 'none' });
  const [viewDate, setViewDate] = useState('');       // tanggal di dalam siklus yang dilihat; kosong = siklus berjalan
  const [tableOk, setTableOk] = useState(true);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [form, setForm] = useState<FormState | null>(null);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  const load = useCallback(async (date: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    setUserId(session.user.id);
    const now = toLocalDateStr(new Date());
    setToday(now);
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    const pd = paydayRuleFrom(prof as { payday?: unknown; payday_shift?: unknown } | null);
    setPayday(pd);
    const cyc = cycleFor(date || now, pd);

    const { data: bud, error } = await supabase.from('budgets').select('*').order('created_at', { ascending: true });
    setTableOk(!error);
    setBudgets((bud || []) as BudgetRow[]);
    const { data: tx } = await supabase.from('transactions').select('merchant_name,amount').eq('type', 'expense').gte('transaction_date', cyc.start).lte('transaction_date', cyc.end);
    setExpenses((tx || []) as ExpenseRow[]);
    const { data: pr } = await supabase.from('presets').select('label');
    setPresets(((pr || []) as { label: string }[]).map((p) => p.label));
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(viewDate); }, [load, viewDate]);

  useCatatAction('Anggaran', 'Buat anggaran', () => setForm({ budget: null, category: '' }));

  if (loading) return <div className="min-h-screen bg-[var(--page-bg)]"><SkeletonLoader variant="list" /></div>;

  const shownDate = viewDate || today;
  const cycle: Cycle = cycleFor(shownDate, payday);
  const isCurrent = cycle.start <= today && today <= cycle.end;
  const usage = budgetUsage(budgets, expenses);
  const daysLeft = isCurrent ? Math.max(1, dayDiff(today, cycle.end) + 1) : 0;
  const remainingTotal = usage.totalLimit - usage.totalSpent;

  // Saran kategori: preset yang ada + kategori yang dipakai di siklus ini, tanpa yang sudah punya anggaran
  const budgeted = new Set(budgets.map((b) => normCat(b.category)));
  const suggestionMap = new Map<string, string>();
  [...presets, ...usage.unbudgeted.map((u) => u.label)].forEach((l) => { const k = normCat(l); if (k && !budgeted.has(k) && !suggestionMap.has(k)) suggestionMap.set(k, catLabel(l)); });
  const suggestions = [...suggestionMap.values()];

  const deleteBudget = (b: { id: string; category: string }) => {
    showDialog('Hapus Anggaran?', `Anggaran ${b.category} akan dihapus. Transaksimu tidak terpengaruh.`, 'danger', async () => {
      const { error } = await supabase.from('budgets').delete().eq('id', b.id);
      if (error) showDialog('Gagal', error.message, 'danger');
      else load(viewDate);
    });
  };

  const goCycle = (dir: 1 | -1) => setViewDate(shiftCycle(shownDate, dir, payday).start);

  return (
    <div className="min-h-screen bg-[var(--page-bg)] pb-40 transition-colors">
      <AppHeader title="Anggaran" />

      <main className="max-w-md mx-auto px-4 mt-3 space-y-4">
        {!tableOk && <SqlNotice file="sql/08_fitur_keuangan.sql" />}

        <div className="flex items-center justify-between gap-2">
          <GlassButton size="icon" onClick={() => goCycle(-1)} aria-label="Siklus sebelumnya"><ChevronLeft className="w-5 h-5" /></GlassButton>
          <p className="text-sm font-bold text-center" style={{ color: 'var(--text-main)' }}>{cycle.label}</p>
          <GlassButton size="icon" onClick={() => goCycle(1)} disabled={isCurrent} aria-label="Siklus berikutnya"><ChevronRight className="w-5 h-5" /></GlassButton>
        </div>

        {tableOk && budgets.length > 0 && (
          <GlassCard>
            <p className="text-xs font-semibold text-[color:var(--text-muted)]">{remainingTotal >= 0 ? 'Sisa anggaran' : 'Melebihi anggaran'}</p>
            <p className="text-3xl font-extrabold tracking-tight mt-1" style={{ color: 'var(--text-main)' }}>{formatRupiah(Math.abs(remainingTotal))}</p>
            <div className="mt-3"><ProgressBar pct={usage.totalLimit > 0 ? (usage.totalSpent / usage.totalLimit) * 100 : 0} over={remainingTotal < 0} label="Total anggaran terpakai" /></div>
            <p className="text-[11px] mt-2 text-[color:var(--text-muted)]">Terpakai {formatRupiah(usage.totalSpent)} dari {formatRupiah(usage.totalLimit)}</p>
            {isCurrent && remainingTotal > 0 && <p className="text-[11px] text-[color:var(--text-muted)]">{daysLeft} hari lagi · boleh {formatRupiah(Math.floor(remainingTotal / daysLeft))} per hari</p>}
          </GlassCard>
        )}

        {tableOk && budgets.length === 0 && (
          <GlassCard>
            <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Belum ada anggaran</p>
            <p className="text-xs mt-1 mb-4 leading-relaxed text-[color:var(--text-muted)]">Pasang batas per kategori, misalnya Makan atau Hiburan. Pengeluaran yang kamu Catat dengan kategori yang sama otomatis menghitung sisanya.</p>
            <GlassButton variant="primary" size="lg" full onClick={() => setForm({ budget: null, category: '' })}>Buat anggaran pertama</GlassButton>
          </GlassCard>
        )}

        <div className="space-y-3">
          {usage.rows.map((r) => (
            <GlassCard key={r.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>{catLabel(r.category)}</p>
                <StatusBadge tone={r.status === 'over' ? 'bad' : r.status === 'warn' ? 'warn' : 'ok'}>{r.status === 'over' ? 'Lewat batas' : r.status === 'warn' ? 'Hampir habis' : 'Aman'}</StatusBadge>
              </div>
              <p className="text-xs mt-1.5 text-[color:var(--text-muted)]"><strong style={{ color: 'var(--text-main)' }}>{formatRupiah(r.spent)}</strong> dari {formatRupiah(r.limit)}</p>
              <div className="mt-2"><ProgressBar pct={r.pct} over={r.status === 'over'} label={`Anggaran ${r.category}`} /></div>
              <p className="text-[11px] mt-1.5 text-[color:var(--text-muted)]">{r.remaining >= 0 ? `Sisa ${formatRupiah(r.remaining)}` : `Lewat ${formatRupiah(-r.remaining)}`}</p>
              <div className="flex justify-end gap-2 mt-3">
                <GlassButton variant="teal" size="sm" onClick={() => setForm({ budget: budgets.find((b) => b.id === r.id) || null, category: r.category })}>Ubah</GlassButton>
                <GlassButton variant="danger" size="sm" onClick={() => deleteBudget(r)}>Hapus</GlassButton>
              </div>
            </GlassCard>
          ))}
        </div>

        {tableOk && budgets.length > 0 && (
          <GlassButton variant="teal" size="lg" full className="border-dashed" onClick={() => setForm({ budget: null, category: '' })}>+ Buat anggaran</GlassButton>
        )}

        {tableOk && usage.unbudgeted.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2 px-1 text-[color:var(--text-muted)]">Belum punya anggaran</p>
            <div className="glass rounded-3xl px-4 py-1">
              {usage.unbudgeted.slice(0, 6).map((u, i, arr) => (
                <div key={u.key} className={`flex items-center gap-2 py-2.5 ${i === arr.length - 1 ? '' : 'border-b border-black/[0.07] dark:border-white/10'}`}>
                  <p className="flex-1 min-w-0 text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>{u.label}</p>
                  <span className="text-sm font-bold shrink-0" style={{ color: 'var(--text-main)' }}>{formatRupiah(u.spent)}</span>
                  {u.key !== 'tanpa kategori' && <GlassButton variant="teal" size="sm" onClick={() => setForm({ budget: null, category: u.label })}>Atur</GlassButton>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {form && <BudgetForm key={form.budget?.id || form.category || 'new'} state={form} userId={userId} suggestions={suggestions} onClose={() => setForm(null)} onSaved={() => load(viewDate)} showDialog={showDialog} />}
      <BottomNav />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </div>
  );
}

function BudgetForm({ state, userId, suggestions, onClose, onSaved, showDialog }: {
  state: FormState;
  userId: string;
  suggestions: string[];
  onClose: () => void;
  onSaved: () => void;
  showDialog: (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;
}) {
  const editing = state.budget;
  const [category, setCategory] = useState(state.category);
  const initial = editing ? Math.round(Number(editing.monthly_limit)) : 0;
  const [raw, setRaw] = useState(initial);
  const [display, setDisplay] = useState(initial > 0 ? rupiahDisplay(initial) : '');
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cat = catLabel(category);
    if (!editing && !category.trim()) return showDialog('Data Belum Lengkap', 'Pilih atau isi nama kategorinya.', 'danger');
    if (raw <= 0) return showDialog('Batas Kosong', 'Isi batas pengeluaran per siklus.', 'danger');
    setBusy(true);
    const { error } = editing
      ? await supabase.from('budgets').update({ monthly_limit: raw }).eq('id', editing.id)
      : await supabase.from('budgets').insert({ user_id: userId, category: cat, monthly_limit: raw });
    setBusy(false);
    if (error) {
      const dup = /duplicate|unique/i.test(error.message);
      return showDialog(dup ? 'Sudah Ada' : 'Gagal', dup ? `Anggaran untuk ${cat} sudah ada. Ubah saja yang lama.` : error.message, 'danger');
    }
    onSaved();
    onClose();
  };

  return (
    <form onSubmit={save}>
      <Sheet
        title={editing ? 'Ubah Anggaran' : 'Buat Anggaran'}
        onClose={onClose}
        footer={<GlassButton type="submit" variant="primary" size="lg" full disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</GlassButton>}
      >
        <div>
          <label className={labelCls}>Kategori</label>
          {editing ? (
            <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{catLabel(editing.category)}</p>
          ) : (
            <>
              <input value={category} maxLength={30} onChange={(e) => setCategory(e.target.value)} placeholder="Cth: Makan, Hiburan, Transport" className={inputCls} />
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {suggestions.slice(0, 12).map((s) => <button type="button" key={s} onClick={() => setCategory(s)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold max-w-full truncate ${normCat(category) === normCat(s) ? chipOn : chipOff}`}>{s}</button>)}
                </div>
              )}
              <p className="text-[10px] mt-1.5 text-[color:var(--text-muted)]">Nama harus sama dengan kategori yang kamu pilih saat Catat supaya terhitung otomatis.</p>
            </>
          )}
        </div>
        <div>
          <label className={labelCls}>Batas per siklus (Rp)</label>
          <input inputMode="numeric" value={display} onChange={(e) => { const p = parseRupiahInput(e.target.value); setRaw(p.raw); setDisplay(p.display); }} placeholder="0" className={`${inputCls} font-bold`} />
          <p className="text-[10px] mt-1 text-[color:var(--text-muted)]">Siklus mengikuti tanggal gajian di Pengaturan.</p>
        </div>
      </Sheet>
    </form>
  );
}

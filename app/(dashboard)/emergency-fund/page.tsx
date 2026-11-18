'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, formatDateID, parseRupiahInput, toLocalDateStr } from '@/lib/utils';
import { cycleFor, normalizePayday, shiftCycle } from '@/lib/cycle';
import { avgMonthlyExpense, emergencyStatus, savingPlans } from '@/lib/finance';
import { useCatatAction } from '@/lib/catatAction';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SkeletonLoader from '@/components/SkeletonLoader';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
import DateField from '@/components/DateField';
import { ProgressBar, Sheet, SqlNotice, StatusBadge, chipOff, chipOn, inputCls, labelCls } from '@/components/FinUI';

interface Entry { id: string; type: 'in' | 'out'; amount: number | string; note: string | null; entry_date: string }
const MONTH_OPTIONS = [3, 6, 9, 12];

export default function EmergencyFundPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [tableOk, setTableOk] = useState(true);
  const [months, setMonths] = useState(6);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [avg, setAvg] = useState(0);
  const [monthsUsed, setMonthsUsed] = useState(0);
  const [entryType, setEntryType] = useState<'in' | 'out' | null>(null); // null = form tertutup

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const uid = session.user.id;
    setUserId(uid);

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    const saved = Number((prof as { emergency_months?: number } | null)?.emergency_months);
    setMonths(MONTH_OPTIONS.includes(saved) ? saved : 6);

    const { data: ent, error } = await supabase.from('emergency_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false });
    setTableOk(!error);
    setEntries((ent || []) as Entry[]);

    // Rata-rata pengeluaran dari 3 siklus gajian terakhir yang sudah selesai
    const payday = normalizePayday((prof as { payday?: unknown } | null)?.payday);
    const today = toLocalDateStr(new Date());
    const cur = cycleFor(today, payday);
    const c1 = shiftCycle(today, -1, payday);
    const c2 = shiftCycle(c1.start, -1, payday);
    const c3 = shiftCycle(c2.start, -1, payday);
    const { data: tx } = await supabase.from('transactions').select('amount,transaction_date').eq('type', 'expense').gte('transaction_date', c3.start).lte('transaction_date', cur.end);
    const rows = (tx || []) as { amount: number | string; transaction_date: string }[];
    const past = avgMonthlyExpense(rows, [c1, c2, c3]);
    if (past.monthsUsed > 0) { setAvg(past.avg); setMonthsUsed(past.monthsUsed); }
    else { // belum ada siklus selesai: pakai siklus berjalan sebagai perkiraan
      const now = avgMonthlyExpense(rows, [cur]);
      setAvg(now.avg); setMonthsUsed(0);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  useCatatAction('Dana', 'Setor dana darurat', () => setEntryType('in'));

  if (loading) return <div className="min-h-screen bg-[var(--page-bg)]"><SkeletonLoader /></div>;

  const saved = entries.reduce((s, e) => s + (e.type === 'in' ? 1 : -1) * (Number(e.amount) || 0), 0);
  const st = emergencyStatus(avg, months, saved);
  const plans = savingPlans(st.gap);
  const badge = st.target > 0 && saved >= st.target ? { tone: 'ok' as const, text: 'Aman' } : st.pct >= 50 ? { tone: 'ok' as const, text: 'Setengah jalan' } : { tone: 'warn' as const, text: 'Mulai nabung' };

  const pickMonths = async (m: number) => {
    setMonths(m);
    const { error } = await supabase.from('profiles').update({ emergency_months: m }).eq('id', userId);
    if (error) showDialog('Belum Tersimpan', 'Pilihan bulan hanya berlaku sementara karena kolomnya belum ada di database. Jalankan sql/08_fitur_keuangan.sql di Supabase.', 'info');
  };

  const deleteEntry = (e: Entry) => {
    showDialog('Hapus Catatan?', `${e.type === 'in' ? 'Setoran' : 'Penarikan'} ${formatRupiah(Number(e.amount))} akan dihapus dan saldo dana darurat dihitung ulang.`, 'danger', async () => {
      const { error } = await supabase.from('emergency_entries').delete().eq('id', e.id);
      if (error) showDialog('Gagal', error.message, 'danger');
      else load();
    });
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg)] pb-40 transition-colors">
      <AppHeader title="Dana Darurat" />

      <main className="max-w-md mx-auto px-4 mt-3 space-y-4">
        {!tableOk && <SqlNotice file="sql/08_fitur_keuangan.sql" />}

        <GlassCard>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[color:var(--text-muted)]">Dana darurat terkumpul</p>
              <p className="text-3xl font-extrabold tracking-tight mt-1" style={{ color: 'var(--text-main)' }}>{formatRupiah(saved)}</p>
            </div>
            {st.target > 0 && <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>}
          </div>
          {st.target > 0 ? (
            <>
              <div className="mt-4"><ProgressBar pct={st.pct} label="Progres dana darurat" /></div>
              <p className="text-[11px] mt-2 text-[color:var(--text-muted)]">{Math.round(st.pct)}% dari target {formatRupiah(st.target)}</p>
              <p className="text-sm font-bold mt-2" style={{ color: 'var(--text-main)' }}>Cukup untuk {st.covered.toLocaleString('id-ID', { maximumFractionDigits: 1 })} bulan pengeluaran</p>
              {st.gap > 0 && <p className="text-[11px] text-[color:var(--text-muted)]">Masih kurang {formatRupiah(st.gap)}</p>}
            </>
          ) : (
            <p className="text-xs mt-3 leading-relaxed text-[color:var(--text-muted)]">Target belum bisa dihitung karena belum ada pengeluaran tercatat. Catat pengeluaranmu dulu, lalu target muncul otomatis.</p>
          )}
          <div className="flex gap-2 mt-4">
            <GlassButton variant="primary" size="lg" className="flex-1" onClick={() => setEntryType('in')}>Setor</GlassButton>
            <GlassButton size="lg" className="flex-1" onClick={() => setEntryType('out')} disabled={saved <= 0}>Tarik</GlassButton>
          </div>
        </GlassCard>

        <GlassCard>
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-main)' }}>Target</p>
          <p className="text-[11px] leading-relaxed mb-3 text-[color:var(--text-muted)]">
            Rata-rata pengeluaranmu {avg > 0 ? <strong>{formatRupiah(avg)}</strong> : 'belum ada'} per siklus{monthsUsed > 0 ? ` (dari ${monthsUsed} siklus terakhir)` : avg > 0 ? ' (perkiraan dari siklus berjalan)' : ''}. Pilih mau cukup untuk berapa bulan:
          </p>
          <div className="flex gap-2">
            {MONTH_OPTIONS.map((m) => <button key={m} type="button" onClick={() => pickMonths(m)} className={`flex-1 py-2.5 rounded-full text-xs font-bold ${months === m ? chipOn : chipOff}`}>{m} bulan</button>)}
          </div>
          <p className="text-[10px] mt-2 text-[color:var(--text-muted)]">Patokan umum: 3 bulan untuk lajang, 6 bulan atau lebih kalau punya tanggungan.</p>
        </GlassCard>

        {st.target > 0 && (
          <GlassCard>
            <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-main)' }}>Rencana menabung</p>
            {st.gap > 0 ? (
              <div className="space-y-2">
                {plans.map((p) => (
                  <div key={p.months} className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>Selesai dalam {p.months} bulan</p>
                    <p className="text-[11px] text-right text-[color:var(--text-muted)]"><strong style={{ color: 'var(--text-main)' }}>{formatRupiah(p.perMonth)}</strong> / bulan<br />{formatRupiah(p.perWeek)} / minggu</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[color:var(--text-muted)]">Target {months} bulan sudah tercapai. Kamu punya bantalan yang kuat.</p>
            )}
          </GlassCard>
        )}

        {entries.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2 px-1 text-[color:var(--text-muted)]">Riwayat</p>
            <div className="glass rounded-3xl px-4 py-1">
              {entries.map((e, i) => (
                <div key={e.id} className={`flex items-center gap-2 py-2.5 ${i === entries.length - 1 ? '' : 'border-b border-black/[0.07] dark:border-white/10'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>{e.type === 'in' ? 'Setor' : 'Tarik'}{e.note ? ` · ${e.note}` : ''}</p>
                    <p className="text-[11px] text-[color:var(--text-muted)]">{formatDateID(e.entry_date)}</p>
                  </div>
                  <span className="text-sm font-bold shrink-0" style={{ color: 'var(--text-main)' }}>{e.type === 'in' ? '+' : '-'}{formatRupiah(Number(e.amount))}</span>
                  <button type="button" onClick={() => deleteEntry(e)} aria-label="Hapus catatan" className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:text-red-500 active:scale-90 transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {entryType && <EntryForm key={entryType} initialType={entryType} userId={userId} saved={saved} onClose={() => setEntryType(null)} onSaved={load} showDialog={showDialog} />}
      <BottomNav />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </div>
  );
}

function EntryForm({ initialType, userId, saved, onClose, onSaved, showDialog }: {
  initialType: 'in' | 'out';
  userId: string;
  saved: number;
  onClose: () => void;
  onSaved: () => void;
  showDialog: (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;
}) {
  const [type, setType] = useState<'in' | 'out'>(initialType);
  const [raw, setRaw] = useState(0);
  const [display, setDisplay] = useState('');
  const [date, setDate] = useState(toLocalDateStr(new Date()));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (raw <= 0) return showDialog('Nominal Kosong', 'Isi jumlahnya.', 'danger');
    if (!date) return showDialog('Data Belum Lengkap', 'Pilih tanggalnya.', 'danger');
    if (type === 'out' && raw > saved) return showDialog('Saldo Tidak Cukup', `Dana darurat yang terkumpul hanya ${formatRupiah(saved)}.`, 'danger');
    setBusy(true);
    const { error } = await supabase.from('emergency_entries').insert({ user_id: userId, type, amount: raw, note: note.trim() || null, entry_date: date });
    setBusy(false);
    if (error) return showDialog('Gagal', error.message, 'danger');
    onSaved();
    onClose();
  };

  return (
    <form onSubmit={save}>
      <Sheet
        title={type === 'in' ? 'Setor Dana Darurat' : 'Tarik Dana Darurat'}
        onClose={onClose}
        footer={<GlassButton type="submit" variant="primary" size="lg" full disabled={busy}>{busy ? 'Menyimpan...' : type === 'in' ? 'Simpan Setoran' : 'Simpan Penarikan'}</GlassButton>}
      >
        <div className="flex gap-2">
          <button type="button" onClick={() => setType('in')} className={`flex-1 py-2 rounded-full text-xs font-bold ${type === 'in' ? chipOn : chipOff}`}>Setor</button>
          <button type="button" onClick={() => setType('out')} className={`flex-1 py-2 rounded-full text-xs font-bold ${type === 'out' ? chipOn : chipOff}`}>Tarik</button>
        </div>
        <div>
          <label className={labelCls}>Jumlah (Rp)</label>
          <input inputMode="numeric" value={display} onChange={(e) => { const p = parseRupiahInput(e.target.value); setRaw(p.raw); setDisplay(p.display); }} placeholder="0" className={`${inputCls} font-bold`} />
        </div>
        <DateField label="Tanggal" value={date} onChange={setDate} />
        <div>
          <label className={labelCls}>Catatan (opsional)</label>
          <input value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} placeholder={type === 'in' ? 'Cth: sisa gaji bulan ini' : 'Cth: servis motor mendadak'} className={inputCls} />
        </div>
        <p className="text-[10px] text-[color:var(--text-muted)]">Dicatat di sini saja, tidak mengubah Uang Sisa di Home.</p>
      </Sheet>
    </form>
  );
}

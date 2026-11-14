'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Receipt, Edit3, Trash2, CheckCircle2, Info, ChevronDown, ChevronUp, ChevronRight, Repeat, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, formatDateID, parseRupiahInput, toLocalDateStr } from '@/lib/utils';
import { nextOccurrence, diffDays, dayOfMonth, FREQ_LABEL } from '@/lib/recurring';
import { listWallets, Wallet } from '@/lib/wallets';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SubTabs, { RIWAYAT_TABS } from '@/components/SubTabs';
import { Btn, HeaderBtn, RowActions, Toggle } from '@/components/ui';
import SkeletonLoader from '@/components/SkeletonLoader';
import DateField from '@/components/DateField';
import FrequencyPicker from '@/components/FrequencyPicker';
import WalletChips from '@/components/WalletChips';

const BILL_FREQ_OPTIONS = [
  { value: 'once', label: 'Sekali' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
];
const DEFAULT_CATEGORIES = ['🏠 Tagihan', '📌 Lainnya'];
const inputCls = 'w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500';

const INCOME_LIKE = /gaji|bonus|thr|pemasukan|income|dividen|bunga|salary|upah|honor/i;

export default function BillsPage() {
  const router = useRouter();
  const [bills, setBills] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [today, setToday] = useState('');
  const [showInfo, setShowInfo] = useState(true);

  // Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [amountRaw, setAmountRaw] = useState(0);
  const [category, setCategory] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [dueDate, setDueDate] = useState('');
  const [remindDays, setRemindDays] = useState(3);
  const [walletId, setWalletId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));
  // Dialog hasil setelah konfirmasi harus ditunda, kalau tidak langsung tertutup oleh CustomDialog
  const showLater = (title: string, msg: string, type: 'info' | 'success' | 'danger') => setTimeout(() => showDialog(title, msg, type), 80);

  const fetchAll = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');

    const { data, error } = await supabase.from('bills').select('*').order('due_date', { ascending: true });
    if (error) setMissingTable(true);
    else { setMissingTable(false); setBills(data || []); }

    const { data: presets } = await supabase.from('presets').select('*').order('created_at', { ascending: true });
    if (presets && presets.length > 0) {
      // Tagihan = pengeluaran, jadi kategori pemasukan (Gaji, Bonus, dst.) tidak ditampilkan
      const expenseOnly = presets.filter((p: any) => !INCOME_LIKE.test(String(p.label)));
      setCategories((expenseOnly.length > 0 ? expenseOnly : presets).map((p: any) => `${p.emoji} ${p.label}`));
    }

    setWallets(await listWallets(session.user.id, false));
    setLoading(false);
  };

  useEffect(() => {
    setToday(toLocalDateStr(new Date()));
    fetchAll();
  }, []);

  const defaultWalletId = () => wallets.find((w) => w.is_default)?.id || wallets[0]?.id || '';

  const openAdd = () => {
    setEditingId(null); setName(''); setAmountDisplay(''); setAmountRaw(0);
    setCategory(categories[0] || ''); setFrequency('monthly');
    setDueDate(toLocalDateStr(new Date())); setRemindDays(3); setWalletId(defaultWalletId()); setIsActive(true);
    setIsFormOpen(true);
  };

  const openEdit = (b: any) => {
    setEditingId(b.id); setName(b.name); setAmountRaw(Number(b.amount));
    setAmountDisplay(new Intl.NumberFormat('id-ID').format(b.amount));
    setCategory(b.merchant_name); setFrequency(b.frequency); setDueDate(b.due_date);
    setRemindDays(b.remind_days_before ?? 3); setWalletId(b.wallet_id || defaultWalletId()); setIsActive(b.is_active);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || amountRaw <= 0 || !category || !dueDate) {
      return showDialog('Data Belum Lengkap', 'Isi nama, nominal, kategori, dan tanggal jatuh tempo.', 'danger');
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }

    const payload: any = {
      name: name.trim(), amount: amountRaw, merchant_name: category, frequency,
      due_date: dueDate, anchor_day: dayOfMonth(dueDate), remind_days_before: remindDays, is_active: isActive,
      ...(walletId ? { wallet_id: walletId } : {}),
    };
    const { error } = editingId
      ? await supabase.from('bills').update(payload).eq('id', editingId)
      : await supabase.from('bills').insert({ ...payload, user_id: session.user.id });
    setSaving(false);
    if (error) return showDialog('Gagal', error.message, 'danger');
    setIsFormOpen(false);
    fetchAll();
  };

  const handleDelete = (b: any) => {
    showDialog('Hapus Tagihan?', `"${b.name}" akan dihapus. Transaksi yang sudah dicatat tidak ikut terhapus.`, 'danger', async () => {
      await supabase.from('bills').delete().eq('id', b.id);
      fetchAll();
    });
  };

  const handlePay = (b: any) => {
    showDialog('Tandai Lunas?', `Catat pembayaran "${b.name}" sebesar ${formatRupiah(b.amount)} sebagai pengeluaran hari ini.`, 'info', async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const payDate = toLocalDateStr(new Date());
      const wId = b.wallet_id || defaultWalletId();
      const { error } = await supabase.from('transactions').insert({
        user_id: session.user.id, merchant_name: b.merchant_name, amount: b.amount, type: 'expense',
        transaction_date: payDate, is_routine: false, is_ai_scanned: false, notes: b.name,
        ...(wId ? { wallet_id: wId } : {}),
      });
      if (error) return showLater('Gagal', error.message, 'danger');

      const patch = b.frequency === 'once'
        ? { is_active: false }
        : { due_date: nextOccurrence(b.due_date, b.frequency, b.anchor_day) };
      await supabase.from('bills').update({ ...patch, last_paid_date: payDate, paid_count: (b.paid_count || 0) + 1 }).eq('id', b.id);
      fetchAll();
      showLater('Berhasil', `"${b.name}" tercatat sebagai pengeluaran.`, 'success');
    });
  };

  if (loading || !today) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  const enriched = bills.map((b) => ({ ...b, daysLeft: diffDays(today, b.due_date) }));
  const active = enriched.filter((b) => b.is_active);
  const overdue = active.filter((b) => b.daysLeft < 0);
  const soon = active.filter((b) => b.daysLeft >= 0 && b.daysLeft <= (b.remind_days_before ?? 3));
  const later = active.filter((b) => b.daysLeft > (b.remind_days_before ?? 3));
  const paused = enriched.filter((b) => !b.is_active);
  const next30 = active.filter((b) => b.daysLeft <= 30).reduce((s, b) => s + Number(b.amount), 0);

  const renderBill = (b: any) => {
    const status = b.daysLeft < 0 ? { t: `Telat ${-b.daysLeft} hari`, c: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' }
      : b.daysLeft === 0 ? { t: 'Hari ini', c: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' }
      : b.daysLeft <= (b.remind_days_before ?? 3) ? { t: `H-${b.daysLeft}`, c: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' }
      : { t: `${b.daysLeft} hari lagi`, c: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' };
    return (
      <div key={b.id} className={`bg-white dark:bg-gray-800 p-4 rounded-3xl border shadow-sm transition-colors ${b.is_active && b.daysLeft < 0 ? 'border-red-100 dark:border-red-900/40' : 'border-gray-100 dark:border-gray-700'} ${b.is_active ? '' : 'opacity-60'}`}>
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="font-bold text-gray-800 dark:text-gray-100 truncate">{b.name}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{b.merchant_name} · {b.frequency === 'once' ? 'Sekali' : FREQ_LABEL[b.frequency as keyof typeof FREQ_LABEL]}</p>
          </div>
          <p className="font-bold text-red-500 shrink-0">{formatRupiah(b.amount)}</p>
        </div>
        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {b.is_active && <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${status.c}`}>{status.t}</span>}
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{b.is_active ? formatDateID(b.due_date) : 'Dijeda / selesai'}</span>
          </div>
          <RowActions onEdit={() => openEdit(b)} onDelete={() => handleDelete(b)} />
        </div>
        {b.is_active && (
          <Btn variant="success" size="md" full className="mt-3" onClick={() => handlePay(b)}><CheckCircle2 className="w-4 h-4" /> Tandai Lunas</Btn>
        )}
      </div>
    );
  };

  const Section = ({ title, list, tone }: { title: string; list: any[]; tone?: string }) =>
    list.length === 0 ? null : (
      <div className="space-y-3">
        <p className={`text-xs font-bold uppercase tracking-widest ${tone || 'text-gray-500 dark:text-gray-400'}`}>{title}</p>
        {list.map(renderBill)}
      </div>
    );

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-40 transition-colors">
      <AppHeader title="Tagihan" action={<HeaderBtn onClick={openAdd} label="Tambah" />} />

      <main className="px-5 mt-4 space-y-5">
        <SubTabs items={RIWAYAT_TABS} />

        {missingTable && <div className="bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-xs p-3 rounded-xl border border-red-100 dark:border-red-800">Tabel bills belum ada. Jalankan 01_fitur_baru.sql di Supabase.</div>}

        <div className="rounded-3xl p-6 text-white shadow-lg bg-teal-700">
          <p className="text-white/80 text-xs font-medium mb-1">Tagihan 30 hari ke depan</p>
          <h3 className="text-3xl font-extrabold mb-3">{formatRupiah(next30)}</h3>
          <div className="flex gap-6 text-sm">
            <div><p className="text-white/80 text-[10px] uppercase font-bold">Telat</p><p className={`font-bold ${overdue.length > 0 ? 'text-red-300' : 'text-green-300'}`}>{overdue.length} tagihan</p></div>
            <div><p className="text-white/80 text-[10px] uppercase font-bold">Segera</p><p className="font-bold text-yellow-200">{soon.length} tagihan</p></div>
            <div><p className="text-white/80 text-[10px] uppercase font-bold">Aktif</p><p className="font-bold">{active.length} tagihan</p></div>
          </div>
        </div>

        <Section title="Terlambat" list={overdue} tone="text-red-500" />
        <Section title="Segera Jatuh Tempo" list={soon} tone="text-yellow-600 dark:text-yellow-400" />
        <Section title="Mendatang" list={later} />
        <Section title="Dijeda / Selesai" list={paused} />

        {bills.length === 0 && !missingTable && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
            <Receipt className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 dark:text-gray-500 text-sm">Belum ada tagihan. Tambahkan listrik, internet, atau langganan kamu.</p>
          </div>
        )}
      </main>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsFormOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">{editingId ? 'Edit Tagihan' : 'Tambah Tagihan'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Tagihan</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cth: Listrik PLN, Netflix" required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nominal</label>
                <input type="text" inputMode="numeric" value={amountDisplay} onChange={(e) => { const p = parseRupiahInput(e.target.value); setAmountRaw(p.raw); setAmountDisplay(p.display); }} required placeholder="Nominal (Rp)" className={`${inputCls} font-bold`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Kategori saat dibayar</label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <button key={c} type="button" onClick={() => setCategory(c)} className={`px-2 py-1 rounded-lg text-xs font-medium transition-all border ${category === c ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 text-teal-700 dark:text-teal-400' : 'bg-gray-50 dark:bg-gray-700 border-transparent text-gray-600 dark:text-gray-300'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Berulang</label>
                <FrequencyPicker value={frequency} onChange={setFrequency} options={BILL_FREQ_OPTIONS} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DateField label="Jatuh tempo" required value={dueDate} onChange={setDueDate} />
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ingatkan</label>
                  <select value={remindDays} onChange={(e) => setRemindDays(Number(e.target.value))} className={`${inputCls} !h-11 !py-0`}>
                    <option value={0}>Hari H</option><option value={1}>H-1</option><option value={3}>H-3</option><option value={7}>H-7</option>
                  </select>
                </div>
              </div>
              <WalletChips wallets={wallets} value={walletId} onChange={setWalletId} />
              {editingId && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Tagihan aktif</span>
                  <Toggle checked={isActive} onChange={setIsActive} label="Tagihan aktif" />
                </div>
              )}
              <button type="submit" disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl mt-2 transition-all disabled:opacity-50">{saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Tagihan'}</button>
            </form>
          </div>
        </div>
      )}

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}

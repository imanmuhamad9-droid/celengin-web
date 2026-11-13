'use client';
import { useEffect, useState } from 'react';
import { XCircle, Trash2, Repeat, Edit3, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, formatDateID, toLocalDateStr } from '@/lib/utils';
import { Frequency, describeFrequency, firstRunAfter, dayOfMonth } from '@/lib/recurring';
import { createRecurringRule } from '@/lib/recurringClient';
import FrequencyPicker from '@/components/FrequencyPicker';
import DateField from '@/components/DateField';

type ShowDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;

// Jadwal tercatat berikutnya kalau aturan memakai tanggal `date`. Tanggal yang sudah lewat tidak disusulkan.
function computeNext(date: string, freq: Frequency, today: string): string {
  if (!date) return '';
  return date > today ? date : firstRunAfter(date, freq, dayOfMonth(date), today);
}

export default function RecurringRulesModal({ isOpen, onClose, showDialog, legacyTx, onChanged }: {
  isOpen: boolean;
  onClose: () => void;
  showDialog: ShowDialog;
  legacyTx?: any[];           // opsional: kalau kosong, transaksi rutin lama diambil sendiri oleh modal ini
  onChanged?: () => void;
}) {
  const [rules, setRules] = useState<any[]>([]);
  const [ownLegacy, setOwnLegacy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [legacyFreq, setLegacyFreq] = useState<Record<string, Frequency>>({});

  // Form ubah aturan
  const [editing, setEditing] = useState<any | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editFreq, setEditFreq] = useState<Frequency>('monthly');
  const [editAmountDisplay, setEditAmountDisplay] = useState('');
  const [editAmountRaw, setEditAmountRaw] = useState(0);
  const [saving, setSaving] = useState(false);

  const changed = () => { if (onChanged) onChanged(); };

  const fetchRules = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('recurring_rules').select('*').order('created_at', { ascending: false });
    if (error) setMissingTable(true);
    else { setMissingTable(false); setRules(data || []); }
    if (!legacyTx) {
      const { data: tx } = await supabase.from('transactions').select('*').eq('is_routine', true).is('recurring_rule_id', null);
      setOwnLegacy(tx || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) { setEditing(null); fetchRules(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleActive = async (rule: any) => {
    const patch: any = { is_active: !rule.is_active };
    if (!rule.is_active) {
      // Diaktifkan lagi setelah dijeda: mulai dari jadwal berikutnya, tanpa menyusulkan yang terlewat
      patch.next_run_date = firstRunAfter(rule.last_run_date || rule.start_date, rule.frequency, rule.anchor_day, toLocalDateStr(new Date()));
    }
    await supabase.from('recurring_rules').update(patch).eq('id', rule.id);
    fetchRules(); changed();
  };

  const deleteRule = (rule: any) => {
    showDialog('Hapus Aturan Rutin?', 'Transaksi yang sudah tercatat tidak ikut terhapus. Hanya pencatatan otomatisnya yang berhenti.', 'danger', async () => {
      await supabase.from('recurring_rules').delete().eq('id', rule.id);
      fetchRules(); changed();
    });
  };

  const startEdit = (rule: any) => {
    setEditing(rule);
    setEditDate(rule.is_active ? rule.next_run_date : rule.start_date);
    setEditFreq(rule.frequency);
    const amt = Number(rule.amount) || 0;
    setEditAmountRaw(amt);
    setEditAmountDisplay(amt ? new Intl.NumberFormat('id-ID').format(amt) : '');
  };

  const handleEditAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setEditAmountRaw(Number(raw || 0));
    setEditAmountDisplay(raw ? new Intl.NumberFormat('id-ID').format(Number(raw)) : '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editDate) return showDialog('Tanggal Kosong', 'Pilih tanggal rutinnya dulu.', 'danger');
    if (editAmountRaw <= 0) return showDialog('Nominal Kosong', 'Isi nominalnya dulu.', 'danger');
    setSaving(true);
    const today = toLocalDateStr(new Date());
    const { error } = await supabase.from('recurring_rules').update({
      amount: editAmountRaw,
      frequency: editFreq,
      start_date: editDate,
      anchor_day: dayOfMonth(editDate),
      next_run_date: computeNext(editDate, editFreq, today),
    }).eq('id', editing.id);
    setSaving(false);
    if (error) return showDialog('Gagal Menyimpan', error.message, 'danger');
    setEditing(null);
    fetchRules(); changed();
  };

  // Kelompokkan transaksi rutin lama (kategori + tipe + nominal sama), kecuali yang sudah jadi aturan
  const groups: Record<string, any> = {};
  (legacyTx ?? ownLegacy).forEach((t) => {
    if (t.recurring_rule_id) return;
    const key = `${t.merchant_name}|${t.type}|${t.amount}`;
    if (!groups[key] || t.transaction_date > groups[key].transaction_date) groups[key] = t;
  });
  const legacyList = Object.entries(groups).filter(([, t]) =>
    !rules.some((r) => r.merchant_name === t.merchant_name && r.type === t.type && Number(r.amount) === Number(t.amount))
  );

  const activateLegacy = async (key: string, t: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const id = await createRecurringRule({
      userId: session.user.id, merchantName: t.merchant_name, amount: Number(t.amount), type: t.type,
      frequency: legacyFreq[key] || 'monthly', startDate: t.transaction_date, walletId: t.wallet_id,
    });
    if (!id) return showDialog('Gagal', 'Aturan rutin gagal dibuat. Pastikan SQL 01_fitur_baru.sql sudah dijalankan.', 'danger');
    fetchRules(); changed();
  };

  const previewNext = editing ? computeNext(editDate, editFreq, toLocalDateStr(new Date())) : '';

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative max-h-[80vh] flex flex-col transition-colors">
        <button onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><XCircle className="w-5 h-5" /></button>

        {editing ? (
          <>
            <button onClick={() => setEditing(null)} className="absolute top-4 left-4 flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400"><ArrowLeft className="w-4 h-4" /> Kembali</button>
            <h2 className="text-lg font-bold text-center mb-1 text-gray-800 dark:text-white mt-5">Ubah Jadwal Rutin</h2>
            <p className="text-sm font-bold text-center text-gray-700 dark:text-gray-200 truncate">{editing.merchant_name}</p>
            <p className={`text-xs font-bold text-center mb-4 ${editing.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>{editing.type === 'income' ? 'Uang masuk' : 'Uang keluar'}</p>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nominal</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 font-bold text-sm">Rp</span>
                  <input type="text" inputMode="numeric" value={editAmountDisplay} onChange={handleEditAmount} placeholder="0" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 text-sm font-bold" />
                </div>
              </div>

              <DateField label="Tanggal rutin" value={editDate} onChange={setEditDate} />

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Diulang</label>
                <FrequencyPicker value={editFreq} onChange={(v) => setEditFreq(v)} />
              </div>

              {previewNext && (
                <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-xl px-3 py-2">
                  Dicatat otomatis berikutnya: {formatDateID(previewNext)}
                </p>
              )}
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Transaksi yang sudah tercatat tidak berubah. Tanggal di masa lalu tidak disusulkan; jadwal langsung lompat ke berikutnya.</p>
            </div>

            <button onClick={saveEdit} disabled={saving} className="w-full mt-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all">
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-center mb-1 text-gray-800 dark:text-white">Transaksi Rutin</h2>
            <p className="text-[10px] text-center text-gray-500 dark:text-gray-400 mb-4">Tercatat otomatis sesuai jadwal, tanpa kamu input lagi. Buat lewat tombol Catat lalu aktifkan &quot;Rutin&quot;.</p>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {missingTable && <p className="text-center text-xs text-red-500 py-4">Tabel recurring_rules belum ada. Jalankan 01_fitur_baru.sql di Supabase.</p>}
              {!missingTable && loading && <p className="text-center text-xs text-gray-400 py-4">Memuat...</p>}
              {!missingTable && !loading && rules.length === 0 && legacyList.length === 0 && (
                <div className="text-center py-6">
                  <Repeat className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Belum ada transaksi rutin.</p>
                </div>
              )}

              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{rule.merchant_name}</p>
                    <p className={`text-xs font-bold mt-0.5 ${rule.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>{rule.type === 'income' ? '+' : '-'}{formatRupiah(rule.amount)}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{describeFrequency(rule)}</p>
                    <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">{rule.is_active ? `Berikutnya: ${formatDateID(rule.next_run_date)}` : 'Dijeda'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActive(rule)} aria-label={rule.is_active ? 'Jeda' : 'Aktifkan'} className={`w-12 h-6 rounded-full transition-colors relative ${rule.is_active ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${rule.is_active ? 'left-7' : 'left-1'}`}></div>
                    </button>
                    <button onClick={() => startEdit(rule)} aria-label="Ubah jadwal" className="text-gray-300 dark:text-gray-500 hover:text-teal-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => deleteRule(rule)} aria-label="Hapus" className="text-gray-300 dark:text-gray-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}

              {legacyList.length > 0 && (
                <div className="pt-2">
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Rutin lama (belum otomatis)</p>
                  <div className="space-y-2">
                    {legacyList.map(([key, t]) => (
                      <div key={key} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-800">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate pr-2">{t.merchant_name}</p>
                          <p className={`text-xs font-bold shrink-0 ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>{t.type === 'income' ? '+' : '-'}{formatRupiah(t.amount)}</p>
                        </div>
                        <FrequencyPicker value={legacyFreq[key] || 'monthly'} onChange={(v) => setLegacyFreq((p) => ({ ...p, [key]: v }))} />
                        <button onClick={() => activateLegacy(key, t)} className="w-full mt-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2 rounded-lg transition-all">Jadikan Otomatis</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

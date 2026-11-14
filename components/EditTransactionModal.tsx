'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import DateField from '@/components/DateField';
import { Toggle } from '@/components/ui';
import { X, ArrowDownCircle, ArrowUpCircle, Check, Repeat } from 'lucide-react';
import { formatDateID } from '@/lib/utils';
import { Frequency, describeFrequency } from '@/lib/recurring';
import { createRecurringRule } from '@/lib/recurringClient';
import { listWallets, Wallet } from '@/lib/wallets';
import FrequencyPicker from '@/components/FrequencyPicker';
import WalletChips from '@/components/WalletChips';

export default function EditTransactionModal({ isOpen, onClose, onSuccess, showDialog, txData }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, showDialog: (title: string, msg: string, type: 'info'|'success'|'danger', onConfirm?: () => void) => void, txData: any }) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [amountRaw, setAmountRaw] = useState(0);
  const [preset, setPreset] = useState('');
  const [date, setDate] = useState('');
  const [isRoutine, setIsRoutine] = useState(false);
  const [loading, setLoading] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [rule, setRule] = useState<any>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState('');
  const [notes, setNotes] = useState('');

  // State untuk Presets
  const [presets, setPresets] = useState<any[]>([]);

  const fetchPresets = async () => {
    const { data } = await supabase.from('presets').select('*').order('created_at', { ascending: true });
    if (data) setPresets(data);
  };

  useEffect(() => {
    if (isOpen && txData) {
      setType(txData.type);
      setAmountRaw(txData.amount);
      setAmountDisplay(new Intl.NumberFormat('id-ID').format(txData.amount));
      setPreset(txData.merchant_name);
      setDate(txData.transaction_date);
      setIsRoutine(txData.is_routine);
      setNotes(txData.notes || '');
      setFrequency('monthly');
      setRule(null);
      fetchPresets();
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const list = await listWallets(session.user.id, false);
        setWallets(list);
        setWalletId(txData.wallet_id || list.find(w => w.is_default)?.id || list[0]?.id || '');
        if (txData.recurring_rule_id) {
          const { data } = await supabase.from('recurring_rules').select('*').eq('id', txData.recurring_rule_id).maybeSingle();
          if (data) setRule(data);
        }
      })();
    }
  }, [isOpen, txData]);

  if (!isOpen || !txData) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) { setAmountDisplay(''); setAmountRaw(0); return; }
    setAmountRaw(Number(rawValue));
    setAmountDisplay(new Intl.NumberFormat('id-ID').format(Number(rawValue)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountRaw <= 0) return showDialog('Gagal', 'Nominal harus lebih dari 0.', 'danger');
    if (!preset) return showDialog('Gagal', 'Kategori harus dipilih.', 'danger');

    setLoading(true);
    try {
      // Sinkronkan aturan rutin otomatis
      let ruleId: string | null = null;
      if (isRoutine) {
        if (rule) {
          await supabase.from('recurring_rules').update({
            amount: amountRaw, merchant_name: preset, type: type,
            ...(walletId ? { wallet_id: walletId } : {})
          }).eq('id', rule.id);
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            ruleId = await createRecurringRule({
              userId: session.user.id, merchantName: preset, amount: amountRaw, type: type,
              frequency: frequency, startDate: date, walletId: walletId || null
            });
          }
        }
      } else if (rule) {
        await supabase.from('recurring_rules').update({ is_active: false }).eq('id', rule.id);
      }

      const { error } = await supabase.from('transactions').update({
        type: type,
        amount: amountRaw,
        merchant_name: preset,
        transaction_date: date,
        is_routine: isRoutine,
        notes: notes.trim() || null,
        ...(ruleId ? { recurring_rule_id: ruleId } : {}),
        ...(walletId ? { wallet_id: walletId } : {})
      }).eq('id', txData.id);

      if (error) {
        if (ruleId) await supabase.from('recurring_rules').delete().eq('id', ruleId);
        throw error;
      }
      
      showDialog('Berhasil', 'Transaksi berhasil diperbarui!', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showDialog('Gagal', error.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative max-h-[90vh] overflow-y-auto transition-colors">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 text-center">Edit Transaksi</h2>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Tipe */}
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-2 transition-all ${type === 'expense' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>
              <ArrowUpCircle className="w-4 h-4" /> Keluar
            </button>
            <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-2 transition-all ${type === 'income' ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>
              <ArrowDownCircle className="w-4 h-4" /> Masuk
            </button>
          </div>

          {/* Nominal */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nominal (Rp)</label>
            <input type="text" inputMode="numeric" value={amountDisplay} onChange={handleAmountChange} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm font-bold focus:ring-2 focus:ring-teal-500" />
          </div>

          {/* Kategori (Tombol Preset) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Pilih Kategori</label>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button 
                  key={p.id} 
                  type="button" 
                  onClick={() => setPreset(`${p.emoji} ${p.label}`)} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-2 flex items-center gap-1 ${preset === `${p.emoji} ${p.label}` ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 text-teal-700 dark:text-teal-400' : 'bg-gray-50 dark:bg-gray-700 border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                >
                  {p.emoji} {p.label}
                  {preset === `${p.emoji} ${p.label}` && <Check className="w-3 h-3 ml-1" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan (opsional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="Cth: beli pulsa buat ibu" className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-teal-500" />
          </div>

          <WalletChips wallets={wallets} value={walletId} onChange={setWalletId} />

          {/* Tanggal & Rutin */}
          <div className="flex gap-2 items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <DateField label="Tanggal" compact required value={date} onChange={setDate} className="w-[55%]" />
            
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">Rutin</span>
              <Toggle checked={isRoutine} onChange={setIsRoutine} label="Transaksi rutin" onText="Ya" offText="Tidak" />
            </div>
          </div>

          {isRoutine && rule && (
            <div className="p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-xl flex items-start gap-2">
              <Repeat className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-teal-700 dark:text-teal-400">{describeFrequency(rule)}</p>
                <p className="text-[10px] text-teal-700/70 dark:text-teal-400/70">{rule.is_active ? `Tercatat otomatis, berikutnya ${formatDateID(rule.next_run_date)}` : 'Aturan sedang dijeda. Aktifkan di Riwayat → Transaksi Rutin.'}</p>
              </div>
            </div>
          )}
          {isRoutine && !rule && (
            <div className="p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-xl">
              <p className="text-[10px] font-bold text-teal-700 dark:text-teal-400 mb-2">Tercatat otomatis, ulangi:</p>
              <FrequencyPicker value={frequency} onChange={setFrequency} />
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all mt-4 disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>
    </div>
  );
}
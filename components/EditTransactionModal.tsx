'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function EditTransactionModal({ isOpen, onClose, onSuccess, showDialog, txData }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, showDialog: (title: string, msg: string, type: 'info'|'success'|'danger', onConfirm?: () => void) => void, txData: any }) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [amountRaw, setAmountRaw] = useState(0);
  const [preset, setPreset] = useState('');
  const [date, setDate] = useState('');
  const [isRoutine, setIsRoutine] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && txData) {
      setType(txData.type);
      setAmountRaw(txData.amount);
      setAmountDisplay(new Intl.NumberFormat('id-ID').format(txData.amount));
      setPreset(txData.merchant_name);
      setDate(txData.transaction_date);
      setIsRoutine(txData.is_routine);
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

    setLoading(true);
    try {
      const { error } = await supabase.from('transactions').update({
        type: type,
        amount: amountRaw,
        merchant_name: preset,
        transaction_date: date,
        is_routine: isRoutine
      }).eq('id', txData.id);

      if (error) throw error;
      
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
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 text-center">Edit Transaksi</h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-2 transition-all ${type === 'expense' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>
              <ArrowUpCircle className="w-4 h-4" /> Keluar
            </button>
            <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-2 transition-all ${type === 'income' ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>
              <ArrowDownCircle className="w-4 h-4" /> Masuk
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nominal (Rp)</label>
            {/* POIN 3: Input nominal diubah jadi hitam (text-gray-900) */}
            <input type="text" inputMode="numeric" value={amountDisplay} onChange={handleAmountChange} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm font-bold focus:ring-2 focus:ring-teal-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori / Keterangan</label>
            <input type="text" value={preset} onChange={(e) => setPreset(e.target.value)} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-teal-500" />
          </div>

          {/* POIN 2: Layout Tanggal & Rutin diubah jadi seperti Catat Transaksi */}
          <div className="flex gap-2 items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="w-[55%]">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-[11px] transition-colors focus:ring-2 focus:ring-teal-500" />
            </div>
            
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">Rutin</span>
              <button type="button" onClick={() => setIsRoutine(!isRoutine)} className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${isRoutine ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${isRoutine ? 'left-4.5' : 'left-0.5'}`}></div>
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all mt-4 disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>
    </div>
  );
}
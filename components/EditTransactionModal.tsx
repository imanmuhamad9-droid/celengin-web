'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, ArrowDownCircle, ArrowUpCircle, Plus, Check } from 'lucide-react';

export default function EditTransactionModal({ isOpen, onClose, onSuccess, showDialog, txData }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, showDialog: (title: string, msg: string, type: 'info'|'success'|'danger') => void, txData: any }) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [amountRaw, setAmountRaw] = useState(0);
  const [preset, setPreset] = useState('');
  const [date, setDate] = useState('');
  const [isRoutine, setIsRoutine] = useState(false);
  const [loading, setLoading] = useState(false);

  // State Preset
  const [presets, setPresets] = useState<any[]>([]);
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetEmoji, setNewPresetEmoji] = useState('🍔');

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
      setShowAddPreset(false);
      fetchPresets();
    }
  }, [isOpen, txData]);

  if (!isOpen || !txData) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) { setAmountDisplay(''); setAmountRaw(0); return; }
    setAmountRaw(Number(rawValue));
    setAmountDisplay(new Intl.NumberFormat('id-ID').format(Number(rawValue)));
  };

  const addPreset = async () => {
    if (!newPresetLabel) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // Simpan ke database
    const { error } = await supabase.from('presets').insert({ user_id: session.user.id, label: newPresetLabel, emoji: newPresetEmoji });
    
    if (!error) {
      setNewPresetLabel(''); setNewPresetEmoji('🍔'); setShowAddPreset(false); fetchPresets();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountRaw <= 0) return showDialog('Gagal', 'Nominal harus lebih dari 0.', 'danger');
    if (!preset) return showDialog('Gagal', 'Kategori harus dipilih.', 'danger');

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
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">Edit Transaksi</h2>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Tipe */}
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-2 transition-all ${type === 'expense' ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-100 text-gray-400'}`}>
              <ArrowUpCircle className="w-4 h-4" /> Keluar
            </button>
            <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-2 transition-all ${type === 'income' ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-100 text-gray-400'}`}>
              <ArrowDownCircle className="w-4 h-4" /> Masuk
            </button>
          </div>

          {/* Nominal */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nominal (Rp)</label>
            <input type="text" inputMode="numeric" value={amountDisplay} onChange={handleAmountChange} required className="w-full p-3 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-teal-500" />
          </div>

          {/* Kategori (Tombol Preset) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Pilih Kategori</label>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button 
                  key={p.id} 
                  type="button" 
                  onClick={() => setPreset(`${p.emoji} ${p.label}`)} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-2 flex items-center gap-1 ${preset === `${p.emoji} ${p.label}` ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100'}`}
                >
                  {p.emoji} {p.label}
                  {preset === `${p.emoji} ${p.label}` && <Check className="w-3 h-3 ml-1" />}
                </button>
              ))}
              <button 
                type="button" 
                onClick={() => setShowAddPreset(!showAddPreset)} 
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border-2 border-dashed border-gray-300 text-gray-500 hover:border-teal-500 hover:text-teal-600 transition-all flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {showAddPreset && (
              <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 mt-2 flex gap-2">
                <input type="text" value={newPresetEmoji} onChange={(e) => setNewPresetEmoji(e.target.value)} className="w-10 text-center border rounded-lg text-sm" placeholder="🍔" />
                <input type="text" value={newPresetLabel} onChange={(e) => setNewPresetLabel(e.target.value)} className="flex-1 border rounded-lg px-3 text-sm" placeholder="Nama kategori..." />
                <button type="button" onClick={addPreset} className="bg-teal-600 text-white px-3 rounded-lg text-xs font-bold">Simpan</button>
              </div>
            )}
          </div>

          {/* Tanggal & Rutin */}
          <div className="flex gap-2 items-end pt-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500" />
            </div>
            <button type="button" onClick={() => setIsRoutine(!isRoutine)} className={`px-3 py-3 rounded-xl font-bold text-xs border-2 transition-all flex items-center gap-1 h-[46px] ${isRoutine ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500'}`}>
              <div className={`w-3 h-3 rounded-full border-2 ${isRoutine ? 'bg-teal-500 border-teal-500' : 'border-gray-400'}`}></div> Rutin
            </button>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all mt-2 disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>
    </div>
  );
}
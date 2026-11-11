'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, ArrowDownCircle, ArrowUpCircle, Plus, Trash2, Settings2, Edit3, Check } from 'lucide-react';

export default function TransactionModal({ isOpen, onClose, onSuccess, showDialog, initialType }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, showDialog: (title: string, msg: string, type: 'info'|'success'|'danger') => void, initialType?: 'income' | 'expense' }) {
  
  const [txList, setTxList] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // State Modal Kelola Kategori
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetEmoji, setNewPresetEmoji] = useState('🍔');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  const createEmptyRow = () => ({
    id: Date.now().toString() + Math.random().toString(),
    type: initialType || 'expense',
    amountDisplay: '',
    amountRaw: 0,
    selectedPreset: '',
    date: new Date().toISOString().split('T')[0],
    isRoutine: false
  });

  const fetchPresets = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    let { data } = await supabase.from('presets').select('*').order('created_at', { ascending: true });
    
    if (!data || data.length === 0) {
      const defaultPresets = [
        { user_id: session.user.id, label: 'Gaji', emoji: '💵' },
        { user_id: session.user.id, label: 'Makan', emoji: '🍛' },
        { user_id: session.user.id, label: 'Kopi', emoji: '☕' },
        { user_id: session.user.id, label: 'Bensin', emoji: '⛽' },
        { user_id: session.user.id, label: 'Belanja', emoji: '🛍️' },
        { user_id: session.user.id, label: 'Lainnya', emoji: '📌' },
      ];
      await supabase.from('presets').insert(defaultPresets);
      const res = await supabase.from('presets').select('*').order('created_at', { ascending: true });
      data = res.data;
    }
    if (data) setPresets(data);
  };

  useEffect(() => {
    if (isOpen) {
      fetchPresets();
      setTxList([createEmptyRow()]);
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const updateRow = (id: string, field: string, value: any) => {
    setTxList(prev => prev.map(tx => tx.id === id ? { ...tx, [field]: value } : tx));
  };

  const handleAmountChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const formatted = rawValue ? new Intl.NumberFormat('id-ID').format(Number(rawValue)) : '';
    setTxList(prev => prev.map(tx => tx.id === id ? { ...tx, amountRaw: Number(rawValue || 0), amountDisplay: formatted } : tx));
  };

  const addRow = () => { setTxList(prev => [...prev, createEmptyRow()]); };
  const removeRow = (id: string) => { if (txList.length === 1) return; setTxList(prev => prev.filter(tx => tx.id !== id)); };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const isInvalid = txList.some(tx => tx.amountRaw <= 0 || !tx.selectedPreset);
    if (isInvalid) return showDialog('Data Belum Lengkap', 'Pastikan semua baris memiliki nominal dan kategori.', 'danger');

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const payloads = txList.map(tx => ({
        user_id: session.user.id,
        merchant_name: tx.selectedPreset,
        amount: tx.amountRaw,
        type: tx.type,
        transaction_date: tx.date,
        is_routine: tx.isRoutine,
        is_ai_scanned: false
      }));

      const { error } = await supabase.from('transactions').insert(payloads);
      if (error) throw error;
      
      showDialog('Berhasil', `${txList.length} transaksi berhasil disimpan!`, 'success');
      onSuccess(); onClose();   
    } catch (error: any) {
      showDialog('Gagal', error.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // --- FUNGSI KELOLA KATEGORI ---
  const handleSavePreset = async () => {
    if (!newPresetLabel) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (editingPresetId) {
      // Mode Edit
      await supabase.from('presets').update({ label: newPresetLabel, emoji: newPresetEmoji }).eq('id', editingPresetId);
      showDialog('Berhasil', 'Kategori diperbarui!', 'success');
    } else {
      // Mode Tambah
      await supabase.from('presets').insert({ user_id: session.user.id, label: newPresetLabel, emoji: newPresetEmoji });
      showDialog('Berhasil', 'Kategori ditambahkan!', 'success');
    }
    
    setNewPresetLabel(''); setNewPresetEmoji('🍔'); setEditingPresetId(null);
    fetchPresets();
  };

  const handleEditPreset = (preset: any) => {
    setEditingPresetId(preset.id);
    setNewPresetLabel(preset.label);
    setNewPresetEmoji(preset.emoji);
  };

    const handleDeletePreset = async (id: string) => {
    // Konfirmasi menggunakan bawaan browser (karena showDialog kita hanya 3 parameter)
    if (confirm('Yakin ingin menghapus kategori ini?')) {
      await supabase.from('presets').delete().eq('id', id);
      fetchPresets();
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md relative max-h-[90vh] flex flex-col overflow-hidden transition-colors">
          
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 z-10 transition-colors">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Catat Transaksi</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-4 overflow-y-auto space-y-4 flex-1 bg-gray-50 dark:bg-gray-900 transition-colors">
            
            <div className="flex justify-end">
              {/* Tombol Buka Modal Kelola Kategori */}
              <button onClick={() => setIsPresetModalOpen(true)} className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1 bg-teal-50 dark:bg-teal-900/30 px-3 py-1.5 rounded-lg border border-teal-100 dark:border-teal-800 transition-all">
                <Settings2 className="w-3.5 h-3.5" /> Kelola Kategori
              </button>
            </div>

            {txList.map((tx, index) => (
              <div key={tx.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm relative transition-colors">
                {txList.length > 1 && (
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Transaksi {index + 1}</span>
                    <button type="button" onClick={() => removeRow(tx.id)} className="text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-900/30 p-1.5 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <button type="button" onClick={() => updateRow(tx.id, 'type', 'expense')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-2 transition-all ${tx.type === 'expense' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>
                    <ArrowUpCircle className="w-4 h-4" /> Keluar
                  </button>
                  <button type="button" onClick={() => updateRow(tx.id, 'type', 'income')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-2 transition-all ${tx.type === 'income' ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>
                    <ArrowDownCircle className="w-4 h-4" /> Masuk
                  </button>
                </div>

                <div className="relative mb-3">
                  <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 font-bold text-sm">Rp</span>
                  <input type="text" inputMode="numeric" value={tx.amountDisplay} onChange={(e) => handleAmountChange(tx.id, e)} placeholder="0" className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 text-sm font-bold transition-colors" required />
                </div>

                <div className="mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map(p => (
                      <button key={p.id} type="button" onClick={() => updateRow(tx.id, 'selectedPreset', `${p.emoji} ${p.label}`)} className={`px-2 py-1 rounded-lg text-xs font-medium transition-all border ${tx.selectedPreset === `${p.emoji} ${p.label}` ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 text-teal-700 dark:text-teal-400' : 'bg-gray-50 dark:bg-gray-700 border-transparent text-gray-600 dark:text-gray-300'}`}>
                        {p.emoji} {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <input type="date" value={tx.date} onChange={(e) => updateRow(tx.id, 'date', e.target.value)} className="w-[55%] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-[11px] transition-colors" required />
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">Rutin</span>
                    <button type="button" onClick={() => updateRow(tx.id, 'isRoutine', !tx.isRoutine)} className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${tx.isRoutine ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${tx.isRoutine ? 'left-4.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button type="button" onClick={addRow} className="w-full py-3 border-2 border-dashed border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-teal-50 dark:hover:bg-gray-800 transition-all text-sm bg-white dark:bg-gray-800">
              <Plus className="w-4 h-4" /> Tambah Transaksi Lain
            </button>
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors">
            <button onClick={handleSaveAll} disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 shadow-md">
              {loading ? 'Menyimpan...' : `Simpan ${txList.length} Transaksi`}
            </button>
          </div>

        </div>
      </div>

      {/* --- MODAL KELOLA KATEGORI (POPUP BARU) --- */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors max-h-[80vh] flex flex-col">
            <button onClick={() => setIsPresetModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 text-center">Kelola Kategori</h2>
            
                        {/* Form Input/Edit */}
            <div className="flex items-center gap-2 mb-4 bg-gray-50 dark:bg-gray-700 p-2.5 rounded-xl border border-gray-100 dark:border-gray-600">
              <input 
                type="text" 
                value={newPresetEmoji} 
                onChange={(e) => setNewPresetEmoji(e.target.value)} 
                className="w-12 h-11 text-center border border-gray-300 dark:border-gray-500 rounded-lg text-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all" 
                placeholder="🍔" 
              />
              <input 
                type="text" 
                value={newPresetLabel} 
                onChange={(e) => setNewPresetLabel(e.target.value)} 
                className="flex-1 h-11 border border-gray-300 dark:border-gray-500 rounded-lg px-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all" 
                placeholder="Nama kategori..." 
              />
              <button 
                type="button" 
                onClick={handleSavePreset} 
                className="h-11 bg-teal-600 text-white px-5 rounded-lg text-sm font-bold hover:bg-teal-700 transition-all shadow-sm"
              >
                {editingPresetId ? 'Update' : 'Tambah'}
              </button>
            </div>

            {/* List Kategori */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {presets.map(p => (
                <div key={p.id} className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{p.emoji}</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.label}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEditPreset(p)} className="p-1.5 text-gray-400 hover:text-teal-600 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-600"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeletePreset(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            
            {editingPresetId && (
              <button onClick={() => { setEditingPresetId(null); setNewPresetLabel(''); setNewPresetEmoji('🍔'); }} className="mt-3 text-xs text-gray-500 underline text-center w-full">Batal Edit</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
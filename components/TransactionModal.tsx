'use client';
import { useState, useEffect } from 'react';
import { saveTransactions, type NewTransaction } from '@/lib/offlineQueue';
import type { Preset } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { X, Plus, Settings2, ChevronDown, Camera, ImageUp, Loader2, Save, Check } from 'lucide-react';
import { toLocalDateStr, errMsg } from '@/lib/utils';
import { Frequency } from '@/lib/recurring';
import { createRecurringRule } from '@/lib/recurringClient';
import { listWallets, Wallet } from '@/lib/wallets';
import { getActiveWallet } from '@/lib/activeWallet';
import FrequencyPicker from '@/components/FrequencyPicker';
import WalletChips from '@/components/WalletChips';
import { triggerMoneyRain } from '@/components/MoneyRain';
import DateField from '@/components/DateField';
import { Btn, Toggle, RowActions } from '@/components/ui';
import { recognizeReceipt, overallPercent } from '@/lib/receiptOcr';
import { parseReceiptText } from '@/lib/receiptParser';

import SegmentedControl from '@/components/SegmentedControl';
type TxRow = {
  id: string;
  type: 'income' | 'expense';
  amountDisplay: string;
  amountRaw: number;
  selectedPreset: string;
  date: string;
  isRoutine: boolean;
  frequency: Frequency;
  walletId: string;
  notes: string;
  scanned: boolean;
};

// Teks kategori yang disimpan di transaksi. Kategori lama yang punya emoji tetap menyimpan emoji supaya Riwayat dan Laporan tidak terpecah; di layar Catat hanya namanya yang tampil.
const presetValue = (p: Pick<Preset, 'emoji' | 'label'>): string => (p.emoji ? `${p.emoji} ${p.label}` : p.label);

export default function TransactionModal({ isOpen, onClose, onSuccess, showDialog, initialType, initialDate }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, showDialog: (title: string, msg: string, type: 'info'|'success'|'danger', onConfirm?: () => void) => void, initialType?: 'income' | 'expense', initialDate?: string }) {
  
  const [txList, setTxList] = useState<TxRow[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState<Record<string, boolean>>({});
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [defaultWalletId, setDefaultWalletId] = useState('');

  // State Modal Kelola Kategori
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  // Mode input: ketik manual atau scan/unggah struk (hanya untuk pengeluaran)
  const [inputMode, setInputMode] = useState<'manual' | 'scan'>('manual');
  const [scanning, setScanning] = useState(false);
  const [scanPct, setScanPct] = useState(0);
  const [scanNote, setScanNote] = useState<{ merchant: string | null; foundAmount: boolean; foundDate: boolean } | null>(null);

  const createEmptyRow = (): TxRow => ({
    id: Date.now().toString() + Math.random().toString(),
    type: initialType || 'expense',
    amountDisplay: '',
    amountRaw: 0,
    selectedPreset: '',
    date: initialDate || toLocalDateStr(new Date()),
    isRoutine: false,
    frequency: 'monthly' as Frequency,
    walletId: defaultWalletId,
    notes: '',
    scanned: false
  });

  const fetchPresets = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    let { data } = await supabase.from('presets').select('*').order('created_at', { ascending: true });
    
    if (!data || data.length === 0) {
      const defaultPresets = [
        { user_id: session.user.id, label: 'Gaji', emoji: '' },
        { user_id: session.user.id, label: 'Makan', emoji: '' },
        { user_id: session.user.id, label: 'Kopi', emoji: '' },
        { user_id: session.user.id, label: 'Bensin', emoji: '' },
        { user_id: session.user.id, label: 'Belanja', emoji: '' },
        { user_id: session.user.id, label: 'Lainnya', emoji: '' },
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
      setInputMode('manual'); setScanNote(null); setScanning(false);
      // Dompet (kosong kalau fitur Dompet belum diaktifkan)
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const list = await listWallets(session.user.id, true);
        setWallets(list);
        const active = getActiveWallet();
        const def = (active && list.some(w => w.id === active) ? active : '') || list.find(w => w.is_default)?.id || list[0]?.id || '';
        setDefaultWalletId(def);
        setTxList(prev => prev.map(r => r.walletId ? r : { ...r, walletId: def }));
      })();
    }
  }, [isOpen, initialType, initialDate]);

  if (!isOpen) return null;

  const updateRow = <K extends keyof TxRow>(id: string, field: K, value: TxRow[K]) => {
    setTxList(prev => prev.map(tx => tx.id === id ? { ...tx, [field]: value } : tx));
  };

  const handleAmountChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const formatted = rawValue ? new Intl.NumberFormat('id-ID').format(Number(rawValue)) : '';
    setTxList(prev => prev.map(tx => tx.id === id ? { ...tx, amountRaw: Number(rawValue || 0), amountDisplay: formatted } : tx));
  };

  // Scan struk hanya untuk pengeluaran: tersedia bila transaksi pertama bertipe Keluar
  const canScan = (txList[0]?.type ?? 'expense') === 'expense';
  const activeMode = canScan ? inputMode : 'manual';

  const handleReceiptFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return showDialog('Format Tidak Didukung', 'Pilih foto struk berformat gambar (JPG atau PNG).', 'danger');
    setScanning(true); setScanPct(0);
    try {
      const parsed = parseReceiptText(await recognizeReceipt(file, (s, p) => setScanPct(overallPercent(s, p))));
      const r = { amount: parsed.total ?? parsed.subtotal, date: parsed.date, merchant: parsed.merchant };
      setTxList(prev => {
        const base = prev.length > 0 ? prev : [createEmptyRow()];
        const [first, ...rest] = base;
        const filled: TxRow = {
          ...first,
          type: 'expense',
          scanned: true,
          ...(r.amount ? { amountRaw: r.amount, amountDisplay: new Intl.NumberFormat('id-ID').format(r.amount) } : {}),
          ...(r.date ? { date: r.date } : {}),
        };
        return [filled, ...rest];
      });
      setScanNote({ merchant: r.merchant, foundAmount: !!r.amount, foundDate: !!r.date });
      setInputMode('manual');
    } catch (err: unknown) {
      showDialog('Scan Gagal', errMsg(err, 'Struk tidak terbaca. Coba foto yang lebih jelas atau isi manual.'), 'danger');
    } finally {
      setScanning(false);
    }
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

      // Transaksi berstatus "Rutin" otomatis dibuatkan aturan berulang (dicatat sendiri oleh sistem)
      // Transaksi rutin membuat aturan berulang di server, jadi butuh internet
      if (navigator.onLine === false && txList.some((t) => t.isRoutine)) throw new Error('Transaksi rutin butuh internet. Matikan opsi Rutin, atau coba lagi saat online.');
      const createdRuleIds: string[] = [];
      const payloads: NewTransaction[] = [];
      for (const tx of txList) {
        let ruleId: string | null = null;
        if (tx.isRoutine) {
          ruleId = await createRecurringRule({
            userId: session.user.id,
            merchantName: tx.selectedPreset,
            amount: tx.amountRaw,
            type: tx.type,
            frequency: tx.frequency,
            startDate: tx.date,
            walletId: tx.walletId || null
          });
          if (ruleId) createdRuleIds.push(ruleId);
        }
        payloads.push({
          user_id: session.user.id,
          merchant_name: tx.selectedPreset,
          amount: tx.amountRaw,
          type: tx.type,
          transaction_date: tx.date,
          is_routine: tx.isRoutine,
          is_ai_scanned: !!tx.scanned,
          ...(tx.notes?.trim() ? { notes: tx.notes.trim() } : {}),
          ...(ruleId ? { recurring_rule_id: ruleId } : {}),
          ...(tx.walletId ? { wallet_id: tx.walletId } : {})
        });
      }

      const saved = await saveTransactions(payloads);
      if (!saved.ok) {
        if (createdRuleIds.length > 0) await supabase.from('recurring_rules').delete().in('id', createdRuleIds);
        throw saved.error;
      }
      
      const routineCount = createdRuleIds.length;
      if (saved.queued) {
        showDialog('Tersimpan di Perangkat', `${txList.length} transaksi disimpan di perangkat dan akan dikirim otomatis saat kamu online lagi.`, 'info');
        onSuccess(); onClose();
        return;
      }
      showDialog('Berhasil', routineCount > 0 ? `${txList.length} transaksi tersimpan. ${routineCount} transaksi rutin akan tercatat otomatis sesuai jadwal.` : `${txList.length} transaksi berhasil disimpan!`, 'success');
      const hasIn = txList.some((t) => t.type === 'income');
      const hasOut = txList.some((t) => t.type === 'expense');
      const sum = (t: 'income' | 'expense') => txList.filter((x) => x.type === t).reduce((s, x) => s + x.amountRaw, 0);
      triggerMoneyRain(hasIn && hasOut ? 'mixed' : hasIn ? 'income' : 'expense', hasIn && hasOut ? undefined : sum(hasIn ? 'income' : 'expense'));
      onSuccess(); onClose();   
    } catch (error: unknown) {
      showDialog('Gagal', errMsg(error), 'danger');
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
      await supabase.from('presets').update({ label: newPresetLabel }).eq('id', editingPresetId);
    } else {
      await supabase.from('presets').insert({ user_id: session.user.id, label: newPresetLabel, emoji: '' });
    }
    
    setNewPresetLabel(''); setEditingPresetId(null);
    fetchPresets();
  };

  const handleEditPreset = (preset: Preset) => {
    setEditingPresetId(preset.id);
    setNewPresetLabel(preset.label);
  };

  const handleDeletePreset = (id: string) => {
    // POIN 1: Menggunakan Custom Dialog
    showDialog('Hapus Kategori?', 'Kategori ini akan dihapus dari daftar pilihan.', 'danger', async () => {
      await supabase.from('presets').delete().eq('id', id);
      fetchPresets();
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[70] flex items-end justify-center backdrop-blur-sm">
        <div className="glass glass-sheet rounded-t-3xl rounded-b-none sheet-up w-full max-w-md relative max-h-[90vh] flex flex-col overflow-hidden transition-colors">
          
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center glass z-10 transition-colors">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Catat</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-4 overflow-y-auto space-y-4 flex-1 bg-gray-50 dark:bg-gray-900 transition-colors">
            
            {canScan && (
            <SegmentedControl
              options={[{ value: 'manual', label: 'Ketik' }, { value: 'scan', label: 'Foto Struk' }]}
              value={activeMode}
              onChange={(v) => setInputMode(v as 'manual' | 'scan')}
            />
            )}

            {inputMode === 'scan' && canScan && (
              <div className="glass p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm text-center space-y-3 transition-colors">
                <p className="text-sm font-bold text-gray-800 dark:text-white">Foto struknya, nominal terisi sendiri</p>
                {scanning ? (
                  <div className="py-4 flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
                    <p className="text-xs font-bold text-sky-700 dark:text-sky-400">Membaca struk{scanPct > 0 ? ` ${scanPct}%` : '...'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="cursor-pointer flex items-center justify-center gap-1.5 py-3 rounded-[9px] text-xs font-extrabold border btn-accent active:scale-95 transition-all">
                      <Camera className="w-4 h-4" /> Kamera
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handleReceiptFile(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <label className="cursor-pointer flex items-center justify-center gap-1.5 py-3 rounded-[9px] text-xs font-extrabold border btn-accent-soft active:scale-95 transition-all">
                      <ImageUp className="w-4 h-4" /> Galeri
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { handleReceiptFile(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                  </div>
                )}
              </div>
            )}

            {activeMode === 'manual' && scanNote && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Cek lagi ya, lalu pilih kategori</p>
                {(!scanNote.foundAmount || !scanNote.foundDate) && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">{!scanNote.foundAmount ? 'Nominal belum terbaca.' : ''} {!scanNote.foundDate ? 'Tanggal belum terbaca.' : ''}</p>
                )}
              </div>
            )}

            {activeMode === 'manual' && txList.map((tx, index) => (
              <div key={tx.id} className="glass p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm relative transition-colors">
                {txList.length > 1 && (
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Transaksi {index + 1}</span>
                    <Btn variant="danger" onClick={() => removeRow(tx.id)}>Hapus</Btn>
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <button type="button" onClick={() => updateRow(tx.id, 'type', 'expense')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-2 transition-all ${tx.type === 'expense' ? 'glass glass-danger' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>
                    Keluar
                  </button>
                  <button type="button" onClick={() => updateRow(tx.id, 'type', 'income')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-2 transition-all ${tx.type === 'income' ? 'glass glass-teal' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>
                    Masuk
                  </button>
                </div>

                {/* POIN 3: Input nominal diubah jadi hitam (text-gray-900) */}
                <div className="relative mb-3">
                  <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 font-bold text-sm">Rp</span>
                  <input 
                    type="text" 
                    inputMode="numeric" 
                    value={tx.amountDisplay} 
                    onChange={(e) => handleAmountChange(tx.id, e)} 
                                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 text-sm font-bold transition-colors" 
                    required 
                  />
                </div>

                <div className="mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map(p => (
                      <button key={p.id} type="button" onClick={() => updateRow(tx.id, 'selectedPreset', presetValue(p))} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${tx.selectedPreset === presetValue(p) ? 'glass glass-teal' : 'glass border-transparent text-gray-600 dark:text-gray-300'}`}>
                        {p.label}
                      </button>
                    ))}
                    <button type="button" onClick={() => setIsPresetModalOpen(true)} aria-label="Atur kategori" className="glass px-2.5 py-1.5 rounded-lg text-gray-400"><Settings2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="mb-3"><WalletChips wallets={wallets} value={tx.walletId} onChange={(id) => updateRow(tx.id, 'walletId', id)} /></div>

                <button type="button" onClick={() => setMoreOpen(m => ({ ...m, [tx.id]: !m[tx.id] }))} className="w-full flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400">
                  <span>{tx.date === toLocalDateStr(new Date()) ? 'Hari ini' : tx.date}{tx.isRoutine ? ' · Rutin' : ''}{tx.notes ? ' · ada catatan' : ''}</span>
                  <span className="flex items-center gap-1">Lainnya <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen[tx.id] ? 'rotate-180' : ''}`} /></span>
                </button>

                {moreOpen[tx.id] && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Tanggal</label>
                      <DateField compact required value={tx.date} onChange={(v) => updateRow(tx.id, 'date', v)} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Catatan</label>
                      <input
                        type="text"
                        value={tx.notes}
                        onChange={(e) => updateRow(tx.id, 'notes', e.target.value)}
                        maxLength={200}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 text-sm transition-colors"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Ulang tiap bulan</span>
                      <Toggle checked={tx.isRoutine} onChange={(v) => updateRow(tx.id, 'isRoutine', v)} label="Transaksi rutin" onText="Ya" offText="Tidak" />
                    </div>
                    {tx.isRoutine && (
                      <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl">
                        <FrequencyPicker value={tx.frequency} onChange={(v) => updateRow(tx.id, 'frequency', v)} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {activeMode === 'manual' && <button type="button" onClick={addRow} className="glass glass-teal w-full py-3 border-2 border-dashed font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-sm">
              <Plus className="w-4 h-4" /> Transaksi lain
            </button>}
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-700 glass transition-colors">
            <button onClick={handleSaveAll} disabled={loading} className="glass glass-solid-teal w-full border hover:brightness-95 font-bold py-3 rounded-[9px] transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? 'Menyimpan...' : txList.length > 1 ? `Simpan ${txList.length}` : 'Simpan'}
            </button>
          </div>

        </div>
      </div>

      {/* MODAL KELOLA KATEGORI */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-end justify-center backdrop-blur-sm">
          <div className="glass glass-sheet rounded-t-3xl rounded-b-none sheet-up w-full max-w-sm p-6 relative transition-colors max-h-[80vh] flex flex-col">
            <button onClick={() => setIsPresetModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 text-center">Kategori</h2>
            
            <div className="flex items-center gap-1.5 mb-4 bg-gray-50 dark:bg-gray-700 p-2 rounded-xl border border-gray-100 dark:border-gray-600 w-full">
              <input type="text" value={newPresetLabel} onChange={(e) => setNewPresetLabel(e.target.value)} className="flex-1 min-w-0 h-10 border border-gray-300 dark:border-gray-500 rounded-lg px-2 text-sm glass text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 transition-all" aria-label="Nama kategori" />
              <Btn variant="primary" size="md" onClick={handleSavePreset} className="shrink-0">{editingPresetId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}{editingPresetId ? 'Update' : 'Tambah'}</Btn>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {presets.map(p => (
                <div key={p.id} className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.label}</span>
                  </div>
                  <RowActions onEdit={() => handleEditPreset(p)} onDelete={() => handleDeletePreset(p.id)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Edit3, Trash2, ArrowLeftRight, Star, Eye, EyeOff, Wallet as WalletIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, formatDateID, parseRupiahInput, toLocalDateStr } from '@/lib/utils';
import { Wallet, WalletTransfer, WALLET_TYPE_LABEL, computeWalletBalances, listWallets } from '@/lib/wallets';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SkeletonLoader from '@/components/SkeletonLoader';
import DateField from '@/components/DateField';

const TYPES: { id: Wallet['type']; label: string; emoji: string }[] = [
  { id: 'cash', label: 'Tunai', emoji: '💵' },
  { id: 'bank', label: 'Bank', emoji: '🏦' },
  { id: 'ewallet', label: 'E-Wallet', emoji: '📱' },
  { id: 'other', label: 'Lainnya', emoji: '💼' },
];
const inputCls = 'w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500';

export default function WalletsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Form dompet
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<Wallet['type']>('cash');
  const [emoji, setEmoji] = useState('💵');
  const [initDisplay, setInitDisplay] = useState('');
  const [initRaw, setInitRaw] = useState(0);

  // Form transfer
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [trDisplay, setTrDisplay] = useState('');
  const [trRaw, setTrRaw] = useState(0);
  const [trDate, setTrDate] = useState('');
  const [trNote, setTrNote] = useState('');

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  const fetchAll = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');
    setUserId(session.user.id);

    const probe = await supabase.from('wallets').select('id').limit(1);
    if (probe.error) { setMissingTable(true); setLoading(false); return; }

    setWallets(await listWallets(session.user.id, true));
    const { data: tx } = await supabase.from('transactions').select('wallet_id,type,amount');
    setTxs(tx || []);
    const { data: tr } = await supabase.from('wallet_transfers').select('*').order('transfer_date', { ascending: false }).order('created_at', { ascending: false });
    setTransfers((tr || []) as WalletTransfer[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  const { balances, unassigned } = computeWalletBalances(wallets, txs, transfers);
  const total = Object.values(balances).reduce((a, b) => a + b, 0) + unassigned;
  const walletById = (id: string) => wallets.find((w) => w.id === id);
  const money = (n: number) => (hidden ? 'Rp ******' : formatRupiah(n));

  const openAdd = () => {
    setEditingId(null); setName(''); setType('cash'); setEmoji('💵'); setInitDisplay(''); setInitRaw(0);
    setIsFormOpen(true);
  };
  const openEdit = (w: Wallet) => {
    setEditingId(w.id); setName(w.name); setType(w.type); setEmoji(w.emoji);
    setInitRaw(Number(w.initial_balance)); setInitDisplay(Number(w.initial_balance) ? new Intl.NumberFormat('id-ID').format(Number(w.initial_balance)) : '');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return showDialog('Data Belum Lengkap', 'Isi nama dompet.', 'danger');
    const payload = { name: name.trim(), type, emoji: emoji.trim() || '💼', initial_balance: initRaw };
    const { error } = editingId
      ? await supabase.from('wallets').update(payload).eq('id', editingId)
      : await supabase.from('wallets').insert({ ...payload, user_id: userId, is_default: false });
    if (error) return showDialog('Gagal', error.message, 'danger');
    setIsFormOpen(false);
    fetchAll();
  };

  const makeDefault = async (w: Wallet) => {
    await supabase.from('wallets').update({ is_default: false }).eq('user_id', userId).eq('is_default', true);
    await supabase.from('wallets').update({ is_default: true }).eq('id', w.id);
    fetchAll();
  };

  const handleDelete = (w: Wallet) => {
    if (w.is_default) return showDialog('Tidak Bisa Dihapus', 'Dompet utama tidak bisa dihapus. Jadikan dompet lain sebagai utama dulu.', 'info');
    showDialog('Hapus Dompet?', `Transaksi di "${w.name}" tidak ikut terhapus, tetapi jadi "tanpa dompet". Riwayat transfer dompet ini ikut terhapus.`, 'danger', async () => {
      await supabase.from('wallets').delete().eq('id', w.id);
      fetchAll();
    });
  };

  const openTransfer = () => {
    if (wallets.length < 2) return showDialog('Butuh 2 Dompet', 'Tambahkan minimal dua dompet untuk melakukan transfer.', 'info');
    setFromId(wallets[0].id); setToId(wallets[1].id);
    setTrDisplay(''); setTrRaw(0); setTrNote(''); setTrDate(toLocalDateStr(new Date()));
    setIsTransferOpen(true);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromId === toId) return showDialog('Dompet Sama', 'Pilih dompet asal dan tujuan yang berbeda.', 'danger');
    if (trRaw <= 0) return showDialog('Nominal Kosong', 'Isi nominal transfer.', 'danger');
    if ((balances[fromId] || 0) < trRaw) return showDialog('Saldo Tidak Cukup', `Saldo ${walletById(fromId)?.name} hanya ${formatRupiah(balances[fromId] || 0)}.`, 'danger');
    const { error } = await supabase.from('wallet_transfers').insert({
      user_id: userId, from_wallet_id: fromId, to_wallet_id: toId, amount: trRaw, note: trNote.trim() || null, transfer_date: trDate,
    });
    if (error) return showDialog('Gagal', error.message, 'danger');
    setIsTransferOpen(false);
    fetchAll();
  };

  const deleteTransfer = (t: WalletTransfer) => {
    showDialog('Hapus Transfer?', 'Saldo kedua dompet akan kembali seperti sebelum transfer ini.', 'danger', async () => {
      await supabase.from('wallet_transfers').delete().eq('id', t.id);
      fetchAll();
    });
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-24 transition-colors">
      <AppHeader title="Dompet" back action={!missingTable ? (
        <button onClick={openAdd} className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 p-2.5 rounded-xl hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-all font-bold text-xs flex items-center gap-1"><Plus className="w-4 h-4" /> Tambah</button>
      ) : null} />

      <main className="px-5 mt-4 space-y-5">
        {missingTable ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
            <WalletIcon className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">Fitur Dompet belum diaktifkan</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Jalankan 02_dompet.sql di Supabase (SQL Editor), lalu muat ulang halaman ini.</p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl p-6 text-white shadow-lg bg-teal-700">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white/80 text-xs font-medium">Total semua dompet</p>
                <button onClick={() => setHidden(!hidden)} className="bg-black/20 hover:bg-black/40 p-1 rounded-full text-white transition-all backdrop-blur-sm">{hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
              </div>
              <h3 className="text-3xl font-extrabold mb-4">{money(total)}</h3>
              <button onClick={openTransfer} className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all backdrop-blur-sm"><ArrowLeftRight className="w-4 h-4" /> Transfer antar dompet</button>
            </div>

            <div className="space-y-3">
              {wallets.map((w) => (
                <div key={w.id} className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-2xl shrink-0">{w.emoji}</div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 dark:text-gray-100 truncate flex items-center gap-1.5">
                          {w.name}
                          {w.is_default && <span className="text-[9px] bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded font-bold">Utama</span>}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{WALLET_TYPE_LABEL[w.type]}</p>
                      </div>
                    </div>
                    <p className={`font-bold shrink-0 ${(balances[w.id] || 0) < 0 ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>{money(balances[w.id] || 0)}</p>
                  </div>
                  <div className="flex justify-end gap-1 mt-3">
                    {!w.is_default && <button onClick={() => makeDefault(w)} className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2.5 py-1.5 rounded-md flex items-center gap-1"><Star className="w-3 h-3" /> Jadikan utama</button>}
                    <button onClick={() => openEdit(w)} className="text-gray-400 hover:text-teal-600 bg-gray-50 dark:bg-gray-700 p-1.5 rounded-md transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(w)} className="text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700 p-1.5 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}

              {Math.abs(unassigned) > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Tanpa dompet</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Transaksi yang belum dimasukkan ke dompet tertentu</p>
                  </div>
                  <p className="font-bold text-gray-600 dark:text-gray-300">{money(unassigned)}</p>
                </div>
              )}
            </div>

            {transfers.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-3">Riwayat Transfer</h3>
                <div className="space-y-2">
                  {transfers.slice(0, 10).map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{walletById(t.from_wallet_id)?.emoji} {walletById(t.from_wallet_id)?.name} → {walletById(t.to_wallet_id)?.emoji} {walletById(t.to_wallet_id)?.name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatDateID(t.transfer_date)}{t.note ? ` · ${t.note}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{money(Number(t.amount))}</span>
                        <button onClick={() => deleteTransfer(t)} className="text-gray-300 dark:text-gray-500 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsFormOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">{editingId ? 'Edit Dompet' : 'Tambah Dompet'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex gap-2">
                <input type="text" value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-14 shrink-0 text-center border border-gray-200 dark:border-gray-600 rounded-xl text-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500" placeholder="💵" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cth: BCA, GoPay, Dompet Tunai" required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Jenis</label>
                <div className="flex gap-1.5">
                  {TYPES.map((t) => (
                    <button key={t.id} type="button" onClick={() => { setType(t.id); if (!editingId) setEmoji(t.emoji); }} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border-2 transition-all ${type === t.id ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Saldo awal (opsional)</label>
                <input type="text" inputMode="numeric" value={initDisplay} onChange={(e) => { const p = parseRupiahInput(e.target.value); setInitRaw(p.raw); setInitDisplay(p.display); }} placeholder="Rp 0" className={`${inputCls} font-bold`} />
                <p className="text-[10px] text-gray-400 mt-1">Uang yang sudah ada di dompet ini sebelum kamu mencatat. Ikut dihitung di Total Saldo.</p>
              </div>
              <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl mt-2 transition-all">{editingId ? 'Simpan Perubahan' : 'Simpan Dompet'}</button>
            </form>
          </div>
        </div>
      )}

      {isTransferOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsTransferOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">Transfer Antar Dompet</h2>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Dari</label>
                  <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputCls}>{wallets.map((w) => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}</select>
                </div>
                <ArrowLeftRight className="w-4 h-4 text-gray-400 mb-4 shrink-0" />
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ke</label>
                  <select value={toId} onChange={(e) => setToId(e.target.value)} className={inputCls}>{wallets.map((w) => <option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}</select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nominal</label>
                <input type="text" inputMode="numeric" value={trDisplay} onChange={(e) => { const p = parseRupiahInput(e.target.value); setTrRaw(p.raw); setTrDisplay(p.display); }} required placeholder="Nominal (Rp)" className={`${inputCls} font-bold`} />
                <p className="text-[10px] text-gray-400 mt-1">Saldo tersedia: {formatRupiah(balances[fromId] || 0)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DateField label="Tanggal" required value={trDate} onChange={setTrDate} />
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
                  <input type="text" value={trNote} onChange={(e) => setTrNote(e.target.value)} placeholder="Opsional" className={`${inputCls} !h-11 !py-0`} />
                </div>
              </div>
              <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl mt-2 transition-all">Transfer Sekarang</button>
            </form>
          </div>
        </div>
      )}

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}

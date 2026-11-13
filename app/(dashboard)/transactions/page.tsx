'use client';
import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Trash2, ArrowDownCircle, ArrowUpCircle, Calendar, XCircle, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import DateField from '@/components/DateField';
import SkeletonLoader from '@/components/SkeletonLoader';
import EditTransactionModal from '@/components/EditTransactionModal';
import RecurringRulesModal from '@/components/RecurringRulesModal';
import { listWallets, Wallet } from '@/lib/wallets';

function TransactionsContent() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info'|'success'|'danger', onConfirm: undefined as (()=>void)|undefined });
  const showDialog = (title: string, msg: string, type: 'info'|'success'|'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Ambil parameter tanggal dari URL
  const urlDate = searchParams.get('date');

  const fetchTx = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const { data, error } = await supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setWallets(await listWallets(session.user.id, false));
      if (data) {
        setTransactions(data);
        const uniqueCats = Array.from(new Set(data.map((t: any) => t.merchant_name)));
        setCategories(uniqueCats as string[]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengambil data');
    } finally {
      setIsLoading(false);
    }
  };

  // Muat ulang diam-diam saat transaksi baru dicatat lewat tombol Catat di menu
  useEffect(() => {
    const onSaved = () => { fetchTx(true); };
    window.addEventListener('celengin:tx-saved', onSaved);
    return () => window.removeEventListener('celengin:tx-saved', onSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { 
    fetchTx(); 
    // Jika ada parameter tanggal, set filter tanggal
    if (urlDate) {
      setStartDate(urlDate);
      setEndDate(urlDate);
    }
  }, [urlDate]);

  useEffect(() => { setCurrentPage(1); }, [search, filterType, filterCategory, startDate, endDate]);

  const handleDelete = (id: string) => {
    setDialog({
      isOpen: true, title: 'Hapus Transaksi?', msg: 'Data ini akan dihapus permanen.', type: 'danger',
      onConfirm: async () => { 
        await supabase.from('transactions').delete().eq('id', id); 
        fetchTx(); 
      }
    });
  };

  const filteredTx = transactions.filter(tx => {
    const matchSearch = tx.merchant_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' ? true : tx.type === filterType;
    const matchCategory = filterCategory === 'all' ? true : tx.merchant_name === filterCategory;
    
    let matchDate = true;
    if (startDate && endDate) matchDate = tx.transaction_date >= startDate && tx.transaction_date <= endDate;
    else if (startDate) matchDate = tx.transaction_date >= startDate;
    else if (endDate) matchDate = tx.transaction_date <= endDate;

    return matchSearch && matchType && matchCategory && matchDate;
  });

  const totalPages = Math.ceil(filteredTx.length / itemsPerPage);
  const paginatedTx = filteredTx.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  // Transaksi lama yang bertanda rutin tapi belum punya aturan otomatis
  const routineTx = transactions.filter(t => t.is_routine && !t.recurring_rule_id);
  const walletLabel = (id?: string | null) => { const w = wallets.find(x => x.id === id); return w ? `${w.emoji} ${w.name}` : ''; };

  if (isLoading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-24 transition-colors">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 transition-colors">
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-bold text-xl text-teal-800 dark:text-teal-400">Riwayat</span>
        </div>
        <button onClick={() => setIsRoutineModalOpen(true)} className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-3 py-1.5 rounded-lg border border-teal-100 dark:border-teal-800 transition-colors">
          Transaksi Rutin
        </button>
      </header>

      <main className="max-w-md mx-auto px-5 mt-4 space-y-4">
        {errorMsg && <div className="bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-xs p-3 rounded-xl border border-red-100 dark:border-red-800">{errorMsg}</div>}

        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
          <input type="text" placeholder="Cari catatan..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-teal-500 text-sm transition-colors" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="text-xs border-gray-200 dark:border-gray-700 rounded-xl p-2 bg-white dark:bg-gray-800 font-semibold text-gray-600 dark:text-gray-300 shadow-sm shrink-0 transition-colors">
            <option value="all">Semua Tipe</option><option value="income">Masuk</option><option value="expense">Keluar</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="text-xs border-gray-200 dark:border-gray-700 rounded-xl p-2 bg-white dark:bg-gray-800 font-semibold text-gray-600 dark:text-gray-300 shadow-sm shrink-0 transition-colors">
            <option value="all">Semua Kategori</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <DateField compact label="Dari" placeholder="Semua tanggal" value={startDate} max={endDate || undefined} onChange={setStartDate} className="flex-1" />
          <DateField compact label="Sampai" placeholder="Semua tanggal" value={endDate} min={startDate || undefined} onChange={setEndDate} className="flex-1" />
          {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); router.push('/transactions'); }} className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/30 text-red-400 hover:text-red-600" aria-label="Hapus filter tanggal"><XCircle className="w-5 h-5" /></button>}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          {paginatedTx.length === 0 ? (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-10">Tidak ada transaksi yang cocok.</p>
          ) : (
            paginatedTx.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-3 border-b border-gray-50 dark:border-gray-700 last:border-0 group">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'}`}>
                    {tx.type === 'income' ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{tx.merchant_name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5 flex-wrap"><Calendar className="w-3 h-3 shrink-0" /> {tx.transaction_date}{tx.is_routine && <span className="text-[9px] bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded font-bold">Rutin</span>}</p>
                    {((wallets.length > 1 && tx.wallet_id) || tx.notes) && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{[wallets.length > 1 ? walletLabel(tx.wallet_id) : '', tx.notes].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 pl-2">
                  <p className={`font-bold text-[13px] whitespace-nowrap ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>{tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}</p>
                  <button onClick={() => { setSelectedTx(tx); setIsEditModalOpen(true); }} className="text-gray-300 dark:text-gray-600 hover:text-teal-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(tx.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Halaman {currentPage} dari {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} className="p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}
      </main>

      {/* MODAL KELOLA TRANSAKSI RUTIN (otomatis) */}
      <RecurringRulesModal isOpen={isRoutineModalOpen} onClose={() => setIsRoutineModalOpen(false)} showDialog={showDialog} legacyTx={routineTx} onChanged={() => fetchTx(true)} />

      <EditTransactionModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={() => fetchTx()} showDialog={showDialog} txData={selectedTx} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>}>
      <TransactionsContent />
    </Suspense>
  );
}
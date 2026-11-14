'use client';
import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Trash2, ArrowDownCircle, ArrowUpCircle, Calendar, XCircle, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import DateField from '@/components/DateField';
import SkeletonLoader from '@/components/SkeletonLoader';
import EditTransactionModal from '@/components/EditTransactionModal';
import SubTabs, { RIWAYAT_TABS } from '@/components/SubTabs';
import { DateStack, RowActions } from '@/components/ui';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
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
  const walletLabel = (id?: string | null) => { const w = wallets.find(x => x.id === id); return w ? `${w.emoji} ${w.name}` : ''; };

  if (isLoading) return <div className="min-h-screen bg-[var(--bg-main)]"><SkeletonLoader /></div>;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-40 transition-colors">
      <AppHeader title="Riwayat" />

      <main className="max-w-md mx-auto px-4 mt-3 space-y-4">
        <SubTabs items={RIWAYAT_TABS} />

        {errorMsg && <div className="glass glass-danger text-xs p-3 rounded-2xl">{errorMsg}</div>}

        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3.5 z-10 text-[color:var(--text-muted)]" />
          <input type="text" placeholder="Cari catatan..." value={search} onChange={(e) => setSearch(e.target.value)} className="glass w-full pl-10 pr-4 py-3 rounded-full text-sm outline-none focus:ring-2 focus:ring-[color:var(--teal-primary)]" style={{ color: 'var(--text-main)' }} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="glass text-xs rounded-full px-3 py-2 font-semibold shrink-0 outline-none" style={{ color: 'var(--text-main)' }}>
            <option value="all">Semua Tipe</option><option value="income">Masuk</option><option value="expense">Keluar</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="glass text-xs rounded-full px-3 py-2 font-semibold shrink-0 outline-none" style={{ color: 'var(--text-main)' }}>
            <option value="all">Semua Kategori</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <DateField compact label="Dari" placeholder="Semua tanggal" value={startDate} max={endDate || undefined} onChange={setStartDate} className="flex-1" />
          <DateField compact label="Sampai" placeholder="Semua tanggal" value={endDate} min={startDate || undefined} onChange={setEndDate} className="flex-1" />
          {(startDate || endDate) && <GlassButton variant="danger" size="icon" onClick={() => { setStartDate(''); setEndDate(''); router.push('/transactions'); }} aria-label="Hapus filter tanggal"><XCircle className="w-5 h-5" /></GlassButton>}
        </div>

        <div className="space-y-3">
          {paginatedTx.length === 0 ? (
            <GlassCard><p className="text-center text-xs py-6 text-[color:var(--text-muted)]">Tidak ada transaksi yang cocok.</p></GlassCard>
          ) : (
            paginatedTx.map(tx => (
              <GlassCard key={tx.id} className="!p-3 !rounded-3xl">
                <div className="flex items-center gap-3">
                  <DateStack ymd={tx.transaction_date} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-base truncate" style={{ color: 'var(--text-main)' }}>{tx.merchant_name}</p>
                    <p className="font-extrabold text-base mt-0.5" style={{ color: 'var(--text-main)' }}>{tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}</p>
                    {(tx.is_routine || (wallets.length > 1 && tx.wallet_id) || tx.notes) && (
                      <p className="text-[10px] text-[color:var(--text-muted)] truncate mt-0.5">
                        {tx.is_routine && <span className="glass glass-teal text-[9px] px-1.5 py-0.5 rounded-full font-bold mr-1">Rutin</span>}
                        {[wallets.length > 1 ? walletLabel(tx.wallet_id) : '', tx.notes].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <RowActions vertical onEdit={() => { setSelectedTx(tx); setIsEditModalOpen(true); }} onDelete={() => handleDelete(tx.id)} />
                </div>
              </GlassCard>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-2">
            <GlassButton size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} aria-label="Halaman sebelumnya"><ChevronLeft className="w-4 h-4" /></GlassButton>
            <span className="text-xs font-semibold text-[color:var(--text-muted)]">Halaman {currentPage} dari {totalPages}</span>
            <GlassButton size="icon" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} aria-label="Halaman berikutnya"><ChevronRight className="w-4 h-4" /></GlassButton>
          </div>
        )}
      </main>

      <EditTransactionModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={() => fetchTx()} showDialog={showDialog} txData={selectedTx} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-main)]"><SkeletonLoader /></div>}>
      <TransactionsContent />
    </Suspense>
  );
}
'use client';
import { useEffect, useState, Suspense } from 'react';
import type { Transaction } from '@/lib/types';
import { errMsg } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, XCircle, ChevronLeft, ChevronRight, Bookmark, X } from 'lucide-react';
import { addSavedFilter, applyFilter, filterLabel, isFilterActive, loadSavedFilters, persistSavedFilters, removeSavedFilter, type SavedFilter, type TxFilter } from '@/lib/txFilter';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import DateField from '@/components/DateField';
import SkeletonLoader from '@/components/SkeletonLoader';
import EditTransactionModal from '@/components/EditTransactionModal';
import SubTabs, { RIWAYAT_TABS } from '@/components/SubTabs';
import TxList from '@/components/TxList';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
import Overview from '@/components/riwayat/Overview';

function TransactionsContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [view, setView] = useState<'ringkasan' | 'daftar'>('ringkasan');
  const [currentPage, setCurrentPage] = useState(1);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  useEffect(() => { setSavedFilters(loadSavedFilters()); }, []);
  const itemsPerPage = 7;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

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
      if (data) {
        setTransactions(data);
        const uniqueCats = Array.from(new Set((data as Transaction[]).map((t) => t.merchant_name)));
        setCategories(uniqueCats as string[]);
      }
    } catch (err: unknown) {
      setErrorMsg(errMsg(err, 'Gagal mengambil data'));
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
      setView('daftar');
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

  const currentFilter: TxFilter = { search, type: filterType, category: filterCategory, start: startDate, end: endDate };
  const filteredTx = applyFilter(transactions, currentFilter);

  const applySaved = (f: SavedFilter) => { setSearch(f.search); setFilterType(f.type); setFilterCategory(f.category); setStartDate(f.start); setEndDate(f.end); };
  const saveCurrent = () => { const next = addSavedFilter(savedFilters, currentFilter); setSavedFilters(next); persistSavedFilters(next); };
  const deleteSaved = (id: string) => { const next = removeSavedFilter(savedFilters, id); setSavedFilters(next); persistSavedFilters(next); };

  const totalPages = Math.ceil(filteredTx.length / itemsPerPage);
  const paginatedTx = filteredTx.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading) return <div className="min-h-screen bg-[var(--page-bg)]"><SkeletonLoader variant="list" /></div>;

  return (
    <div className="min-h-screen bg-[var(--page-bg)] pb-40 transition-colors">
      <AppHeader title="Riwayat" />

      <main className="max-w-md mx-auto px-4 mt-3 space-y-4">
        <SubTabs items={RIWAYAT_TABS} />

        {errorMsg && <div className="glass glass-danger text-xs p-3 rounded-2xl">{errorMsg}</div>}

        <div className="flex gap-2">
          {([['ringkasan', 'Ringkasan'], ['daftar', 'Semua Transaksi']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} className={`px-4 h-9 rounded-full text-xs font-bold ${view === k ? 'glass glass-solid-teal' : 'glass text-[color:var(--text-muted)]'}`}>{label}</button>
          ))}
        </div>

        {view === 'ringkasan' ? (
          <Overview transactions={transactions} onSeeAll={() => setView('daftar')} />
        ) : (
          <>
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3.5 z-10 text-[color:var(--text-muted)]" />
          <input type="text" placeholder="Cari catatan, kategori, atau nominal..." value={search} onChange={(e) => setSearch(e.target.value)} className="glass w-full pl-10 pr-4 py-3 rounded-full text-sm outline-none focus:ring-2 focus:ring-[color:var(--teal-primary)]" style={{ color: 'var(--text-main)' }} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <select value={filterType} onChange={e => setFilterType(e.target.value as 'all' | 'income' | 'expense')} className="glass text-xs rounded-full px-3 py-2 font-semibold shrink-0 outline-none" style={{ color: 'var(--text-main)' }}>
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

        {(savedFilters.length > 0 || isFilterActive(currentFilter)) && (
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar" aria-label="Filter tersimpan">
            {isFilterActive(currentFilter) && !savedFilters.some((f) => filterLabel(f) === filterLabel(currentFilter)) && (
              <button onClick={saveCurrent} className="glass glass-teal shrink-0 text-xs font-bold rounded-full px-3 py-2 flex items-center gap-1.5 border"><Bookmark className="w-3.5 h-3.5" /> Simpan filter ini</button>
            )}
            {savedFilters.map((f) => (
              <span key={f.id} className="glass shrink-0 text-xs font-semibold rounded-full pl-3 pr-1 py-1 flex items-center gap-1">
                <button onClick={() => applySaved(f)} className="py-1" style={{ color: 'var(--text-main)' }}>{filterLabel(f)}</button>
                <button onClick={() => deleteSaved(f.id)} aria-label={`Hapus filter ${filterLabel(f)}`} className="w-6 h-6 rounded-full flex items-center justify-center text-[color:var(--text-muted)]"><X className="w-3.5 h-3.5" /></button>
              </span>
            ))}
          </div>
        )}

        <GlassCard className="!py-2">
          {paginatedTx.length === 0 ? (
            <p className="text-center text-xs py-6 text-[color:var(--text-muted)]">Tidak ada transaksi yang cocok.</p>
          ) : (
            <>
              <p className="text-[10px] pt-1 px-1 text-[color:var(--text-muted)]">Ketuk transaksi untuk mengubahnya.</p>
              <TxList
                transactions={paginatedTx}
                onSelect={(tx) => { setSelectedTx(tx); setIsEditModalOpen(true); }}
                onDelete={(tx) => handleDelete(tx.id)}
              />
            </>
          )}
        </GlassCard>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-2">
            <GlassButton size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} aria-label="Halaman sebelumnya"><ChevronLeft className="w-4 h-4" /></GlassButton>
            <span className="text-xs font-semibold text-[color:var(--text-muted)]">Halaman {currentPage} dari {totalPages}</span>
            <GlassButton size="icon" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} aria-label="Halaman berikutnya"><ChevronRight className="w-4 h-4" /></GlassButton>
          </div>
        )}
          </>
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
    <Suspense fallback={<div className="min-h-screen bg-[var(--page-bg)]"><SkeletonLoader variant="list" /></div>}>
      <TransactionsContent />
    </Suspense>
  );
}
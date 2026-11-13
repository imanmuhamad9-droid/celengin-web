'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ChevronDown, ChevronUp, Edit3, ArrowDownCircle, ArrowUpCircle, Info, CalendarDays, Plus, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import TargetSetupModal from '@/components/TargetSetupModal';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SkeletonLoader from '@/components/SkeletonLoader';

export default function TargetPage() {
  const [targets, setTargets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showInfo, setShowInfo] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info'|'success'|'danger', onConfirm: undefined as (()=>void)|undefined });
  const showDialog = (title: string, msg: string, type: 'info'|'success'|'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const router = useRouter();

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');

    const { data: targetData } = await supabase.from('targets').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (targetData) setTargets(targetData);

    const { data: txData } = await supabase.from('transactions').select('*').eq('user_id', session.user.id);
    if (txData) setTransactions(txData);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDeleteTarget = (id: string) => {
    showDialog('Hapus Target?', 'Target ini akan dihapus.', 'danger', async () => {
      await supabase.from('targets').delete().eq('id', id);
      fetchData();
    });
  };

  if (loading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-24 transition-colors">
      <AppHeader title="Target" action={
        <button onClick={() => { setSelectedTarget(null); setIsModalOpen(true); }} className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 p-2 rounded-xl hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-all font-bold text-xs flex items-center gap-1">
          <Plus className="w-4 h-4" /> Buat
        </button>
      } />

      <main className="px-5 mt-4 space-y-5">
        <p className="text-xs text-gray-500 dark:text-gray-400">Atur batas pemasukan & pengeluaran.</p>

        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-2xl overflow-hidden transition-all duration-300">
          <button onClick={() => setShowInfo(!showInfo)} className="w-full flex items-center justify-between p-4 hover:bg-teal-100/50 dark:hover:bg-teal-900/40 transition-colors">
            <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-bold text-sm">
              <Info className="w-5 h-5 text-teal-600 dark:text-teal-400" /> Apa bedanya Target & Impian?
            </div>
            {showInfo ? <ChevronUp className="w-5 h-5 text-teal-600 dark:text-teal-400" /> : <ChevronDown className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
          </button>
          {showInfo && (
            <div className="px-4 pb-4 pt-0">
              <p className="text-[11px] text-teal-700/80 dark:text-teal-400/80 leading-relaxed pl-7">
                <strong>Target</strong> berfungsi untuk membatasi uang masuk dan uang keluar dalam periode tertentu. Kamu bisa membuat banyak target sekaligus. Sedangkan <strong>Impian</strong> untuk mengumpulkan dana membeli sesuatu.
              </p>
            </div>
          )}
        </div>

        {targets.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
            <ShieldAlert className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Belum ada target yang dibuat.</p>
            <button onClick={() => { setSelectedTarget(null); setIsModalOpen(true); }} className="bg-teal-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-teal-700 transition-all text-sm">
              Buat Target Pertama
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {targets.map(target => {
              const txsInPeriod = transactions.filter(t => {
                const txDate = t.transaction_date;
                return txDate >= target.start_date && txDate <= target.end_date;
              });

              const totalIncome = txsInPeriod.filter(t => t.type === 'income').reduce((a, b) => a + Number(b.amount), 0);
              const totalExpense = txsInPeriod.filter(t => t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
              
              const incomePercent = target.target_income > 0 ? Math.min((totalIncome / target.target_income) * 100, 100) : 0;
              const expensePercent = target.target_expense > 0 ? Math.min((totalExpense / target.target_expense) * 100, 100) : 0;

              return (
                <div key={target.id} className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 relative transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <div>
                        <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 capitalize">{target.period_type === 'custom' ? 'Custom' : target.period_type}</h3>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatDate(target.start_date)} - {formatDate(target.end_date)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedTarget(target); setIsModalOpen(true); }} className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 p-1.5 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteTarget(target.id)} className="text-red-400 bg-red-50 dark:bg-red-900/30 p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="flex-1 bg-green-50/50 dark:bg-green-900/10 p-2.5 rounded-2xl border border-green-100 dark:border-green-900/30">
                      <div className="flex items-center gap-1 mb-1"><ArrowDownCircle className="w-3 h-3 text-green-600 dark:text-green-400" /><span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 uppercase">Masuk</span></div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Target: {formatRupiah(target.target_income)}</p>
                      <p className="font-extrabold text-green-600 dark:text-green-400 text-sm mb-1">{formatRupiah(totalIncome)}</p>
                      {target.target_income > 0 && (
                        <>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mb-1"><div className="h-1 rounded-full bg-green-500" style={{ width: `${incomePercent}%` }}></div></div>
                          <p className={`text-[8px] font-bold ${totalIncome >= target.target_income ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {totalIncome >= target.target_income ? `Lebih ${formatRupiah(totalIncome - target.target_income)}` : `Kurang ${formatRupiah(target.target_income - totalIncome)}`}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex-1 bg-red-50/50 dark:bg-red-900/10 p-2.5 rounded-2xl border border-red-100 dark:border-red-900/30">
                      <div className="flex items-center gap-1 mb-1"><ArrowUpCircle className="w-3 h-3 text-red-600 dark:text-red-400" /><span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 uppercase">Keluar</span></div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Batas: {formatRupiah(target.target_expense)}</p>
                      <p className="font-extrabold text-red-600 dark:text-red-400 text-sm mb-1">{formatRupiah(totalExpense)}</p>
                      {target.target_expense > 0 && (
                        <>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mb-1">
                            <div className={`h-1 rounded-full transition-all ${totalExpense > target.target_expense ? 'bg-red-500' : expensePercent >= 80 ? 'bg-yellow-400' : 'bg-green-500'}`} style={{ width: `${expensePercent}%` }}></div>
                          </div>
                          <p className={`text-[8px] font-bold ${totalExpense > target.target_expense ? 'text-red-500 dark:text-red-400' : expensePercent >= 80 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                            {totalExpense > target.target_expense ? `Overbudget ${formatRupiah(totalExpense - target.target_expense)}` : expensePercent >= 80 ? `Peringatan! Hampir Habis (Sisa ${formatRupiah(target.target_expense - totalExpense)})` : `Aman (Sisa ${formatRupiah(target.target_expense - totalExpense)})`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <TargetSetupModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchData} showDialog={showDialog} existingTarget={selectedTarget} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}
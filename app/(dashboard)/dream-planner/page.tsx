'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Plus, Target, X, ArrowDownCircle, ArrowUpCircle, Edit3, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import UpdateGoalModal from '@/components/UpdateGoalModal';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import SkeletonLoader from '@/components/SkeletonLoader';
import DateField from '@/components/DateField';

export default function DreamPlannerPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [targetDisplay, setTargetDisplay] = useState('');
  const [targetRaw, setTargetRaw] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [goalHistory, setGoalHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info'|'success'|'danger', onConfirm: undefined as (()=>void)|undefined });
  const showDialog = (title: string, msg: string, type: 'info'|'success'|'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const router = useRouter();

  const fetchGoals = async () => {
    const { data } = await supabase.from('dream_goals').select('*').order('created_at', { ascending: false });
    if (data) setGoals(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchGoals(); }, []);

  const fetchHistory = async (goalId: string) => {
    const { data } = await supabase.from('goal_transactions').select('*').eq('goal_id', goalId).order('created_at', { ascending: false });
    if (data) setGoalHistory(data);
  };

  const handleCardClick = (goal: any) => {
    setSelectedGoal(goal); fetchHistory(goal.id); setIsDetailOpen(true);
  };

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) { setTargetDisplay(''); setTargetRaw(0); return; }
    setTargetRaw(Number(rawValue));
    setTargetDisplay(new Intl.NumberFormat('id-ID').format(Number(rawValue)));
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('dream_goals').insert({ user_id: session.user.id, title, target_amount: targetRaw, target_date: targetDate || null });
    setTitle(''); setTargetDisplay(''); setTargetRaw(0); setTargetDate(''); setIsModalOpen(false); fetchGoals();
  };

  const handleUpdateGoalAmount = async (amount: number, action: 'add' | 'subtract') => {
    if (!selectedGoal) return;
    let newAmount = Number(selectedGoal.current_amount);
    if (action === 'add') newAmount += amount; else newAmount = Math.max(0, newAmount - amount);
    await supabase.from('dream_goals').update({ current_amount: newAmount }).eq('id', selectedGoal.id);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('goal_transactions').insert({ goal_id: selectedGoal.id, user_id: session.user.id, amount: amount, type: action === 'add' ? 'in' : 'out' });
    }
    fetchGoals(); fetchHistory(selectedGoal.id); setSelectedGoal({ ...selectedGoal, current_amount: newAmount });
  };

  const handleDeleteGoal = (id: string) => {
    setDialog({ isOpen: true, title: 'Hapus?', msg: 'Target akan dihapus.', type: 'danger', onConfirm: async () => { await supabase.from('dream_goals').delete().eq('id', id); fetchGoals(); setIsDetailOpen(false); }});
  };

  const calculateDaysLeft = (dateString: string) => {
    if (!dateString) return null;
    const target = new Date(dateString); const today = new Date(); today.setHours(0,0,0,0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (isLoading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-24 transition-colors">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 transition-colors">
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-bold text-xl text-teal-800 dark:text-teal-400">Celengin.</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 mt-4 space-y-6">
        <div className="bg-gradient-to-r from-teal-500 to-teal-400 p-4 rounded-2xl text-white shadow-md">
          <p className="text-xs leading-relaxed"><Target className="w-4 h-4 inline mr-1" /> Rencanakan impianmu di sini. Klik kartu untuk melihat riwayat!</p>
        </div>

        <button onClick={() => setIsModalOpen(true)} className="w-full bg-white dark:bg-gray-800 border-2 border-dashed border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-teal-50 dark:hover:bg-gray-700 transition-all shadow-sm">
          <Plus className="w-5 h-5" /> Tambah Impian Baru
        </button>

        <div className="space-y-4">
          {goals.map(goal => {
            const percentage = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
            const daysLeft = calculateDaysLeft(goal.target_date);
            
            const remainingAmount = Math.max(0, goal.target_amount - goal.current_amount);
            const monthsLeft = daysLeft && daysLeft > 0 ? Math.max(1, Math.ceil(daysLeft / 30)) : 1;
            const monthlySaving = remainingAmount / monthsLeft;

            return (
              <div key={goal.id} onClick={() => handleCardClick(goal)} className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden cursor-pointer hover:border-teal-300 transition-all">
                <div className="flex items-center gap-4">
                  
                  {/* Ring Progress Bar */}
                  <div className="relative w-16 h-16 shrink-0">
                    <svg viewBox="0 0 80 80" className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="33" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100 dark:text-gray-700" />
                      <circle cx="40" cy="40" r="33" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${percentage * 2.0735} 207.35`} className={percentage >= 100 ? 'text-green-500' : 'text-teal-500'} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-800 dark:text-gray-100">{Math.round(percentage)}%</span>
                    </div>
                  </div>

                  {/* Detail Impian */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg truncate pr-2">{goal.title}</h3>
                      {daysLeft !== null && (
                        <span className="text-[9px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-md shrink-0">
                          H-{daysLeft < 0 ? 0 : daysLeft}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-teal-600 dark:text-teal-400 text-sm">{formatRupiah(goal.current_amount)}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {percentage >= 100 ? 'Target Tercapai! 🎉' : `Nabung ${formatRupiah(monthlySaving)}/bln dari ${formatRupiah(goal.target_amount)}`}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button onClick={(e) => { e.stopPropagation(); setSelectedGoal(goal); setIsUpdateModalOpen(true); }} className="flex-1 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 text-xs font-bold py-2 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-all">Nabung</button>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedGoal(goal); setIsUpdateModalOpen(true); }} className="flex-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">Kepake</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }} className="bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 px-3 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
          {goals.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center border border-gray-100 dark:border-gray-700 shadow-sm mt-4">
              <Target className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">Belum ada impian yang direncanakan.<br/>Yuk buat target pertamamu!</p>
            </div>
          )}
        </div>
      </main>

      {isDetailOpen && selectedGoal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative max-h-[80vh] flex flex-col transition-colors">
            <button onClick={() => setIsDetailOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1 text-center">{selectedGoal.title}</h2>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-4">Riwayat Tabungan</p>
            <div className="overflow-y-auto pr-1 space-y-2 flex-1">
              {goalHistory.length === 0 ? <p className="text-center text-xs text-gray-400 py-4">Belum ada riwayat nabung.</p> : 
                goalHistory.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${tx.type === 'in' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                        {tx.type === 'in' ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                      </div>
                      <div><p className="text-xs font-bold text-gray-800 dark:text-gray-100">{tx.type === 'in' ? 'Nabung' : 'Kepake'}</p><p className="text-[10px] text-gray-500 dark:text-gray-400">{new Date(tx.created_at).toLocaleDateString('id-ID')}</p></div>
                    </div>
                    <p className={`font-bold text-sm ${tx.type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{formatRupiah(tx.amount)}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">Tambah Impian</h2>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Impian</label>
                <input type="text" placeholder="Cth: Liburan ke Bali" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nominal</label>
                <input type="text" inputMode="numeric" placeholder="Nominal (Rp)" value={targetDisplay} onChange={handleTargetChange} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm font-bold" />
              </div>
              <DateField label="Kalender (target tercapai, opsional)" placeholder="Kalender" value={targetDate} onChange={setTargetDate} />
              <button type="submit" className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl mt-2">Simpan</button>
            </form>
          </div>
        </div>
      )}

      <UpdateGoalModal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} onSave={handleUpdateGoalAmount} goal={selectedGoal} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}
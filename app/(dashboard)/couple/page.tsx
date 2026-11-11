'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Heart, Plus, UserPlus, X, Edit3, Check, Mail, ArrowDownCircle, Calendar, Trash2, ArrowUpCircle, Users, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import SkeletonLoader from '@/components/SkeletonLoader';

export default function SharedSpacePage() {
  const [user, setUser] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterCategory, setFilterCategory] = useState<'all' | 'couple' | 'friend'>('all');
  const [showInfo, setShowInfo] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [targetDisplay, setTargetDisplay] = useState('');
  const [targetRaw, setTargetRaw] = useState(0);
  const [goalCategory, setGoalCategory] = useState<'couple' | 'friend'>('couple');

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [updateAmountDisplay, setUpdateAmountDisplay] = useState('');
  const [updateAmountRaw, setUpdateAmountRaw] = useState(0);
  const [updateAction, setUpdateAction] = useState<'in' | 'out'>('in');

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info'|'success'|'danger', onConfirm: undefined as (()=>void)|undefined });
  const showDialog = (title: string, msg: string, type: 'info'|'success'|'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const router = useRouter();

  const fetchSharedData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');
    setUser(session.user);

    const { data: invites } = await supabase.from('couple_members').select('*, couple_goals(title, created_by)').eq('user_id', session.user.id).eq('status', 'pending');
    if (invites) setPendingInvites(invites);

    const { data: acceptedMembers } = await supabase.from('couple_members').select('goal_id').eq('user_id', session.user.id).eq('status', 'accepted');
    const goalIds = acceptedMembers?.map((m: any) => m.goal_id) || [];

    const { data: myGoals } = await supabase.from('couple_goals').select('*').eq('created_by', session.user.id);

    let joinedGoals = [];
    if (goalIds.length > 0) {
      const { data } = await supabase.from('couple_goals').select('*').in('id', goalIds);
      if (data) joinedGoals = data;
    }

    const allGoals = [...(myGoals || []), ...(joinedGoals || [])];
    const uniqueGoals = Array.from(new Set(allGoals.map(g => g.id))).map(id => allGoals.find(g => g.id === id)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const finalGoals = [];
    for (const goal of uniqueGoals) {
      const { data: members } = await supabase.from('couple_members').select('id, user_id, status').eq('goal_id', goal.id).eq('status', 'accepted');
      const membersWithProfile = [];
      if (members) {
        for (const m of members) {
          const { data: profile } = await supabase.from('profiles').select('nickname, full_name').eq('id', m.user_id).maybeSingle();
          membersWithProfile.push({ ...m, profiles: profile });
        }
      }
      finalGoals.push({ ...goal, couple_members: membersWithProfile });
    }
    setGoals(finalGoals);
    setIsLoading(false);
  };

  useEffect(() => { fetchSharedData(); }, []);

  const fetchHistory = async (goalId: string) => {
    const { data: txs } = await supabase.from('couple_transactions').select('*').eq('goal_id', goalId).order('created_at', { ascending: false });
    if (txs) {
      const historyWithProfile = [];
      for (const tx of txs) {
        const { data: profile } = await supabase.from('profiles').select('nickname, full_name').eq('id', tx.user_id).maybeSingle();
        historyWithProfile.push({ ...tx, profiles: profile });
      }
      setHistoryData(historyWithProfile);
    } else { setHistoryData([]); }
    setIsHistoryOpen(true);
  };

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) { setTargetDisplay(''); setTargetRaw(0); return; }
    setTargetRaw(Number(rawValue));
    setTargetDisplay(new Intl.NumberFormat('id-ID').format(Number(rawValue)));
  };

  const handleUpdateAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) { setUpdateAmountDisplay(''); setUpdateAmountRaw(0); return; }
    setUpdateAmountRaw(Number(rawValue));
    setUpdateAmountDisplay(new Intl.NumberFormat('id-ID').format(Number(rawValue)));
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || targetRaw <= 0) return;
    const { data, error } = await supabase.from('couple_goals').insert({ title, target_amount: targetRaw, created_by: user.id, category: goalCategory }).select().single();
    if (!error && data) {
      await supabase.from('couple_members').insert({ goal_id: data.id, user_id: user.id, status: 'accepted' });
      setTitle(''); setTargetDisplay(''); setTargetRaw(0); setIsAddModalOpen(false); fetchSharedData();
    }
  };

  const handleUpdateAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (updateAmountRaw <= 0 || !selectedGoal) return;
    const newAmount = updateAction === 'in' ? Number(selectedGoal.current_amount) + updateAmountRaw : Math.max(0, Number(selectedGoal.current_amount) - updateAmountRaw);
    await supabase.from('couple_goals').update({ current_amount: newAmount }).eq('id', selectedGoal.id);
    await supabase.from('couple_transactions').insert({ goal_id: selectedGoal.id, user_id: user.id, amount: updateAmountRaw, type: updateAction });
    setIsUpdateModalOpen(false); setUpdateAmountDisplay(''); setUpdateAmountRaw(0); fetchSharedData();
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    const { data: targetProfile } = await supabase.rpc('get_user_id_by_email', { email_input: inviteEmail });
    if (!targetProfile) { setInviteLoading(false); return showDialog('Gagal', 'Email tidak ditemukan.', 'danger'); }
    const { error } = await supabase.from('couple_members').insert({ goal_id: selectedGoal.id, user_id: targetProfile, status: 'pending' });
    setInviteLoading(false);
    if (!error) { setIsInviteModalOpen(false); setInviteEmail(''); showDialog('Berhasil', 'Undangan terkirim!', 'success'); } 
    else { showDialog('Gagal', `Gagal mengundang: ${error.message}`, 'danger'); }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    const { error } = await supabase.from('couple_members').update({ status: 'accepted' }).eq('id', inviteId);
    if (!error) { closeDialog(); showDialog('Berhasil', 'Kamu bergabung!', 'success'); fetchSharedData(); }
  };

  const handleRejectInvite = async (inviteId: string) => {
    const { error } = await supabase.from('couple_members').delete().eq('id', inviteId);
    if (!error) { showDialog('Ditolak', 'Undangan ditolak.', 'info'); fetchSharedData(); }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (memberName === user.email) return; 
    showDialog('Keluarkan Anggota?', `Yakin keluarkan ${memberName}?`, 'danger', async () => {
      await supabase.from('couple_members').delete().eq('id', memberId);
      fetchSharedData();
    });
  };

  const filteredGoals = goals.filter(g => filterCategory === 'all' ? true : g.category === filterCategory);

  if (isLoading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-24 transition-colors">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-700 rounded-lg flex items-center justify-center text-white font-bold text-lg">C</div>
          <span className="font-bold text-xl text-teal-800 dark:text-teal-400">Celengin.</span>
        </div>
      </header>

      <main className="px-5 mt-4 space-y-5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bareng</h1>
            <Users className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 p-2.5 rounded-xl hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-all font-bold text-xs flex items-center gap-1"><Plus className="w-4 h-4" /> Buat</button>
        </div>

        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-2xl overflow-hidden transition-all duration-300">
          <button onClick={() => setShowInfo(!showInfo)} className="w-full flex items-center justify-between p-4 hover:bg-teal-100/50 dark:hover:bg-teal-900/40 transition-colors">
            <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-bold text-sm">
              <Info className="w-5 h-5 text-teal-600 dark:text-teal-400" /> Apa itu Bareng?
            </div>
            {showInfo ? <ChevronUp className="w-5 h-5 text-teal-600 dark:text-teal-400" /> : <ChevronDown className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
          </button>
          {showInfo && (
            <div className="px-4 pb-4 pt-0">
              <p className="text-[11px] text-teal-700/80 dark:text-teal-400/80 leading-relaxed pl-7">
                Buat target tabungan bersama pasangan (Couple) atau teman-temanmu (Grup). Kalian bisa nabung bareng, memantau siapa yang menabung, dan melihat riwayat transaksi secara transparan.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button onClick={() => setFilterCategory('all')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${filterCategory === 'all' ? 'bg-teal-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>Semua</button>
          <button onClick={() => setFilterCategory('couple')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${filterCategory === 'couple' ? 'bg-pink-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}><Heart className="w-3 h-3" /> Couple</button>
          <button onClick={() => setFilterCategory('friend')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${filterCategory === 'friend' ? 'bg-blue-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}><Users className="w-3 h-3" /> Teman</button>
        </div>

        {pendingInvites.length > 0 && (
          <div className="space-y-3 mb-4">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Undangan Masuk</p>
            {pendingInvites.map(invite => (
              <div key={invite.id} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-white dark:bg-gray-700 p-2 rounded-full shadow-sm"><Mail className="w-5 h-5 text-teal-600 dark:text-teal-400" /></div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">Kamu diundang ke target:</p>
                    <p className="font-bold text-gray-800 dark:text-white text-sm">{invite.couple_goals?.title}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAcceptInvite(invite.id)} className="flex-1 bg-teal-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-teal-700 transition-all"><Check className="w-4 h-4" /> Terima</button>
                  <button onClick={() => handleRejectInvite(invite.id)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all"><X className="w-4 h-4" /> Tolak</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {filteredGoals.map((goal) => {
            const percentage = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
            const members = goal.couple_members || [];
            const isCreator = goal.created_by === user.id;
            const isCouple = goal.category === 'couple';

            return (
              <div key={goal.id} className={`bg-white dark:bg-gray-800 p-5 rounded-3xl border shadow-sm relative overflow-hidden transition-colors ${isCouple ? 'border-pink-100 dark:border-pink-900/30' : 'border-blue-100 dark:border-blue-900/30'}`}>
                <div className={`absolute -right-4 -top-4 opacity-5 ${isCouple ? 'text-pink-500' : 'text-blue-500'}`}>{isCouple ? <Heart className="w-24 h-24" /> : <Users className="w-24 h-24" />}</div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${isCouple ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>{isCouple ? 'Couple' : 'Teman'}</span>
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mt-1">{goal.title}</h3>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isCouple ? 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/30' : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'}`}>{Math.round(percentage)}%</span>
                  </div>
                  
                  <div className="flex justify-between items-end mb-2">
                    <span className={`font-bold text-xl ${isCouple ? 'text-pink-600 dark:text-pink-400' : 'text-blue-600 dark:text-blue-400'}`}>{formatRupiah(goal.current_amount)}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">dari {formatRupiah(goal.target_amount)}</span>
                  </div>
                  
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mb-4 overflow-hidden">
                    <div className={`h-2 rounded-full ${isCouple ? 'bg-pink-500' : 'bg-blue-500'}`} style={{ width: `${percentage}%` }}></div>
                  </div>

                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Anggota:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((m: any) => {
                        const displayName = m.profiles?.nickname || m.profiles?.full_name || 'User';
                        return (
                          <div key={m.user_id} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-md">
                            <span className="text-[10px] text-gray-700 dark:text-gray-300 font-medium">{displayName}</span>
                            {isCreator && m.user_id !== user.id && (
                              <button onClick={() => handleRemoveMember(m.id, displayName)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 className="w-3 h-3" /></button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedGoal(goal); setIsUpdateModalOpen(true); }} className={`flex-1 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${isCouple ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/40' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`}><Edit3 className="w-4 h-4" /> Transaksi</button>
                    <button onClick={() => fetchHistory(goal.id)} className="flex-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"><Calendar className="w-4 h-4" /> Riwayat</button>
                    {isCreator && (
                      <button onClick={() => { setSelectedGoal(goal); setIsInviteModalOpen(true); }} className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 px-3 py-2.5 rounded-xl hover:border-teal-300 transition-all"><UserPlus className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredGoals.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center border border-gray-100 dark:border-gray-700 shadow-sm mt-4">
              <Users className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">Belum ada target barengan di kategori ini.</p>
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative max-h-[80vh] flex flex-col transition-colors">
            <button onClick={() => setIsHistoryOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">Riwayat Tabungan</h2>
            <div className="overflow-y-auto space-y-2 flex-1">
              {historyData.map(tx => {
                const actorName = tx.profiles?.nickname || tx.profiles?.full_name || 'Seseorang';
                const isIn = tx.type === 'in';
                return (
                  <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${isIn ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>{isIn ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}</div>
                      <div>
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{isIn ? 'Nabung' : 'Kepake'}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Oleh: <span className="font-semibold text-gray-700 dark:text-gray-200">{actorName}</span></p>
                        <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{new Date(tx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${isIn ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{isIn ? '+' : '-'}{formatRupiah(tx.amount)}</p>
                  </div>
                )
              })}
              {historyData.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Belum ada riwayat.</p>}
            </div>
          </div>
        </div>
      )}

      {isUpdateModalOpen && selectedGoal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setIsUpdateModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">Transaksi Bareng</h2>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setUpdateAction('in')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${updateAction === 'in' ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}><ArrowDownCircle className="w-4 h-4" /> Nabung</button>
              <button onClick={() => setUpdateAction('out')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${updateAction === 'out' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}><ArrowUpCircle className="w-4 h-4" /> Kepake</button>
            </div>
            <form onSubmit={handleUpdateAmount} className="space-y-4">
              <input type="text" inputMode="numeric" value={updateAmountDisplay} onChange={handleUpdateAmountChange} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-teal-500" placeholder="Nominal (Rp)" />
              <button type="submit" className={`w-full text-white font-bold py-3.5 rounded-xl mt-2 transition-all ${updateAction === 'in' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>Simpan Transaksi</button>
            </form>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">Buat Target Bareng</h2>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setGoalCategory('couple')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${goalCategory === 'couple' ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}><Heart className="w-4 h-4" /> Couple</button>
                <button type="button" onClick={() => setGoalCategory('friend')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${goalCategory === 'friend' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}><Users className="w-4 h-4" /> Teman</button>
              </div>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Cth: Liburan Bali" required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm" />
              <input type="text" inputMode="numeric" value={targetDisplay} onChange={handleTargetChange} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm font-bold" placeholder="Target Rp" />
              <button type="submit" className={`w-full text-white font-bold py-3.5 rounded-xl mt-2 transition-all ${goalCategory === 'couple' ? 'bg-pink-500 hover:bg-pink-600' : 'bg-blue-500 hover:bg-blue-600'}`}>Buat Target</button>
            </form>
          </div>
        </div>
      )}

      {isInviteModalOpen && selectedGoal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setIsInviteModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-2 text-gray-800 dark:text-white">Undang Anggota</h2>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-4">Masukkan email untuk bergabung ke target <span className="font-bold">{selectedGoal.title}</span>.</p>
            <form onSubmit={handleInvite} className="space-y-4">
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500" placeholder="email@contoh.com" />
              <button type="submit" disabled={inviteLoading} className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl mt-2 hover:bg-teal-700 transition-all disabled:opacity-50">{inviteLoading ? 'Mengundang...' : 'Kirim Undangan'}</button>
            </form>
          </div>
        </div>
      )}

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}
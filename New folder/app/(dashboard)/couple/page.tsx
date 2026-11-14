'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { pushInviteNow } from '@/lib/notifications';
import { useRouter } from 'next/navigation';
import { Heart, X, Check, Mail, ArrowDownCircle, ArrowUpCircle, Users, Info, CreditCard } from 'lucide-react';
import { formatRupiah, digitsOnly, noDigits } from '@/lib/utils';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SkeletonLoader from '@/components/SkeletonLoader';
import DateField from '@/components/DateField';
import { Btn, HeaderBtn, RowActions } from '@/components/ui';
import SegmentedControl from '@/components/SegmentedControl';
import { toLocalDateStr } from '@/lib/utils';

const BANKS = [
  "BCA", "Mandiri", "BRI", "BNI", "BSI", "BTN", "CIMB Niaga", "Permata", 
  "Danamon", "OCBC", "Panin", "Maybank", "UOB", "BJB", "DKI", "Jago", 
  "SeaBank", "Blu by BCA", "Jenius", "OVO", "GoPay", "DANA", "ShopeePay", "Lainnya"
];

// Cincin progres bundar: terisi pelan-pelan saat tampil dan setiap kali jumlahnya bertambah, persen di tengah.
function ProgressRing({ percent, color, size = 96 }: { percent: number; color: string; size?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(percent), 60);
    return () => clearTimeout(t);
  }, [percent]);
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-gray-100 dark:text-gray-700" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(shown, 100) / 100)} style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.34, 1.2, 0.64, 1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-xl font-extrabold text-gray-900 dark:text-white">{Math.round(percent)}%</span>
        <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-1">tercapai</span>
      </div>
    </div>
  );
}

// Ubah satu aturan rutin jadi nilai per bulan
const perMonth = (r: any): number => {
  const a = Number(r.amount) || 0;
  switch (r.frequency) {
    case 'daily': return a * 30.4;
    case 'weekly': return a * 4.345;
    case 'yearly': return a / 12;
    default: return a;
  }
};

export default function SharedSpacePage() {
  const [user, setUser] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterCategory, setFilterCategory] = useState<'all' | 'couple' | 'friend'>('all');

  // State Modal Form (Tambah / Edit)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = Tambah baru, ada isi = Edit
  
  const [title, setTitle] = useState('');
  const [targetDisplay, setTargetDisplay] = useState('');
  const [targetRaw, setTargetRaw] = useState(0);
  const [goalCategory, setGoalCategory] = useState<'couple' | 'friend'>('couple');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // Kemampuan menabung dari transaksi rutin milik sendiri (perkiraan)
  const [capacity, setCapacity] = useState<{ income: number; expense: number; hasRules: boolean }>({ income: 0, expense: 0, hasRules: false });
  const [estimate, setEstimate] = useState<any | null>(null);

  // State Modal Update Dana
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [updateAmountDisplay, setUpdateAmountDisplay] = useState('');
  const [updateAmountRaw, setUpdateAmountRaw] = useState(0);
  const [updateAction, setUpdateAction] = useState<'in' | 'out'>('in');

  // State Modal Invite
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  // State Riwayat
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);

  // Custom Dialog
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

    // Perkiraan kemampuan menabung: pemasukan rutin dikurangi pengeluaran rutin (hanya aturan milik sendiri)
    const { data: rules } = await supabase.from('recurring_rules').select('amount, type, frequency, is_active').eq('is_active', true);
    if (rules) {
      const income = rules.filter((r: any) => r.type === 'income').reduce((a: number, r: any) => a + perMonth(r), 0);
      const expense = rules.filter((r: any) => r.type !== 'income').reduce((a: number, r: any) => a + perMonth(r), 0);
      setCapacity({ income, expense, hasRules: rules.length > 0 });
    }
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

  // Buka Modal Form untuk Tambah
  const handleOpenAdd = () => {
    setEditingId(null);
    setTitle(''); setTargetDisplay(''); setTargetRaw(0); setGoalCategory('couple');
    setBankName(''); setAccountNumber(''); setAccountHolder(''); setTargetDate('');
    setIsFormModalOpen(true);
  };

  // Buka Modal Form untuk Edit
  const handleOpenEdit = (goal: any) => {
    setEditingId(goal.id);
    setTitle(goal.title);
    setTargetRaw(goal.target_amount);
    setTargetDisplay(new Intl.NumberFormat('id-ID').format(goal.target_amount));
    setGoalCategory(goal.category);
    setBankName(goal.bank_name || '');
    setAccountNumber(goal.account_number || '');
    setAccountHolder(goal.account_holder || '');
    setTargetDate(goal.target_date || '');
    setIsFormModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || targetRaw <= 0) return;

    const payload = {
      title,
      target_amount: targetRaw,
      category: goalCategory,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder: accountHolder,
      // Kolom target_date baru ada setelah SQL 11 dijalankan: hanya dikirim bila dipakai
      ...(targetDate ? { target_date: targetDate } : editingId ? { target_date: null } : {}),
    };

    if (editingId) {
      // Mode Edit
      const { error } = await supabase.from('couple_goals').update(payload).eq('id', editingId);
      if (error) return showDialog('Gagal', /target_date/.test(error.message) ? 'Kolom tanggal target belum ada. Jalankan sql/11_target_tanggal.sql di Supabase, lalu coba lagi.' : error.message, 'danger');
      showDialog('Berhasil', 'Target berhasil diperbarui!', 'success');
    } else {
      // Mode Tambah
      const { data, error } = await supabase.from('couple_goals').insert({ ...payload, created_by: user.id }).select().single();
      if (error) return showDialog('Gagal', /target_date/.test(error.message) ? 'Kolom tanggal target belum ada. Jalankan sql/11_target_tanggal.sql di Supabase, lalu coba lagi.' : error.message, 'danger');
      await supabase.from('couple_members').insert({ goal_id: data.id, user_id: user.id, status: 'accepted' });
      showDialog('Berhasil', 'Target berhasil dibuat!', 'success');
    }
    
    setIsFormModalOpen(false);
    fetchSharedData();
  };

  const handleDeleteGoal = (id: string) => {
    showDialog('Hapus Target?', 'Target ini akan dihapus permanen beserta riwayatnya.', 'danger', async () => {
      await supabase.from('couple_goals').delete().eq('id', id);
      fetchSharedData();
      // Dialog konfirmasi menutup dirinya setelah onConfirm, jadi dialog sukses ditunda sebentar
      setTimeout(() => showDialog('Berhasil', 'Target telah dihapus.', 'success'), 300);
    });
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
    // Target Pasangan hanya untuk dua orang: kamu dan satu orang lain (undangan yang masih menunggu juga dihitung)
    if (selectedGoal.category === 'couple') {
      const { count } = await supabase.from('couple_members').select('id', { count: 'exact', head: true }).eq('goal_id', selectedGoal.id);
      if ((count || 0) >= 2) { setInviteLoading(false); return showDialog('Sudah Penuh', 'Target Pasangan hanya untuk kamu dan satu orang. Pakai kategori Teman kalau ingin mengundang lebih banyak orang.', 'info'); }
    }
    const { data: targetProfile } = await supabase.rpc('get_user_id_by_email', { email_input: inviteEmail });
    if (!targetProfile) { setInviteLoading(false); return showDialog('Gagal', 'Email tidak ditemukan.', 'danger'); }
    const { error } = await supabase.from('couple_members').insert({ goal_id: selectedGoal.id, user_id: targetProfile, status: 'pending' });
    setInviteLoading(false);
    if (!error) { pushInviteNow(targetProfile as string); setIsInviteModalOpen(false); setInviteEmail(''); showDialog('Berhasil', 'Undangan terkirim!', 'success'); } 
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showDialog('Berhasil', 'Nomor rekening berhasil disalin!', 'success');
  };

  // Hitung perkiraan tabungan untuk satu target. new Date() hanya dipakai di sini (dipanggil saat ketuk), bukan saat render.
  const openEstimate = (goal: any) => {
    const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
    const n = Math.max((goal.couple_members || []).length, goal.category === 'couple' ? 2 : 1);
    const surplus = Math.max(0, capacity.income - capacity.expense);
    const today = toLocalDateStr(new Date());
    let monthsLeft: number | null = null;
    if (goal.target_date && goal.target_date > today) {
      const ms = new Date(goal.target_date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime();
      monthsLeft = Math.max(ms / 86400000 / 30.4, 0.1);
    }
    setEstimate({ goal, remaining, n, surplus, monthsLeft, today, dateOver: !!goal.target_date && goal.target_date <= today });
  };

  const filteredGoals = goals.filter(g => filterCategory === 'all' ? true : g.category === filterCategory);

  if (isLoading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-40 transition-colors">
      <AppHeader title="Kolektif" infoKey="Nabung Bareng" action={<HeaderBtn onClick={handleOpenAdd} />} />

      <main className="px-5 mt-4 space-y-5">
        <SegmentedControl
          value={filterCategory}
          onChange={setFilterCategory}
          options={[
            { value: 'all', label: 'Semua' },
            { value: 'couple', label: <><Heart className="w-3.5 h-3.5" /> Pasangan</> },
            { value: 'friend', label: <><Users className="w-3.5 h-3.5" /> Teman</> },
          ]}
        />

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
                  <Btn variant="primary" full onClick={() => handleAcceptInvite(invite.id)}>Terima</Btn>
                  <Btn variant="neutral" full onClick={() => handleRejectInvite(invite.id)}>Tolak</Btn>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {filteredGoals.map((goal) => {
            const percentage = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100);
            const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
            const members = goal.couple_members || [];
            const isCreator = goal.created_by === user.id;
            const isCouple = goal.category === 'couple';
            const tone = isCouple ? 'pink' : 'blue';
            const ringColor = isCouple ? '#ec4899' : '#3b82f6';
            const coupleFull = isCouple && members.length >= 2;

            return (
              <div key={goal.id} className={`bg-white dark:bg-gray-800 p-5 rounded-3xl border shadow-sm transition-colors ${isCouple ? 'border-pink-100 dark:border-pink-900/30' : 'border-blue-100 dark:border-blue-900/30'}`}>
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="min-w-0">
                    <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-lg ${isCouple ? 'bg-pink-500/10 text-pink-700 dark:text-pink-300' : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'}`}>{isCouple ? 'Pasangan' : 'Teman'}</span>
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-lg mt-1.5 truncate">{goal.title}</h3>
                  </div>
                  <button onClick={() => openEstimate(goal)} aria-label="Perkiraan menabung" className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-95 ${isCouple ? 'bg-pink-500/10 border-pink-500/30 text-pink-600' : 'bg-blue-500/10 border-blue-500/30 text-blue-600'}`}><Info className="w-4 h-4" /></button>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <ProgressRing percent={percentage} color={ringColor} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Terkumpul</p>
                    <p className={`font-extrabold text-xl ${isCouple ? 'text-pink-600 dark:text-pink-400' : 'text-blue-600 dark:text-blue-400'}`}>{formatRupiah(goal.current_amount)}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">dari {formatRupiah(goal.target_amount)}</p>
                    <p className="text-xs font-extrabold text-gray-800 dark:text-gray-100 mt-1.5">{remaining > 0 ? `Kurang ${formatRupiah(remaining)} lagi` : 'Target tercapai 🎉'}</p>
                    {goal.target_date && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Target: {goal.target_date}</p>}
                  </div>
                </div>

                {goal.bank_name && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-600 mb-3 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CreditCard className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-gray-800 dark:text-gray-200">{goal.bank_name}</p>
                        <p className="text-[11px] text-gray-600 dark:text-gray-300 font-mono truncate">{goal.account_number} <span className="text-[9px] font-sans">a/n {goal.account_holder}</span></p>
                      </div>
                    </div>
                    <Btn variant="soft" size="sm" onClick={() => copyToClipboard(goal.account_number)}>Salin</Btn>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Anggota {isCouple ? '(maks. 2 orang)' : `(${members.length})`}</p>
                  <div className="space-y-1.5">
                    {members.map((m: any) => {
                      const displayName = m.profiles?.nickname || m.profiles?.full_name || 'User';
                      return (
                        <div key={m.user_id} className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 pl-3 pr-1.5 py-1.5 rounded-xl">
                          <span className="text-xs text-gray-800 dark:text-gray-200 font-semibold truncate">{displayName}{m.user_id === user.id ? ' (kamu)' : ''}</span>
                          {isCreator && m.user_id !== user.id && <Btn variant="danger" size="sm" className="!min-h-[30px] !px-2.5" onClick={() => handleRemoveMember(m.id, displayName)}>Keluarkan</Btn>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={`grid gap-2 ${isCreator && !coupleFull ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <Btn variant={tone} onClick={() => { setSelectedGoal(goal); setUpdateAction('in'); setIsUpdateModalOpen(true); }}>Transaksi</Btn>
                  <Btn variant={tone} onClick={() => fetchHistory(goal.id)}>Riwayat</Btn>
                  {isCreator && !coupleFull && <Btn variant={tone} onClick={() => { setSelectedGoal(goal); setIsInviteModalOpen(true); }}>Undang</Btn>}
                </div>

                {isCreator && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                    <RowActions onEdit={() => handleOpenEdit(goal)} onDelete={() => handleDeleteGoal(goal.id)} />
                  </div>
                )}
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
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{isIn ? 'Uang masuk' : 'Uang keluar'}</p>
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
            <h2 className="text-lg font-bold text-center mb-1 text-gray-800 dark:text-white">Transaksi</h2>
            <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 mb-4 truncate">{selectedGoal.title}</p>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setUpdateAction('in')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${updateAction === 'in' ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}><ArrowDownCircle className="w-4 h-4" /> Uang Masuk</button>
              <button onClick={() => setUpdateAction('out')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${updateAction === 'out' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}><ArrowUpCircle className="w-4 h-4" /> Uang Keluar</button>
            </div>
            <form onSubmit={handleUpdateAmount} className="space-y-4">
              <input type="text" inputMode="numeric" value={updateAmountDisplay} onChange={handleUpdateAmountChange} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm font-bold focus:ring-2 focus:ring-teal-500" placeholder="Nominal (Rp)" />
              <Btn type="submit" variant={updateAction === 'in' ? 'success' : 'red'} size="md" full className="mt-2">Simpan Transaksi</Btn>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FORM (TAMBAH / EDIT) */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsFormModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">{editingId ? 'Edit Target Bareng' : 'Buat Target Bareng'}</h2>
            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setGoalCategory('couple')} className={`flex-1 py-2 rounded-[9px] text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${goalCategory === 'couple' ? 'btn-accent-line-pink' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}><Heart className="w-4 h-4" /> Pasangan</button>
                <button type="button" onClick={() => setGoalCategory('friend')} className={`flex-1 py-2 rounded-[9px] text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${goalCategory === 'friend' ? 'btn-accent-line-blue' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}><Users className="w-4 h-4" /> Teman</button>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Target</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Cth: Liburan Bali" required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target Dana</label>
                <input type="text" inputMode="numeric" value={targetDisplay} onChange={handleTargetChange} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm font-bold" placeholder="Target Rp" />
              </div>

              <div>
                <DateField label="Target tercapai pada (opsional)" placeholder="Belum ditentukan" value={targetDate} onChange={setTargetDate} />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Dipakai untuk menghitung berapa yang perlu disisihkan per bulan dan per minggu.</p>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 mb-2 uppercase">Info Rekening (Opsional)</p>
                <div className="space-y-2">
                  <select value={bankName} onChange={e => setBankName(e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm">
                    <option value="">Pilih Bank / E-Wallet</option>
                    {BANKS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                  </select>
                  <input type="text" inputMode="numeric" value={accountNumber} onChange={e => setAccountNumber(digitsOnly(e.target.value))} placeholder="Nomor Rekening" className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm" />
                  <input type="text" value={accountHolder} onChange={e => setAccountHolder(noDigits(e.target.value))} placeholder="Nama Pemilik Rekening" className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm" />
                </div>
              </div>

              <Btn type="submit" variant="primary" size="md" full className="mt-2">{editingId ? 'Simpan Perubahan' : 'Buat Target'}</Btn>
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
              <Btn type="submit" variant="primary" size="md" full className="mt-2" disabled={inviteLoading}>{inviteLoading ? 'Mengundang...' : 'Kirim Undangan'}</Btn>
            </form>
          </div>
        </div>
      )}

      {estimate && (() => {
        const e = estimate;
        const goalTone = e.goal.category === 'couple' ? 'text-pink-600 dark:text-pink-400' : 'text-blue-600 dark:text-blue-400';
        const perMonthNeed = e.monthsLeft ? e.remaining / Math.max(1, Math.ceil(e.monthsLeft)) : 0;
        const perWeekNeed = e.monthsLeft ? e.remaining / Math.max(1, Math.ceil(e.monthsLeft * 4.345)) : 0;
        const groupCapacity = e.surplus * e.n;
        const monthsAtCapacity = groupCapacity > 0 ? Math.ceil(e.remaining / groupCapacity) : null;
        const row = 'flex justify-between gap-3 text-xs py-1.5';
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative max-h-[85vh] overflow-y-auto transition-colors">
              <button onClick={() => setEstimate(null)} aria-label="Tutup" className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
              <h2 className="text-lg font-extrabold text-center text-gray-800 dark:text-white">Perkiraan Menabung</h2>
              <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 mb-4 truncate">{e.goal.title}</p>

              {e.remaining <= 0 ? (
                <p className="text-sm text-center font-bold text-green-600 dark:text-green-400 py-6">Target ini sudah tercapai 🎉</p>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-600">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Kurang</p>
                    <p className={`text-2xl font-extrabold ${goalTone}`}>{formatRupiah(e.remaining)}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">untuk {e.n} orang</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Kemampuan menabung (dari transaksi rutinmu)</p>
                    {capacity.hasRules ? (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        <div className={row}><span className="text-gray-600 dark:text-gray-300">Pemasukan rutin / bulan</span><span className="font-bold text-green-600 dark:text-green-400">{formatRupiah(Math.round(capacity.income))}</span></div>
                        <div className={row}><span className="text-gray-600 dark:text-gray-300">Pengeluaran rutin / bulan</span><span className="font-bold text-red-500">{formatRupiah(Math.round(capacity.expense))}</span></div>
                        <div className={row}><span className="font-bold text-gray-800 dark:text-gray-100">Bisa disisihkan / bulan</span><span className="font-extrabold text-gray-900 dark:text-white">{formatRupiah(Math.round(e.surplus))}</span></div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">Belum ada transaksi rutin. Isi dulu di Pengaturan, Transaksi Rutin (gaji, cicilan, langganan) supaya perkiraannya mendekati kenyataan.</p>
                    )}
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">Data rutin anggota lain tidak bisa dilihat, jadi dianggap sama dengan milikmu (rata-rata). Anggaplah ini angka kasar.</p>
                  </div>

                  {e.monthsLeft ? (
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Agar tercapai pada {e.goal.target_date}</p>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        <div className={row}><span className="text-gray-600 dark:text-gray-300">Sisihkan per bulan</span><span className="font-extrabold text-gray-900 dark:text-white">{formatRupiah(Math.ceil(perMonthNeed))}</span></div>
                        <div className={row}><span className="text-gray-600 dark:text-gray-300">Atau per minggu</span><span className="font-extrabold text-gray-900 dark:text-white">{formatRupiah(Math.ceil(perWeekNeed))}</span></div>
                        <div className={row}><span className="text-gray-600 dark:text-gray-300">Per orang / bulan</span><span className="font-bold text-gray-800 dark:text-gray-100">{formatRupiah(Math.ceil(perMonthNeed / e.n))}</span></div>
                      </div>
                      {groupCapacity > 0 && (
                        <p className={`text-[11px] font-bold mt-2 ${groupCapacity >= perMonthNeed ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                          {groupCapacity >= perMonthNeed ? 'Dengan kemampuan sekarang, target ini aman tercapai tepat waktu.' : 'Dengan kemampuan sekarang, target ini kemungkinan meleset dari tanggalnya. Coba majukan target atau tambah setoran.'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{e.dateOver ? 'Tanggal target sudah lewat. Pilihan waktu baru:' : 'Pilihan waktu (belum ada tanggal target)'}</p>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {[3, 6, 12].map((m) => (
                          <div key={m} className={row}><span className="text-gray-600 dark:text-gray-300">Selesai dalam {m} bulan</span><span className="font-bold text-gray-900 dark:text-white">{formatRupiah(Math.ceil(e.remaining / m))} / bln</span></div>
                        ))}
                      </div>
                      {monthsAtCapacity && <p className="text-[11px] font-bold mt-2 text-gray-700 dark:text-gray-200">Dengan kemampuan sekarang, kira-kira tercapai dalam {monthsAtCapacity} bulan.</p>}
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Isi tanggal target lewat tombol Ubah agar hitungannya pas.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}
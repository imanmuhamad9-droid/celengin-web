'use client';
import { useEffect, useState } from 'react';
import type { DreamGoal, GoalTx, Transaction, Profile } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Target, X, ArrowDownCircle, ArrowUpCircle, Info, Plus } from 'lucide-react';
import { formatRupiah, formatDateID, toLocalDateStr, errMsg } from '@/lib/utils';
import { cycleFor, shiftCycle, paydayRuleFrom } from '@/lib/cycle';
import UpdateGoalModal from '@/components/UpdateGoalModal';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import { useCatatAction } from '@/lib/catatAction';
import { Btn, RowActions } from '@/components/ui';
import SkeletonLoader from '@/components/SkeletonLoader';
import DateField from '@/components/DateField';


// Ikon impian ditebak dari namanya (tanpa perlu mengisi apa-apa)
const GOAL_EMOJI: [RegExp, string][] = [
  [/mobil|car|motor/i, '🚗'], [/rumah|house|kpr|tanah/i, '🏠'], [/liburan|travel|trip|jalan|bali|umroh|haji/i, '✈️'],
  [/darurat|emergency|dana/i, '🐷'], [/nikah|wedding|kawin/i, '💍'], [/hp|iphone|laptop|gadget|kamera/i, '📱'],
  [/kuliah|sekolah|studi|kursus/i, '🎓'], [/usaha|bisnis/i, '🏪'], [/anak|baby|bayi/i, '👶'],
];
const goalEmoji = (title: string) => GOAL_EMOJI.find(([re]) => re.test(title))?.[1] ?? '🎯';
const pctColor = (p: number, done: boolean) => (done ? '#22c55e' : p < 34 ? '#ec4899' : p < 67 ? '#0ea5e9' : '#6366f1');

export default function DreamPlannerPage() {
  // Referensi menabung: murni dari uangmu sendiri (rata-rata pemasukan dan pengeluaran bulanan dari transaksimu)
  const [cap, setCap] = useState<{ income: number; expense: number; months: number } | null>(null);
  const [estimate, setEstimate] = useState<{ goal: DreamGoal; daysLeft: number | null } | null>(null);

  const [goals, setGoals] = useState<DreamGoal[]>([]);
  const [title, setTitle] = useState('');
  const [targetDisplay, setTargetDisplay] = useState('');
  const [targetRaw, setTargetRaw] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<DreamGoal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);
  const [goalHistory, setGoalHistory] = useState<GoalTx[]>([]);
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

  // Rata-rata pemasukan/pengeluaran per periode gajian dari transaksimu sendiri.
  // Memakai maks. 3 periode gajian yang sudah selesai dan ada datanya; kalau belum ada, memakai periode berjalan.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      const payday = paydayRuleFrom(prof as Profile | null);
      const today = toLocalDateStr(new Date());
      const current = cycleFor(today, payday);
      const past = [shiftCycle(today, -1, payday)];
      past.push(shiftCycle(past[0].start, -1, payday));
      past.push(shiftCycle(past[1].start, -1, payday));
      const { data } = await supabase.from('transactions').select('amount, type, transaction_date').gte('transaction_date', past[2].start).lte('transaction_date', current.end);
      const txs = (data || []) as Pick<Transaction, 'amount' | 'type' | 'transaction_date'>[];
      const sum = (c: { start: string; end: string }) => {
        let i = 0, e = 0;
        for (const t of txs) {
          if (t.transaction_date < c.start || t.transaction_date > c.end) continue;
          if (t.type === 'income') i += Number(t.amount); else e += Number(t.amount);
        }
        return { i, e, has: i > 0 || e > 0 };
      };
      let used = past.map(sum).filter(x => x.has);
      if (used.length === 0) used = [sum(current)].filter(x => x.has);
      if (used.length === 0) { setCap({ income: 0, expense: 0, months: 0 }); return; }
      setCap({
        income: used.reduce((a, x) => a + x.i, 0) / used.length,
        expense: used.reduce((a, x) => a + x.e, 0) / used.length,
        months: used.length,
      });
    })();
  }, []);

  const openEstimate = (goal: DreamGoal) => {
    setEstimate({ goal, daysLeft: calculateDaysLeft(goal.target_date) });
  };

  const fetchHistory = async (goalId: string) => {
    const { data } = await supabase.from('goal_transactions').select('*').eq('goal_id', goalId).order('created_at', { ascending: false });
    if (data) setGoalHistory(data);
  };

  const handleCardClick = (goal: DreamGoal) => {
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
    // Saldo dan riwayat diubah dalam satu transaksi database (sql/05_atomik_dan_preferensi.sql)
    const { data, error } = await supabase.rpc('dream_deposit', { p_goal_id: selectedGoal.id, p_amount: amount, p_type: action === 'add' ? 'in' : 'out' });
    if (error) { setDialog({ isOpen: true, title: 'Gagal', msg: errMsg(error, 'Setoran gagal disimpan. Coba lagi.'), type: 'danger', onConfirm: undefined }); return; }
    const newAmount = Number(data);
    fetchGoals(); fetchHistory(selectedGoal.id); setSelectedGoal({ ...selectedGoal, current_amount: newAmount });
  };

  const handleDeleteGoal = (id: string) => {
    setDialog({ isOpen: true, title: 'Hapus?', msg: 'Target akan dihapus.', type: 'danger', onConfirm: async () => { await supabase.from('dream_goals').delete().eq('id', id); fetchGoals(); setIsDetailOpen(false); }});
  };

  const calculateDaysLeft = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    const target = new Date(dateString); const today = new Date(); today.setHours(0,0,0,0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  useCatatAction('Dream', 'Buat dream', () => setIsModalOpen(true));

  if (isLoading) return <div className="min-h-screen bg-[var(--page-bg)]"><SkeletonLoader /></div>;


  return (
    <div className="min-h-screen bg-[var(--page-bg)] pb-40 transition-colors">
      <AppHeader title="Dream" action={<button onClick={() => setIsModalOpen(true)} className="glass glass-solid-teal glass-pressable h-9 px-3.5 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap"><Plus className="w-4 h-4" /> Dream</button>} />

      <main className="max-w-md mx-auto px-5 mt-4 space-y-4">

        <section className="relative overflow-hidden rounded-3xl p-5 min-h-[150px] flex items-center" style={{ background: 'linear-gradient(135deg, #bae6fd 0%, #e0f2fe 55%, #ddd6fe 100%)' }}>
          <div className="relative z-10 max-w-[62%]">
            <h2 className="text-2xl font-extrabold leading-tight text-slate-900">Langkah kecil,<br /><span className="text-[color:var(--accent-text)]">Dream besar</span></h2>
            <p className="text-[11px] mt-2 text-slate-600">Tabung sedikit-sedikit, wujudkan satu per satu.</p>
          </div>
          <img src="/icon-dream.png" alt="" className="absolute right-2 bottom-0 h-[140px] w-auto object-contain select-none pointer-events-none" draggable={false} />
        </section>

        <div className="space-y-3">
          {goals.map(goal => {
            const percentage = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100);
            const daysLeft = calculateDaysLeft(goal.target_date);
            const remainingAmount = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
            const done = remainingAmount <= 0;
            const color = pctColor(percentage, done);
            const open = openGoalId === goal.id;

            return (
              <div key={goal.id} className="glass rounded-3xl p-4 shadow-sm transition-colors">
                <button type="button" onClick={() => setOpenGoalId(open ? null : goal.id)} aria-expanded={open} className="w-full flex items-start gap-3 text-left">
                  <span className="w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center text-3xl" style={{ background: 'var(--accent-tint)' }}>{goalEmoji(goal.title)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block font-extrabold text-base truncate" style={{ color: 'var(--text-main)' }}>{goal.title}</span>
                        <span className="block text-[11px] text-[color:var(--text-muted)]">Target {formatRupiah(goal.target_amount)}{daysLeft !== null ? ` · H-${daysLeft < 0 ? 0 : daysLeft}` : ''}</span>
                      </span>
                      <span className="text-lg font-extrabold shrink-0" style={{ color }}>{Math.round(percentage)}%</span>
                    </span>
                    <span className="block h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-2.5"><span className="block h-full rounded-full transition-all" style={{ width: `${percentage}%`, background: color }} /></span>
                    <span className="flex justify-between gap-2 mt-1.5 text-[11px]">
                      <span className="font-bold truncate" style={{ color: 'var(--text-main)' }}>{formatRupiah(goal.current_amount)} <span className="font-normal text-[color:var(--text-muted)]">terkumpul</span></span>
                      <span className="shrink-0 text-[color:var(--text-muted)]">{done ? 'Tercapai 🎉' : `${formatRupiah(remainingAmount)} lagi`}</span>
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="mt-3 pt-3 border-t border-black/[0.07] dark:border-white/10 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Btn variant="soft" onClick={() => { setSelectedGoal(goal); setIsUpdateModalOpen(true); }}>Catat Tabungan</Btn>
                      <Btn variant="soft" onClick={() => handleCardClick(goal)}>Riwayat</Btn>
                    </div>
                    <div className="flex items-center justify-between">
                      <button onClick={() => openEstimate(goal)} className="text-xs font-bold flex items-center gap-1 text-[color:var(--teal-primary)]"><Info className="w-4 h-4" /> Perkiraan menabung</button>
                      <RowActions onDelete={() => handleDeleteGoal(goal.id)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {goals.length === 0 && (
            <div className="glass rounded-3xl p-10 text-center border border-gray-100 dark:border-gray-700 shadow-sm mt-4">
              <Target className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">Belum ada impian yang direncanakan.<br/>Yuk buat target pertamamu!</p>
            </div>
          )}
        </div>
      </main>

      {estimate && (() => {
        const g = estimate.goal;
        const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount));
        const dl = estimate.daysLeft;
        const monthsLeft = dl !== null && dl > 0 ? dl / 30.4 : null;
        const perMonthNeed = monthsLeft ? remaining / Math.max(1, Math.ceil(monthsLeft)) : 0;
        const perWeekNeed = monthsLeft ? remaining / Math.max(1, Math.ceil(monthsLeft * 4.345)) : 0;
        const surplus = cap ? cap.income - cap.expense : 0;
        const monthsAtCapacity = surplus > 0 ? Math.ceil(remaining / surplus) : null;
        const row = 'flex justify-between gap-3 text-xs py-1.5';
        return (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-end justify-center">
            <div className="glass glass-sheet rounded-t-3xl rounded-b-none sheet-up w-full max-w-sm p-6 relative max-h-[85vh] overflow-y-auto transition-colors">
              <button onClick={() => setEstimate(null)} aria-label="Tutup" className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
              <h2 className="text-lg font-extrabold text-center text-gray-800 dark:text-white">Perkiraan Menabung</h2>
              <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 mb-4 truncate">{g.title}</p>

              {remaining <= 0 ? (
                <p className="text-sm text-center font-bold text-green-600 dark:text-green-400 py-6">Impian ini sudah tercapai 🎉</p>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-600">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Kurang</p>
                    <p className="text-2xl font-extrabold text-sky-600 dark:text-sky-400">{formatRupiah(remaining)}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Kemampuan menabung (dari transaksimu)</p>
                    {cap && cap.months > 0 ? (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        <div className={row}><span className="text-gray-600 dark:text-gray-300">Rata-rata masuk / periode gajian</span><span className="font-bold text-green-600 dark:text-green-400">{formatRupiah(Math.round(cap.income))}</span></div>
                        <div className={row}><span className="text-gray-600 dark:text-gray-300">Rata-rata keluar / periode gajian</span><span className="font-bold text-red-500">{formatRupiah(Math.round(cap.expense))}</span></div>
                        <div className={row}><span className="font-bold text-gray-800 dark:text-gray-100">Bisa disisihkan / periode gajian</span><span className="font-extrabold text-gray-900 dark:text-white">{surplus >= 0 ? formatRupiah(Math.round(surplus)) : `Minus ${formatRupiah(Math.round(-surplus))}`}</span></div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">Belum ada transaksi. Catat pemasukan dan pengeluaranmu dulu supaya perkiraannya mendekati kenyataan.</p>
                    )}
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">Murni dari uangmu sendiri, rata-rata {cap?.months || 0} periode gajian (sesuai tanggal gajianmu). Kalau punya beberapa impian, sisa uang ini dibagi di antara semuanya.</p>
                  </div>

                  {monthsLeft ? (
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Agar tercapai pada {formatDateID(g.target_date ?? "")}</p>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        <div className={row}><span className="text-gray-600 dark:text-gray-300">Sisihkan per bulan</span><span className="font-extrabold text-gray-900 dark:text-white">{formatRupiah(Math.ceil(perMonthNeed))}</span></div>
                        <div className={row}><span className="text-gray-600 dark:text-gray-300">Atau per minggu</span><span className="font-extrabold text-gray-900 dark:text-white">{formatRupiah(Math.ceil(perWeekNeed))}</span></div>
                      </div>
                      {cap && cap.months > 0 && (
                        <p className={`text-[11px] font-bold mt-2 ${surplus >= perMonthNeed ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                          {surplus >= perMonthNeed ? 'Dengan kemampuanmu sekarang, impian ini aman tercapai tepat waktu.' : 'Dengan kemampuanmu sekarang, impian ini kemungkinan meleset dari tanggalnya. Coba majukan target waktunya atau kurangi pengeluaran.'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{dl !== null ? 'Tanggal target sudah lewat. Pilihan waktu baru:' : 'Pilihan waktu (belum ada tanggal target)'}</p>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {[3, 6, 12].map((m) => (
                          <div key={m} className={row}><span className="text-gray-600 dark:text-gray-300">Selesai dalam {m} bulan</span><span className="font-bold text-gray-900 dark:text-white">{formatRupiah(Math.ceil(remaining / m))} / bln</span></div>
                        ))}
                      </div>
                      {monthsAtCapacity && <p className="text-[11px] font-bold mt-2 text-gray-700 dark:text-gray-200">Dengan kemampuanmu sekarang, kira-kira tercapai dalam {monthsAtCapacity} bulan.</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {isDetailOpen && selectedGoal && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end justify-center">
          <div className="glass glass-sheet rounded-t-3xl rounded-b-none sheet-up w-full max-w-sm p-6 relative max-h-[80vh] flex flex-col transition-colors">
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
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end justify-center">
          <div className="glass glass-sheet rounded-t-3xl rounded-b-none sheet-up w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">Dream Baru</h2>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Impian apa</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Butuh berapa</label>
                <input type="text" inputMode="numeric" value={targetDisplay} onChange={handleTargetChange} required className="w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm font-bold" />
              </div>
              <DateField label="Target tanggal (boleh dikosongkan)" value={targetDate} onChange={setTargetDate} />
              <button type="submit" className="glass glass-solid-teal w-full font-bold py-3 rounded-xl mt-2">Simpan</button>
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
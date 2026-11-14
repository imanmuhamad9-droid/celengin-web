'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Target, X, ArrowDownCircle, ArrowUpCircle, Info, TrendingUp } from 'lucide-react';
import { formatRupiah, formatDateID, toLocalDateStr } from '@/lib/utils';
import { cycleFor, shiftCycle, normalizePayday } from '@/lib/cycle';
import UpdateGoalModal from '@/components/UpdateGoalModal';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import { Btn, HeaderBtn, RowActions } from '@/components/ui';
import SkeletonLoader from '@/components/SkeletonLoader';
import DateField from '@/components/DateField';

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

export default function DreamPlannerPage() {
  // Referensi menabung: murni dari uangmu sendiri (rata-rata pemasukan dan pengeluaran bulanan dari transaksimu)
  const [cap, setCap] = useState<{ income: number; expense: number; months: number } | null>(null);
  const [estimate, setEstimate] = useState<{ goal: any; daysLeft: number | null } | null>(null);

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

  // Rata-rata pemasukan/pengeluaran per periode gajian dari transaksimu sendiri.
  // Memakai maks. 3 periode gajian yang sudah selesai dan ada datanya; kalau belum ada, memakai periode berjalan.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      const payday = normalizePayday((prof as any)?.payday);
      const today = toLocalDateStr(new Date());
      const current = cycleFor(today, payday);
      const past = [shiftCycle(today, -1, payday)];
      past.push(shiftCycle(past[0].start, -1, payday));
      past.push(shiftCycle(past[1].start, -1, payday));
      const { data } = await supabase.from('transactions').select('amount, type, transaction_date').gte('transaction_date', past[2].start).lte('transaction_date', current.end);
      const txs = (data || []) as any[];
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

  const openEstimate = (goal: any) => {
    setEstimate({ goal, daysLeft: calculateDaysLeft(goal.target_date) });
  };

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
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-40 transition-colors">
      <AppHeader title="Impian" action={<HeaderBtn onClick={() => setIsModalOpen(true)} />} />

      <main className="max-w-md mx-auto px-5 mt-4 space-y-4">

        {/* REFERENSI: kemampuan menabung dari uangmu sendiri */}
        {cap && (
          <div className="rounded-3xl p-4 bg-teal-500/10 dark:bg-teal-400/10 border border-teal-500/20 dark:border-teal-400/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <p className="text-[11px] font-extrabold text-teal-800 dark:text-teal-300 uppercase">Kemampuan menabungmu</p>
            </div>
            {cap.months === 0 ? (
              <p className="text-xs text-gray-600 dark:text-gray-300">Belum ada transaksi. Catat pemasukan dan pengeluaranmu dulu supaya saran menabung bisa dihitung dari uangmu sendiri.</p>
            ) : (
              <>
                <p className={`text-2xl font-extrabold ${cap.income - cap.expense >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-red-500'}`}>{formatRupiah(Math.round(Math.abs(cap.income - cap.expense)))}<span className="text-xs font-bold text-gray-500 dark:text-gray-400"> / periode gajian</span></p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">
                  {cap.income - cap.expense >= 0 ? 'Rata-rata sisa uangmu tiap periode gajian' : 'Rata-rata pengeluaranmu melebihi pemasukan tiap periode gajian'}, dihitung dari {cap.months} periode gajian transaksimu.
                </p>
              </>
            )}
          </div>
        )}

        <div className="space-y-4">
          {goals.map(goal => {
            const percentage = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100);
            const daysLeft = calculateDaysLeft(goal.target_date);
            const remainingAmount = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
            const done = remainingAmount <= 0;

            return (
              <div key={goal.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-teal-100 dark:border-teal-900/30 shadow-sm transition-colors">
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="min-w-0">
                    {daysLeft !== null && (
                      <span className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300">H-{daysLeft < 0 ? 0 : daysLeft}</span>
                    )}
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-lg mt-1.5 truncate">{goal.title}</h3>
                  </div>
                  <button onClick={() => openEstimate(goal)} aria-label="Perkiraan menabung" className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-95 bg-teal-500/10 border-teal-500/30 text-teal-600"><Info className="w-4 h-4" /></button>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <ProgressRing percent={percentage} color={done ? '#22c55e' : '#14b8a6'} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Terkumpul</p>
                    <p className="font-extrabold text-xl text-teal-600 dark:text-teal-400">{formatRupiah(goal.current_amount)}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">dari {formatRupiah(goal.target_amount)}</p>
                    <p className="text-xs font-extrabold text-gray-800 dark:text-gray-100 mt-1.5">{done ? 'Target tercapai 🎉' : `Kurang ${formatRupiah(remainingAmount)} lagi`}</p>
                    {goal.target_date && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Target: {formatDateID(goal.target_date)}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Btn variant="soft" onClick={() => { setSelectedGoal(goal); setIsUpdateModalOpen(true); }}>Catat Tabungan</Btn>
                  <Btn variant="soft" onClick={() => handleCardClick(goal)}>Riwayat</Btn>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                  <RowActions onDelete={() => handleDeleteGoal(goal.id)} />
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative max-h-[85vh] overflow-y-auto transition-colors">
              <button onClick={() => setEstimate(null)} aria-label="Tutup" className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
              <h2 className="text-lg font-extrabold text-center text-gray-800 dark:text-white">Perkiraan Menabung</h2>
              <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 mb-4 truncate">{g.title}</p>

              {remaining <= 0 ? (
                <p className="text-sm text-center font-bold text-green-600 dark:text-green-400 py-6">Impian ini sudah tercapai 🎉</p>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-600">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Kurang</p>
                    <p className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">{formatRupiah(remaining)}</p>
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
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Agar tercapai pada {formatDateID(g.target_date)}</p>
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
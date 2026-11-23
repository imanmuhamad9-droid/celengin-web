'use client';
import { useEffect, useState, useRef } from 'react';
import type { Transaction, Target, Bill, Profile } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { formatRupiah, toLocalDateStr } from '@/lib/utils';
import { diffDays } from '@/lib/recurring';
import { listWallets, Wallet, WalletTransfer } from '@/lib/wallets';
import WalletFormModal from '@/components/WalletFormModal';
import { fetchBadgeContext, syncBadges } from '@/lib/badges';
import TransactionModal from '@/components/TransactionModal';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import QuickMenu from '@/components/QuickMenu';
import NotificationBell, { LocalNotif } from '@/components/NotificationBell';
import AttentionStrip, { AttentionItem } from '@/components/AttentionStrip';
import PaydayPrompt from '@/components/PaydayPrompt';
import { cycleFor, paydayRuleFrom } from '@/lib/cycle';
import WeeklyChart from '@/components/WeeklyChart';
import { getRange } from '@/lib/insights';
import SkeletonLoader from '@/components/SkeletonLoader';
import HomeHeader from '@/components/home/HomeHeader';
import BalanceCard, { type DailyAllowance } from '@/components/home/BalanceCard';
import RecentTxCard from '@/components/home/RecentTxCard';
import StatsCard from '@/components/home/StatsCard';
import { ProfileModal, CategoryDetailModal, AllowanceInfoModal, StreakInfoModal } from '@/components/home/HomeModals';

export default function DashboardPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null); 
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletFormOpen, setWalletFormOpen] = useState(false);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const badgeSynced = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentMonthStr, setCurrentMonthStr] = useState('');
const [todayStr, setTodayStr] = useState('');
  const [last7Days, setLast7Days] = useState<string[]>([]);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
    // State Info Edukasi
  const [showInfoJatah, setShowInfoJatah] = useState(false);
  const [showInfoStreak, setShowInfoStreak] = useState(false);

  const [paydayLater, setPaydayLater] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryDetails, setCategoryDetails] = useState<Transaction[]>([]);

  const [detailTx, setDetailTx] = useState<Transaction | null>(null); // transaksi yang sedang dibuka detailnya

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType] = useState<'income' | 'expense'>('expense');
  const [txDate, setTxDate] = useState<string | undefined>(undefined);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info'|'success'|'danger', onConfirm: undefined as (()=>void)|undefined });
  const showDialog = (title: string, msg: string, type: 'info'|'success'|'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const router = useRouter();

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');
    setUser(session.user);

    const { data: txData } = await supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
    if (txData) setTransactions(txData);

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (profileData) setProfile(profileData);

    const { data: targetData } = await supabase.from('targets').select('*').eq('user_id', session.user.id);
    if (targetData) setTargets(targetData);

    // Tagihan aktif (kosong kalau tabel belum ada)
    const { data: billData } = await supabase.from('bills').select('*').eq('user_id', session.user.id).eq('is_active', true);
    setBills(billData || []);

    // Dompet (kosong kalau fitur Dompet belum diaktifkan)
    const walletList = await listWallets(session.user.id, true);
    setWallets(walletList);
    const { data: trData } = await supabase.from('wallet_transfers').select('*');
    setTransfers((trData || []) as WalletTransfer[]);

    // Cek pencapaian (badge) sekali per kunjungan
    if (!badgeSynced.current && txData) {
      badgeSynced.current = true;
      runBadgeSync(session.user.id, txData, targetData || []);
    }
    
    setIsLoading(false);
  };

  const runBadgeSync = async (uid: string, tx: Transaction[], tg: Target[]) => {
    try {
      const ctx = await fetchBadgeContext(uid, tx, tg);
      const res = await syncBadges(uid, ctx);
      if (res.fresh.length > 0) {
        const names = res.fresh.slice(0, 3).map(b => `${b.emoji} ${b.title}`).join('  ·  ');
        const more = res.fresh.length > 3 ? `  ·  +${res.fresh.length - 3} lainnya` : '';
        showDialog('Badge Baru! 🏅', names + more, 'success');
      }
    } catch { /* badge bersifat tambahan, abaikan error */ }
  };

  // Muat ulang data saat transaksi baru dicatat lewat tombol Catat di menu
  useEffect(() => {
    const onSaved = () => { fetchData(); };
    window.addEventListener('celengin:tx-saved', onSaved);
    return () => window.removeEventListener('celengin:tx-saved', onSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

     useEffect(() => { 
    // 1. Set Tanggal Hari Ini
    const now = new Date();
    const localToday = toLocalDateStr(now);
    setCurrentMonthStr(localToday.substring(0, 7));
    setTodayStr(localToday);


    // 3. Set Data 7 Hari Terakhir
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return toLocalDateStr(d);
    });
    setLast7Days(days);

    // 4. Ambil Data dari Database
    fetchData(); 
  }, []);

  const handleLogout = async () => {
    setIsProfileModalOpen(false); await supabase.auth.signOut(); router.push('/login');
  };

  // Simpan tanggal gajian. Kolom belum ada (SQL 08 belum dijalankan) -> beri petunjuk, jangan diam saja.
  const handleSavePayday = async (day: number) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ payday: day }).eq('id', user.id);
    if (error) { showDialog('Belum Bisa Disimpan', 'Jalankan sql/08_payday.sql di Supabase SQL Editor dulu, lalu coba lagi.', 'danger'); return; }
    setProfile((prev) => (prev ? { ...prev, payday: day } : prev));
  };

  const handleCategoryClick = (categoryName: string) => {
    const details = monthlyTx.filter(t => t.merchant_name === categoryName);
    setCategoryDetails(details);
    setSelectedCategory(categoryName);
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const walletInitialTotal = wallets.reduce((s, w) => s + (Number(w.initial_balance) || 0), 0);
  const balance = totalIncome - totalExpense + walletInitialTotal;

  // "Bulan ini" mengikuti siklus gajian (tanggal gajian 1 = bulan kalender biasa)
  const payday = paydayRuleFrom(profile);
  const cycle = todayStr ? cycleFor(todayStr, payday) : null;
  const monthlyTx = cycle
    ? transactions.filter(t => t.transaction_date >= cycle.start && t.transaction_date <= cycle.end)
    : transactions.filter(t => t.transaction_date.startsWith(currentMonthStr || '0000-00'));
  


  const weekRange = todayStr ? getRange('week', todayStr, payday) : null;
  const weeklyData = last7Days.map(date => {
    const dayTx = transactions.filter(t => t.transaction_date === date);
    const income = dayTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const expense = dayTx.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const dayName = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' });
    return { date, dayName, income, expense };
  });


  const activeWarnings = targets.filter(target => {
    if (target.target_expense <= 0) return false;
    const txsInPeriod = transactions.filter(t => t.transaction_date >= target.start_date && t.transaction_date <= target.end_date && t.type === 'expense');
    const totalExp = txsInPeriod.reduce((a, b) => a + Number(b.amount), 0);
    const percent = (totalExp / target.target_expense) * 100;
    return percent >= 80;
  }).map(target => {
    const txsInPeriod = transactions.filter(t => t.transaction_date >= target.start_date && t.transaction_date <= target.end_date && t.type === 'expense');
    const totalExp = txsInPeriod.reduce((a, b) => a + Number(b.amount), 0);
    return { ...target, totalExp, percent: (totalExp / target.target_expense) * 100, typeNotif: 'warning' };
  });

  const activePraise = targets.filter(target => {
    if (target.target_income <= 0) return false;
    const txsInPeriod = transactions.filter(t => t.transaction_date >= target.start_date && t.transaction_date <= target.end_date && t.type === 'income');
    const totalInc = txsInPeriod.reduce((a, b) => a + Number(b.amount), 0);
    return totalInc >= target.target_income;
  }).map(target => {
    const txsInPeriod = transactions.filter(t => t.transaction_date >= target.start_date && t.transaction_date <= target.end_date && t.type === 'income');
    const totalInc = txsInPeriod.reduce((a, b) => a + Number(b.amount), 0);
    return { ...target, totalInc, percent: (totalInc / target.target_income) * 100, typeNotif: 'praise' };
  });

  // Pengingat tagihan (H- sesuai pengaturan tiap tagihan)
  const dueBills = bills
    .filter(b => todayStr && diffDays(todayStr, b.due_date) <= (b.remind_days_before ?? 3))
    .map(b => ({ ...b, typeNotif: 'bill', daysLeft: diffDays(todayStr, b.due_date) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Pengingat yang tampil di lonceng (bagian "Pengingat"). key dibuat per hari supaya yang sudah ditutup muncul lagi esok hari.
  const localNotifs: LocalNotif[] = [
    ...dueBills.map((b): LocalNotif => {
      const urgent = b.daysLeft <= 0;
      const when = b.daysLeft < 0 ? `telat ${-b.daysLeft} hari` : b.daysLeft === 0 ? 'jatuh tempo hari ini' : b.daysLeft === 1 ? 'jatuh tempo besok' : `jatuh tempo ${b.daysLeft} hari lagi`;
      return {
        key: `bill-${b.id}-${todayStr}`,
        tone: urgent ? 'danger' : 'warning',
        icon: 'bill',
        title: 'Pengingat Tagihan',
        body: <><strong>{b.name}</strong> ({formatRupiah(b.amount)}) {when}.</>,
        href: '/bills',
      };
    }),
    ...activeWarnings.map((w): LocalNotif => {
      const crit = w.percent >= 90;
      return {
        key: `warn-${w.id}-${crit ? 'c' : 'w'}-${todayStr}`,
        tone: crit ? 'danger' : 'warning',
        icon: crit ? 'crit' : 'warn',
        title: crit ? 'Peringatan Kritis!' : 'Peringatan Belanja',
        body: <>Tantangan <strong className="capitalize">{w.period_type}</strong> terpakai {Math.round(w.percent)}%.</>,
        href: '/spending-challenge',
      };
    }),
    ...activePraise.map((p): LocalNotif => ({
      key: `praise-${p.id}-${p.end_date}`,
      tone: 'praise',
      icon: 'praise',
      title: 'Tantangan Tercapai! 🎉',
      body: <>Pemasukan target <strong className="capitalize">{p.period_type}</strong> tercapai ({Math.round(p.percent)}%).</>,
      href: '/spending-challenge',
    })),
  ];

    // LOGIKA JATAH HARIAN (Patokan Tetap)
  const primaryTarget = targets.find(t => t.is_primary === true);
  
  let dailyAllowance = 0;
  let jatahHariIni = 0;

  if (primaryTarget) {
    // 1. Hitung total hari dalam periode target
    const startDate = new Date(primaryTarget.start_date);
    const endDate = new Date(primaryTarget.end_date);
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // 2. Patokan Harian = Total Budget Target / Total Hari
    dailyAllowance = primaryTarget.target_expense / totalDays;

    // 3. Hitung pengeluaran hari ini
    // Hapus baris di atas, karena kita sudah punya state todayStr
// (Cukup hapus saja baris ini)
    const todayExpense = transactions.filter(t => t.transaction_date === todayStr && t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
    
    // 4. Jatah Hari Ini = Patokan Harian - Yang sudah dipakai hari ini
    jatahHariIni = Math.max(0, dailyAllowance - todayExpense);
  }

  let streak = 0;
  if (dailyAllowance > 0) {
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = toLocalDateStr(d);
      const dailyExp = transactions.filter(t => t.transaction_date === dStr && t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
      if (dailyExp <= dailyAllowance) streak++;
      else break;
    }
  }


  // ---- Data untuk Home yang lebih ringkas ----
  const todayExpenseAmt = transactions.filter(t => t.transaction_date === todayStr && t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
  let targetUsedPct = 0; // persen pengeluaran target utama yang sudah terpakai
  if (primaryTarget && primaryTarget.target_expense > 0) {
    const used = transactions
      .filter(t => t.type === 'expense' && t.transaction_date >= primaryTarget.start_date && t.transaction_date <= primaryTarget.end_date)
      .reduce((a, b) => a + Number(b.amount), 0);
    targetUsedPct = Math.round((used / primaryTarget.target_expense) * 100);
  }

  const attentionItems: AttentionItem[] = [
    ...dueBills.slice(0, 4).map((b): AttentionItem => ({
      key: `b-${b.id}`,
      tone: b.daysLeft <= 0 ? 'danger' : 'warning',
      kind: 'bill',
      title: b.name,
      sub: `${formatRupiah(b.amount)} · ${b.daysLeft < 0 ? `telat ${-b.daysLeft} hari` : b.daysLeft === 0 ? 'hari ini' : b.daysLeft === 1 ? 'besok' : `${b.daysLeft} hari lagi`}`,
      href: '/bills',
    })),
    ...activeWarnings.slice(0, 2).map((w): AttentionItem => ({
      key: `w-${w.id}`,
      tone: w.percent >= 90 ? 'danger' : 'warning',
      kind: 'target',
      title: `Tantangan ${w.period_type} ${Math.round(w.percent)}%`,
      sub: w.percent >= 100 ? 'Sudah melewati batas' : 'Hampir habis',
      href: '/spending-challenge',
    })),
    ...activePraise.slice(0, 1).map((p): AttentionItem => ({
      key: `p-${p.id}`,
      tone: 'praise',
      kind: 'praise',
      title: 'Tantangan tercapai',
      sub: `Pemasukan ${p.period_type} ${Math.round(p.percent)}%`,
      href: '/spending-challenge',
    })),
  ];

  const recentTx = transactions.slice(0, 5);

  

  if (isLoading || !currentMonthStr) return (
    <div className="min-h-screen bg-[var(--page-bg)]"><SkeletonLoader /></div>
  );

  const displayName = profile?.nickname || profile?.full_name || user?.email?.split('@')[0];
  const allowance: DailyAllowance | null = primaryTarget
    ? { perDay: dailyAllowance, left: jatahHariIni, spentToday: todayExpenseAmt, targetUsedPct }
    : null;

  return (
    <div className="min-h-screen bg-[var(--page-bg)] pb-40 transition-colors">
      <HomeHeader
        name={displayName ?? ''}
        avatarUrl={profile?.avatar_url}
        onAvatarClick={() => setIsProfileModalOpen(true)}
        bell={<NotificationBell userId={user?.id ?? null} local={localNotifs} />}
        streak={streak}
        showStreak={dailyAllowance > 0}
        onStreakClick={() => setShowInfoStreak(true)}
      />

      {/* Urutan kotak di Home: pindahkan baris di bawah untuk menata ulang */}
      <main className="px-5 mt-4 space-y-4">
        <BalanceCard
          profile={profile}
          balance={balance}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          hidden={isBalanceHidden}
          onToggleHidden={() => setIsBalanceHidden((v) => !v)}
          allowance={allowance}
          onInfoAllowance={() => setShowInfoJatah(true)}
          wallets={wallets}
          transactions={transactions}
          transfers={transfers}
          onAddWallet={() => setWalletFormOpen(true)}
        />

        {/* Perlu perhatian (hilang bila kosong) */}
        <AttentionStrip items={attentionItems} />

        {/* Pertanyaan tanggal gajian: sekali saja, hanya bila kolom payday sudah ada dan belum diisi */}
        {profile && 'payday' in profile && profile.payday == null && !paydayLater && (
          <PaydayPrompt onPick={handleSavePayday} onLater={() => setPaydayLater(true)} />
        )}

        <WeeklyChart
          days={weeklyData}
          rangeLabel={last7Days.length > 0 ? `${new Date(last7Days[0] + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(last7Days[6] + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}
        />

        {/* Menu cepat (hilang bila tidak ada menu aktif) */}
        <QuickMenu />

        <RecentTxCard transactions={recentTx} onSelect={setDetailTx} />

        <StatsCard
          monthlyTx={monthlyTx}
          allTx={transactions}
          weekRange={weekRange}
          cycleLabel={cycle?.label ?? null}
          cycleBased={payday.day > 1}
          onCategoryClick={handleCategoryClick}
        />
      </main>

      {isProfileModalOpen && (
        <ProfileModal
          profile={profile}
          displayName={displayName}
          onClose={() => setIsProfileModalOpen(false)}
          onSettings={() => { setIsProfileModalOpen(false); router.push('/settings'); }}
          onLogout={() => { setIsProfileModalOpen(false); showDialog('Keluar dari Celengin?', 'Kamu perlu masuk lagi nanti untuk membuka akunmu.', 'danger', handleLogout); }}
        />
      )}
      {selectedCategory && <CategoryDetailModal name={selectedCategory} transactions={categoryDetails} onClose={() => setSelectedCategory(null)} />}
      {showInfoJatah && <AllowanceInfoModal onClose={() => setShowInfoJatah(false)} />}
      {showInfoStreak && <StreakInfoModal onClose={() => setShowInfoStreak(false)} />}

      {user && <WalletFormModal isOpen={walletFormOpen} onClose={() => setWalletFormOpen(false)} userId={user.id} wallet={null} currentDefaultId={wallets.find((w) => w.is_default)?.id ?? null} onSaved={() => fetchData()} showDialog={showDialog} />}
      <TransactionDetailModal tx={detailTx} onClose={() => setDetailTx(null)} />
      <TransactionModal isOpen={isTxModalOpen} onClose={() => { setIsTxModalOpen(false); setTxDate(undefined); }} onSuccess={() => fetchData()} showDialog={showDialog} initialType={txType} initialDate={txDate} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}

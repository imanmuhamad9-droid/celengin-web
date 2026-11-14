'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { User, X, LogOut, Settings, Eye, EyeOff, CalendarDays, Flame, Info, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, StickyNote } from 'lucide-react';
import { formatRupiah, toLocalDateStr } from '@/lib/utils';
import { diffDays } from '@/lib/recurring';
import { listWallets, computeWalletBalances, Wallet, WalletTransfer } from '@/lib/wallets';
import { fetchBadgeContext, syncBadges } from '@/lib/badges';
import TransactionModal from '@/components/TransactionModal';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import NotificationBell, { LocalNotif } from '@/components/NotificationBell';
import AttentionStrip, { AttentionItem } from '@/components/AttentionStrip';
import PaydayPrompt from '@/components/PaydayPrompt';
import SectionToggle from '@/components/SectionToggle';
import { cycleFor, normalizePayday } from '@/lib/cycle';
import WeeklyChart from '@/components/WeeklyChart';
import { getRange } from '@/lib/insights';
import SkeletonLoader from '@/components/SkeletonLoader';
import EditTransactionModal from '@/components/EditTransactionModal';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null); 
  const [transactions, setTransactions] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const badgeSynced = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentMonthStr, setCurrentMonthStr] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(0);
const [calendarYear, setCalendarYear] = useState(2024);
const [todayStr, setTodayStr] = useState('');
  const [maxDateStr, setMaxDateStr] = useState('');
  const [last7Days, setLast7Days] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
    // State Info Edukasi
  const [showInfoJatah, setShowInfoJatah] = useState(false);
  const [showInfoStreak, setShowInfoStreak] = useState(false);

  // State untuk Kalender
  const [calendarView, setCalendarView] = useState<'expense' | 'income' | 'all'>('expense');
  const [showCalendar, setShowCalendar] = useState(true);
  const [greeting, setGreeting] = useState('Halo');
  const [paydayLater, setPaydayLater] = useState(false);
  const [showRecent, setShowRecent] = useState(true); // Daftar Transaksi tampil langsung
  const [showMonth, setShowMonth] = useState(false); // lipatan Statistik
  const [statsView, setStatsView] = useState<'week' | 'month'>('month');

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryDetails, setCategoryDetails] = useState<any[]>([]);

  const [detailTx, setDetailTx] = useState<any>(null); // transaksi yang sedang dibuka detailnya
  const [editTx, setEditTx] = useState<any>(null); // transaksi yang sedang diubah (tombol Ubah)
  const [isEditTxOpen, setIsEditTxOpen] = useState(false);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
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

    // Dompet + transfer (kosong kalau fitur Dompet belum diaktifkan)
    const walletList = await listWallets(session.user.id, true);
    setWallets(walletList);
    if (walletList.length > 0) {
      const { data: trData } = await supabase.from('wallet_transfers').select('*');
      setTransfers((trData || []) as WalletTransfer[]);
    }

    // Cek pencapaian (badge) sekali per kunjungan
    if (!badgeSynced.current && txData) {
      badgeSynced.current = true;
      runBadgeSync(session.user.id, txData, targetData || []);
    }
    
    setIsLoading(false);
  };

  const runBadgeSync = async (uid: string, tx: any[], tg: any[]) => {
    try {
      const ctx = await fetchBadgeContext(uid, tx, tg);
      const res = await syncBadges(uid, ctx);
      if (res.fresh.length > 0) {
        const names = res.fresh.slice(0, 3).map(b => `${b.emoji} ${b.title}`).join('  ·  ');
        const more = res.fresh.length > 3 ? `  ·  +${res.fresh.length - 3} lainnya` : '';
        showDialog('Badge Baru! 🏅', names + more, 'success');
      }
    } catch (_) { /* badge bersifat tambahan, abaikan error */ }
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
    const h = now.getHours();
    setGreeting(h < 11 ? 'Pagi' : h < 15 ? 'Siang' : h < 18 ? 'Sore' : 'Malam');
    setMaxDateStr(localToday);

    // 2. Set Bulan & Tahun untuk Kalender
    setCalendarMonth(now.getMonth());
    setCalendarYear(now.getFullYear());

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
  // Hapus transaksi dari daftar Beranda: dialog + query yang sama dengan halaman Riwayat
  const handleDeleteTx = (id: string) => {
    showDialog('Hapus Transaksi?', 'Data ini akan dihapus permanen.', 'danger', async () => {
      await supabase.from('transactions').delete().eq('id', id);
      fetchData();
    });
  };

  const handleSavePayday = async (day: number) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ payday: day }).eq('id', user.id);
    if (error) { showDialog('Belum Bisa Disimpan', 'Jalankan sql/08_payday.sql di Supabase SQL Editor dulu, lalu coba lagi.', 'danger'); return; }
    setProfile((prev: any) => ({ ...prev, payday: day }));
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
  const walletCalc = computeWalletBalances(wallets, transactions, transfers);

  // "Bulan ini" mengikuti siklus gajian (tanggal gajian 1 = bulan kalender biasa)
  const payday = normalizePayday(profile?.payday);
  const cycle = todayStr ? cycleFor(todayStr, payday) : null;
  const monthlyTx = cycle
    ? transactions.filter(t => t.transaction_date >= cycle.start && t.transaction_date <= cycle.end)
    : transactions.filter(t => t.transaction_date.startsWith(currentMonthStr || '0000-00'));
  const monthlyIncome = monthlyTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const monthlyExpense = monthlyTx.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  const incomeCategories = monthlyTx.filter(t => t.type === 'income').reduce((acc: any, curr) => { acc[curr.merchant_name] = (acc[curr.merchant_name] || 0) + Number(curr.amount); return acc; }, {});
  const expenseCategories = monthlyTx.filter(t => t.type === 'expense').reduce((acc: any, curr) => { acc[curr.merchant_name] = (acc[curr.merchant_name] || 0) + Number(curr.amount); return acc; }, {});

  const totalMonthly = monthlyIncome + monthlyExpense;

  // Statistik bisa dilihat per minggu (Senin-Minggu) atau per bulan/siklus gajian. Logika bulanan tidak berubah.
  const weekRange = todayStr ? getRange('week', todayStr, payday) : null;
  const statsTx = statsView === 'week' && weekRange
    ? transactions.filter(t => t.transaction_date >= weekRange.start && t.transaction_date <= weekRange.end)
    : monthlyTx;
  const sIncome = statsTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const sExpense = statsTx.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const sIncomeCats = statsTx.filter(t => t.type === 'income').reduce((acc: any, curr) => { acc[curr.merchant_name] = (acc[curr.merchant_name] || 0) + Number(curr.amount); return acc; }, {});
  const sExpenseCats = statsTx.filter(t => t.type === 'expense').reduce((acc: any, curr) => { acc[curr.merchant_name] = (acc[curr.merchant_name] || 0) + Number(curr.amount); return acc; }, {});
  const sTotal = sIncome + sExpense;

  const weeklyData = last7Days.map(date => {
    const dayTx = transactions.filter(t => t.transaction_date === date);
    const income = dayTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const expense = dayTx.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const dayName = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' });
    return { date, dayName, income, expense };
  });

  const maxWeeklyValue = Math.max(...weeklyData.map(d => Math.max(d.income, d.expense)), 10000);

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

  const currentYear = calendarYear;
const currentMonth = calendarMonth;
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
    const dayStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
    const exp = transactions.filter(t => t.transaction_date === dayStr && t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
    return { day: i+1, dateStr: dayStr, expense: exp };
  });
  
  // Perhitungan kalender
  const maxDailyIncome = Math.max(1, ...daysArray.map(d => transactions.filter(t => t.transaction_date === d.dateStr && t.type === 'income').reduce((a, b) => a + Number(b.amount), 0)));
  const maxDailyExpense = Math.max(1, ...daysArray.map(d => d.expense));
  const mostExpensiveDay = daysArray.reduce((prev, current) => (prev.expense > current.expense) ? prev : current, daysArray[0]);

  if (isLoading || !currentMonthStr) return (
    <div className="min-h-screen bg-[var(--bg-main)]"><SkeletonLoader /></div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-40 transition-colors">
      <AppHeader
        topRight={<NotificationBell userId={user?.id ?? null} local={localNotifs} />}
        onAvatarClick={() => setIsProfileModalOpen(true)}
      />

      <main className="px-5 mt-4 space-y-4">

        {/* SAPAAN + STREAK + PROFIL */}
        <div className="flex justify-between items-center">
          <div className="min-w-0">
            <p className="text-sm text-gray-500 dark:text-gray-400">Selamat Datang 👋</p>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white truncate leading-tight">{profile?.nickname || profile?.full_name || user?.email?.split('@')[0]}</h2>
            {todayStr && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{new Date(todayStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {dailyAllowance > 0 && (
              <button onClick={() => setShowInfoStreak(true)} aria-label="Streak hemat" className="glass glass-teal flex items-center gap-1 border text-xs font-bold px-2.5 py-1.5 rounded-full active:scale-95 transition-transform">
                <Flame className="w-3.5 h-3.5" /> {streak}
              </button>
            )}
          </div>
        </div>

        {/* 1) KOTAK RINGKASAN KEUANGAN (Liquid Glass; latar kartu kustom dari profil tetap dipakai di bawah kaca) */}
        <GlassCard padded={false} className="relative overflow-hidden">
          {profile?.safe_limit && profile?.bg_safe_url && (
            <div className="absolute inset-0 z-0" style={{ backgroundImage: balance >= profile.safe_limit ? `url(${profile.bg_safe_url})` : `url(${profile.bg_low_url})`, backgroundSize: balance >= profile.safe_limit ? `${(profile.bg_safe_zoom || 1) * 100}%` : `${(profile.bg_low_zoom || 1) * 100}%`, backgroundPosition: balance >= profile.safe_limit ? (profile.bg_safe_pos || 'center') : (profile.bg_low_pos || 'center'), backgroundRepeat: 'no-repeat' }}></div>
          )}
          {profile?.safe_limit && profile?.bg_safe_url && <div className="absolute inset-0 z-0 bg-white/60 dark:bg-black/50"></div>}

          <div className="relative z-10 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-semibold text-[color:var(--text-muted)]">Uang Sisa</p>
                  <GlassButton size="icon" onClick={() => setIsBalanceHidden(!isBalanceHidden)} aria-label={isBalanceHidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'} className="!w-7 !h-7 text-[color:var(--text-muted)]">
                    {isBalanceHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </GlassButton>
                </div>
                <h3 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-main)' }}>{isBalanceHidden ? 'Rp ******' : formatRupiah(balance)}</h3>
              </div>
              {profile?.safe_limit && (
                <span className={`glass shrink-0 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${balance >= profile.safe_limit ? 'glass-teal' : 'glass-danger'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                  {balance >= profile.safe_limit ? 'Aman' : 'Krisis'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <div className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <p className="text-[11px] font-semibold flex items-center gap-1 text-[color:var(--text-muted)]"><ArrowDownLeft className="w-3.5 h-3.5" /> Uang Masuk</p>
                <p className="text-sm font-extrabold mt-0.5" style={{ color: 'var(--text-main)' }}>{isBalanceHidden ? 'Rp ***' : formatRupiah(totalIncome)}</p>
              </div>
              <div className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <p className="text-[11px] font-semibold flex items-center gap-1 text-[color:var(--text-muted)]"><ArrowUpRight className="w-3.5 h-3.5" /> Uang Keluar</p>
                <p className="text-sm font-extrabold mt-0.5" style={{ color: 'var(--text-main)' }}>{isBalanceHidden ? 'Rp ***' : formatRupiah(totalExpense)}</p>
              </div>
            </div>

            {/* Pengeluaran yang diperbolehkan hari ini */}
            {primaryTarget ? (
              <button onClick={() => setShowInfoJatah(true)} className="glass-pressable mt-3 w-full rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-left bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[color:var(--text-muted)]">Boleh dipakai hari ini</p>
                  <p className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-main)' }}>{isBalanceHidden ? 'Rp ***' : formatRupiah(jatahHariIni)}</p>
                  <p className="text-[11px] text-[color:var(--text-muted)]">
                    {todayExpenseAmt > dailyAllowance ? `Jatah habis, lewat ${formatRupiah(todayExpenseAmt - dailyAllowance)}` : jatahHariIni < dailyAllowance * 0.25 ? 'Jatah tinggal sedikit' : `Dari jatah ${formatRupiah(dailyAllowance)} per hari`} · target bulan ini {targetUsedPct}%
                  </p>
                </div>
                {todayExpenseAmt > dailyAllowance ? <AlertCircle className="w-6 h-6 shrink-0 text-[color:var(--text-muted)]" /> : <CheckCircle2 className="w-6 h-6 shrink-0 text-[color:var(--teal-primary)]" />}
              </button>
            ) : (
              <button onClick={() => router.push('/spending-challenge')} className="glass-pressable mt-3 w-full rounded-2xl px-4 py-3 flex items-center justify-between text-left bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Atur tantangan utama</p>
                  <p className="text-[11px] text-[color:var(--text-muted)]">Biar kamu tahu boleh jajan berapa tiap hari</p>
                </div>
                <ChevronRight className="w-5 h-5 shrink-0 text-[color:var(--text-muted)]" />
              </button>
            )}
          </div>
        </GlassCard>

        {/* PINTASAN (chip) */}

        {/* PERLU PERHATIAN (hilang bila kosong) */}
        <AttentionStrip items={attentionItems} />

        {/* Pertanyaan tanggal gajian: sekali saja, hanya bila kolom payday sudah ada dan belum diisi */}
        {profile && 'payday' in profile && profile.payday == null && !paydayLater && (
          <PaydayPrompt onPick={handleSavePayday} onLater={() => setPaydayLater(true)} />
        )}

        {/* MINGGU INI */}
        <div>
          <WeeklyChart
            days={weeklyData}
            rangeLabel={last7Days.length > 0 ? `${new Date(last7Days[0] + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(last7Days[6] + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}
          />
        </div>

        {/* 3) CARD DAFTAR TRANSAKSI */}
        <GlassCard>
          <SectionToggle title="Daftar Transaksi" open={showRecent} onToggle={() => setShowRecent(v => !v)} />
          {showRecent && (<div className="mt-3">
          {recentTx.length === 0 ? (
            <p className="text-xs py-3 text-center text-[color:var(--text-muted)]">Belum ada transaksi. Ketuk Catat untuk mulai.</p>
          ) : (
            <div className="space-y-2.5">
              {recentTx.map(t => (
                <div key={t.id} className="rounded-2xl px-3.5 py-3 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
                  <button onClick={() => setDetailTx(t)} className="w-full flex items-center justify-between text-left">
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-semibold truncate flex items-center gap-1" style={{ color: 'var(--text-main)' }}>
                        <span className="truncate">{t.merchant_name}</span>
                        {t.notes && <StickyNote className="w-3.5 h-3.5 shrink-0 text-[color:var(--text-muted)]" aria-label="Ada catatan" />}
                      </p>
                      <p className="text-[10px] text-[color:var(--text-muted)]">{new Date(t.transaction_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · {t.type === 'income' ? 'Masuk' : 'Keluar'}</p>
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: 'var(--text-main)' }}>
                      {t.type === 'income' ? '+' : '-'}{formatRupiah(Number(t.amount))}
                    </span>
                  </button>
                  <div className="flex justify-end gap-2 mt-2.5">
                    <GlassButton variant="teal" size="sm" onClick={() => { setEditTx(t); setIsEditTxOpen(true); }}>Ubah</GlassButton>
                    <GlassButton variant="danger" size="sm" onClick={() => handleDeleteTx(t.id)}>Hapus</GlassButton>
                  </div>
                </div>
              ))}
            </div>
          )}
          <GlassButton variant="teal" size="lg" full className="mt-4" onClick={() => router.push('/transactions')}>
            Buka Riwayat <ChevronRight className="w-4 h-4" />
          </GlassButton>
          </div>)}
        </GlassCard>

        {/* LIPATAN: STATISTIK (mingguan / bulanan) */}
        <GlassCard>
          <SectionToggle title="Statistik" open={showMonth} onToggle={() => setShowMonth(v => !v)} />
        {showMonth && (
          <div className="mt-4">
        {(() => {
          const spentPct = sIncome > 0 ? Math.round((sExpense / sIncome) * 100) : null;
          const net = sIncome - sExpense;
          const mood = spentPct === null
            ? { color: '#f59e0b', title: 'Belum ada pemasukan', sub: 'Pengeluaran sudah tercatat, tapi belum ada uang masuk di periode ini.' }
            : spentPct <= 70
              ? { color: '#10b981', title: 'Aman, masih longgar', sub: `Baru ${spentPct}% dari pemasukan yang terpakai.` }
              : spentPct <= 100
                ? { color: '#f59e0b', title: 'Hati-hati, hampir habis', sub: `${spentPct}% dari pemasukan sudah terpakai.` }
                : { color: '#ef4444', title: 'Boncos, lebih besar pasak', sub: `Pengeluaran ${spentPct}% dari pemasukan.` };
          const palette = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#0ea5e9', '#94a3b8'];
          const incomeRows = Object.entries(sIncomeCats).sort(([, a]: any, [, b]: any) => b - a) as [string, any][];
          const expenseRows = Object.entries(sExpenseCats).sort(([, a]: any, [, b]: any) => b - a) as [string, any][];
          return (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="mb-4">
                <div className="flex p-1 rounded-2xl bg-teal-500/10 border border-teal-500/20">
                  <button onClick={() => setStatsView('week')} className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all active:scale-95 ${statsView === 'week' ? 'glass glass-teal' : 'text-gray-600 dark:text-gray-300'}`}>Mingguan</button>
                  <button onClick={() => setStatsView('month')} className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all active:scale-95 ${statsView === 'month' ? 'glass glass-teal' : 'text-gray-600 dark:text-gray-300'}`}>{payday > 1 ? 'Siklus Gajian' : 'Bulanan'}</button>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
                  {statsView === 'week' && weekRange ? `Minggu ini: ${weekRange.label}` : payday > 1 && cycle ? cycle.label : 'Bulan ini'}
                </p>
              </div>

              {sTotal === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">{statsView === 'week' ? 'Belum ada transaksi minggu ini.' : 'Belum ada transaksi di periode ini.'}</p>
              )}
              {sTotal > 0 && (<>
              {/* Ringkasan: satu kalimat + satu bar */}
              <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: mood.color + '1a' }}>
                <p className="text-sm font-extrabold" style={{ color: mood.color }}>{mood.title}</p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">{mood.sub}</p>
                <div className="w-full h-3 rounded-full bg-white/70 dark:bg-gray-700 mt-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(spentPct ?? 100, 100)}%`, backgroundColor: mood.color }}></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                  <span>Terpakai</span><span>Pemasukan {formatRupiah(sIncome)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 px-3 py-2.5"><p className="text-[10px] text-gray-500 dark:text-gray-400">Masuk</p><p className="text-sm font-extrabold text-green-600 dark:text-green-400">{formatRupiah(sIncome)}</p></div>
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2.5"><p className="text-[10px] text-gray-500 dark:text-gray-400">Keluar</p><p className="text-sm font-extrabold text-red-500 dark:text-red-400">{formatRupiah(sExpense)}</p></div>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 mb-5 flex items-center justify-between">
                <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{net >= 0 ? 'Sisa' : 'Kurang'}</p>
                <p className="text-sm font-extrabold" style={{ color: net >= 0 ? '#0d9488' : '#ef4444' }}>{formatRupiah(Math.abs(net))}</p>
              </div>

              {expenseRows.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Uangmu habis buat apa?</p>
                  <div className="space-y-3">
                    {expenseRows.map(([name, amount], i) => {
                      const pct = sExpense > 0 ? Math.round((Number(amount) / sExpense) * 100) : 0;
                      const color = palette[Math.min(i, palette.length - 1)];
                      return (
                        <div key={name} onClick={() => handleCategoryClick(name)} className="cursor-pointer">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className={`truncate text-sm ${i === 0 ? 'font-extrabold text-gray-800 dark:text-gray-100' : 'font-semibold text-gray-700 dark:text-gray-200'}`}>{i === 0 ? '🔥 ' : ''}{name}</span>
                            <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white" style={{ backgroundColor: color }}>{pct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}></div></div>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">{formatRupiah(Number(amount))}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {incomeRows.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Uang datang dari mana?</p>
                  <div className="space-y-3">
                    {incomeRows.map(([name, amount]) => {
                      const pct = sIncome > 0 ? Math.round((Number(amount) / sIncome) * 100) : 0;
                      return (
                        <div key={name} onClick={() => handleCategoryClick(name)} className="cursor-pointer">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="truncate text-sm font-semibold text-gray-700 dark:text-gray-200">{name}</span>
                            <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white bg-green-500">{pct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"><div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%` }}></div></div>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">{formatRupiah(Number(amount))}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </>)}
            </div>
          );
        })()}
          </div>
        )}
        </GlassCard>

      </main>

      {/* MODAL PROFIL: hanya Pengaturan + Keluar. Ubah foto, nama, password, dll ada di Pengaturan. */}
      {isProfileModalOpen && (
        <div onClick={() => setIsProfileModalOpen(false)} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="bg-gray-50 dark:bg-gray-800 rounded-3xl w-full max-w-xs relative overflow-hidden shadow-2xl">
            <div className="pt-6 pb-12 flex flex-col items-center relative bg-cover bg-center" style={{ backgroundColor: profile?.theme_color || '#0f766e', ...(profile?.cover_url ? { backgroundImage: `url(${profile.cover_url})` } : {}) }}>
              {profile?.cover_url && <div className="absolute inset-0 bg-black/25" />}
              <button onClick={() => setIsProfileModalOpen(false)} aria-label="Tutup" className="absolute top-4 right-4 z-10 text-white/80 hover:text-white bg-black/20 rounded-full p-1"><X className="w-5 h-5" /></button>
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md relative z-10 mt-2 flex items-center justify-center">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-gray-400" />}
              </div>
            </div>
            <div className="px-5 pb-5 -mt-6 text-center relative z-10">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white bg-white dark:bg-gray-700 rounded-xl py-2 shadow-sm mb-5 inline-block px-6 border border-gray-100 dark:border-gray-600">{profile?.nickname || profile?.full_name || user?.email?.split('@')[0]}</h2>
              <div className="space-y-3">
                <button onClick={() => { setIsProfileModalOpen(false); router.push('/settings'); }} className="glass glass-solid-teal w-full h-12 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <Settings className="w-4 h-4" /> Pengaturan
                </button>
                <button onClick={() => { setIsProfileModalOpen(false); showDialog('Keluar dari Celengin?', 'Kamu perlu masuk lagi nanti untuk membuka akunmu.', 'danger', handleLogout); }} className="glass glass-danger w-full h-12 rounded-2xl border font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4" /> Keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCategory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 relative max-h-[80vh] flex flex-col transition-colors">
            <button onClick={() => setSelectedCategory(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-1 text-gray-800 dark:text-white">Detail Kategori</h2>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-4">{selectedCategory}</p>
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {categoryDetails.length === 0 ? <p className="text-center text-xs text-gray-400 py-4">Tidak ada transaksi di bulan ini.</p> : 
                categoryDetails.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()).map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div>
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{new Date(tx.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <p className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{formatRupiah(tx.amount)}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
      {/* MODAL EDUKASI JATAH HARIAN */}
      {showInfoJatah && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setShowInfoJatah(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Apa itu Jatah Hari Ini?</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Angka ini adalah batas maksimal uang yang <strong>boleh kamu belanjakan hari ini</strong> agar tantangan hematmu tidak jebol.
            </p>
            <div className="bg-teal-50 dark:bg-teal-900/30 p-3 rounded-xl border border-teal-100 dark:border-teal-800 mb-4">
              <p className="text-[11px] font-bold text-teal-800 dark:text-teal-300 mb-1">Rumus Perhitungan:</p>
              <ul className="text-[10px] text-teal-700 dark:text-teal-400 space-y-1 list-disc pl-4">
                <li>Total Batas Pengeluaran dibagi Total Hari Periode Tantangan.</li>
                <li>Hasilnya jadi patokan harian.</li>
                <li>Lalu dikurangi pengeluaran yang sudah kamu catat hari ini.</li>
              </ul>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
              Data diambil dari target yang sedang kamu aktifkan sebagai <strong>Tantangan Utama</strong>.
            </p>
          </div>
        </div>
      )}

      {/* MODAL EDUKASI STREAK */}
      {showInfoStreak && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setShowInfoStreak(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Apa itu Streak Hemat?</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Streak adalah penghitung <strong>berapa hari berturut-turut</strong> kamu berhasil mengendalikan pengeluaran di bawah jatah harian.
            </p>
            <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-xl border border-orange-100 dark:border-orange-800 mb-4">
              <p className="text-[11px] font-bold text-orange-800 dark:text-orange-300 mb-1">Cara Kerjanya:</p>
              <ul className="text-[10px] text-orange-700 dark:text-orange-400 space-y-1 list-disc pl-4">
                <li>Setiap hari sistem mengecek pengeluaranmu.</li>
                <li>Jika belanja &le; Jatah Harian, streak bertambah +1.</li>
                <li>Jika kamu <em>overbudget</em> sehari saja, streak akan <strong>reset kembali ke 0</strong>.</li>
              </ul>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
              Semakin panjang streak-mu, semakin sehat keuanganmu! 🔥
            </p>
          </div>
        </div>
      )}
      <TransactionDetailModal tx={detailTx} onClose={() => setDetailTx(null)} />
      <EditTransactionModal isOpen={isEditTxOpen} onClose={() => setIsEditTxOpen(false)} onSuccess={() => fetchData()} showDialog={showDialog} txData={editTx} />
      <TransactionModal isOpen={isTxModalOpen} onClose={() => { setIsTxModalOpen(false); setTxDate(undefined); }} onSuccess={() => fetchData()} showDialog={showDialog} initialType={txType} initialDate={txDate} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}
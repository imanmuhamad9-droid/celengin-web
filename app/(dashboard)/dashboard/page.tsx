'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Trash2, User, X, Upload, LogOut, KeyRound, Eye, EyeOff, CalendarDays, Flame, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatRupiah, toLocalDateStr } from '@/lib/utils';
import { diffDays } from '@/lib/recurring';
import { listWallets, computeWalletBalances, Wallet, WalletTransfer } from '@/lib/wallets';
import { fetchBadgeContext, syncBadges } from '@/lib/badges';
import TransactionModal from '@/components/TransactionModal';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import NotificationBell, { LocalNotif } from '@/components/NotificationBell';
import FeatureShortcuts from '@/components/FeatureShortcuts';
import WeeklyChart from '@/components/WeeklyChart';
import PasswordRequirements from '@/components/PasswordRequirements';
import SkeletonLoader from '@/components/SkeletonLoader';

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

  const [chartTheme, setChartTheme] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryDetails, setCategoryDetails] = useState<any[]>([]);

  const chartThemes = [
    { id: 'donut', income: '#10b981', expense: '#ef4444', label: 'Donut' },
    { id: 'pie', income: '#8b5cf6', expense: '#f43f5e', label: 'Pie' },
    { id: 'gauge', income: '#0ea5e9', expense: '#f97316', label: 'Gauge' },
    { id: 'bar', income: '#14b8a6', expense: '#f59e0b', label: 'Minimalis' }
  ];

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [isNicknameAvailable, setIsNicknameAvailable] = useState<boolean | null>(null);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: 'error' });

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

  useEffect(() => {
    if (newNickname.length < 3) { setIsNicknameAvailable(null); return; }
    if (newNickname === profile?.nickname) { setIsNicknameAvailable(true); return; }
    const checkNickname = async () => {
      setIsCheckingNickname(true);
      const { data } = await supabase.from('profiles').select('nickname').eq('nickname', newNickname).single();
      setIsNicknameAvailable(!data);
      setIsCheckingNickname(false);
    };
    const timer = setTimeout(checkNickname, 500);
    return () => clearTimeout(timer);
  }, [newNickname, profile?.nickname]);

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-avatar-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('widget-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('widget-images').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      fetchData();
    } catch (error: any) {
      showDialog('Gagal', 'Gagal upload: ' + error.message, 'danger');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    fetchData(); setIsProfileModalOpen(false);
  };

  const handleLogout = async () => {
    setIsProfileModalOpen(false); await supabase.auth.signOut(); router.push('/login');
  };

  const handleUpdateNickname = async () => {
    if (!isNicknameAvailable || newNickname.length < 3) return;
    setIsSavingNickname(true);
    const { error } = await supabase.from('profiles').update({ nickname: newNickname, full_name: newNickname }).eq('id', user.id);
    if (!error) { setIsNicknameModalOpen(false); fetchData(); }
    setIsSavingNickname(false);
  };

  const isPasswordValid = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
  const isPasswordMatch = newPassword === confirmPassword && newPassword !== '';

  const handleUpdatePassword = async () => {
    if (!isPasswordValid) return setPasswordMsg({ text: 'Password belum memenuhi syarat.', type: 'error' });
    if (!isPasswordMatch) return setPasswordMsg({ text: 'Konfirmasi password tidak cocok.', type: 'error' });
    setIsUpdatingPassword(true); setPasswordMsg({ text: '', type: 'error' });
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: newPassword });
    if (!signInError) {
      setPasswordMsg({ text: 'Password baru tidak boleh sama dengan password lama.', type: 'error' });
      setIsUpdatingPassword(false); return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPasswordMsg({ text: error.message, type: 'error' }); }
    else {
      setPasswordMsg({ text: 'Password berhasil diubah!', type: 'success' });
      setTimeout(() => { setIsPasswordModalOpen(false); setNewPassword(''); setConfirmPassword(''); setPasswordMsg({ text: '', type: 'error' }); }, 2000);
    }
    setIsUpdatingPassword(false);
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

  const monthlyTx = transactions.filter(t => t.transaction_date.startsWith(currentMonthStr || '0000-00'));
  const monthlyIncome = monthlyTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const monthlyExpense = monthlyTx.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  const incomeCategories = monthlyTx.filter(t => t.type === 'income').reduce((acc: any, curr) => { acc[curr.merchant_name] = (acc[curr.merchant_name] || 0) + Number(curr.amount); return acc; }, {});
  const expenseCategories = monthlyTx.filter(t => t.type === 'expense').reduce((acc: any, curr) => { acc[curr.merchant_name] = (acc[curr.merchant_name] || 0) + Number(curr.amount); return acc; }, {});

  const totalMonthly = monthlyIncome + monthlyExpense;
  const incomePercent = totalMonthly === 0 ? 0 : Math.round((monthlyIncome / totalMonthly) * 100);
  const expensePercent = totalMonthly === 0 ? 0 : Math.round((monthlyExpense / totalMonthly) * 100);

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
        body: <>Target <strong className="capitalize">{w.period_type}</strong> terpakai {Math.round(w.percent)}%.</>,
        href: '/spending-challenge',
      };
    }),
    ...activePraise.map((p): LocalNotif => ({
      key: `praise-${p.id}-${p.end_date}`,
      tone: 'praise',
      icon: 'praise',
      title: 'Target Tercapai! 🎉',
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
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>
  );

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-24 transition-colors">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 transition-colors">
        <div className="flex items-center gap-2">
          {/* Logo Baru */}
          <img src="/icon.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-bold text-xl text-teal-800 dark:text-teal-400">Celengin.</span>
        </div>
        <NotificationBell userId={user?.id ?? null} local={localNotifs} />
      </header>

      <main className="px-5 mt-4 space-y-6">
        
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Halo, selamat datang 👋</p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{profile?.nickname || profile?.full_name || user?.email?.split('@')[0]}</h2>
          </div>
          <button 
            onClick={() => setIsProfileModalOpen(true)} 
            className="w-14 h-14 rounded-full border-[3px] border-teal-500 shadow-md overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 hover:scale-105 transition-all"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-gray-400" />
            )}
          </button>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setTxType('income'); setIsTxModalOpen(true); }} className="flex-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 py-3 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-green-100 dark:hover:bg-green-900/40 transition-all text-xs">
            + Pemasukan
          </button>
          <button onClick={() => { setTxType('expense'); setIsTxModalOpen(true); }} className="flex-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 py-3 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-all text-xs">
            - Pengeluaran
          </button>
        </div>

        {/* Kartu Saldo */}
        <div className="rounded-3xl p-6 text-white shadow-lg relative overflow-hidden bg-teal-700">
          {profile?.safe_limit && (
            <div className="absolute inset-0 z-0" style={{ backgroundImage: balance >= profile.safe_limit ? `url(${profile.bg_safe_url})` : `url(${profile.bg_low_url})`, backgroundSize: balance >= profile.safe_limit ? `${(profile.bg_safe_zoom || 1) * 100}%` : `${(profile.bg_low_zoom || 1) * 100}%`, backgroundPosition: balance >= profile.safe_limit ? (profile.bg_safe_pos || 'center') : (profile.bg_low_pos || 'center'), backgroundRepeat: 'no-repeat' }}></div>
          )}
          <div className="absolute inset-0 bg-black/40 z-0"></div>
          
          {profile?.safe_limit && (
            <div className={`absolute top-4 right-4 z-20 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm backdrop-blur-md border border-white/20 ${balance >= profile.safe_limit ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              {balance >= profile.safe_limit ? 'Saldo Aman' : 'Saldo Kritis'}
            </div>
          )}

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-white/80 text-xs font-medium">Total Saldo Kamu</p>
              <button onClick={() => setIsBalanceHidden(!isBalanceHidden)} className="bg-black/20 hover:bg-black/40 p-1 rounded-full text-white transition-all backdrop-blur-sm">
                {isBalanceHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <h3 className="text-3xl font-extrabold mb-4">{isBalanceHidden ? 'Rp ******' : formatRupiah(balance)}</h3>
            <div className="flex gap-6 text-sm">
              <div><p className="text-white/80 text-[10px] uppercase font-bold">Masuk</p><p className="font-bold text-green-300">{isBalanceHidden ? '+Rp ***' : `+${formatRupiah(totalIncome)}`}</p></div>
              <div><p className="text-white/80 text-[10px] uppercase font-bold">Keluar</p><p className="font-bold text-red-300">{isBalanceHidden ? '-Rp ***' : `-${formatRupiah(totalExpense)}`}</p></div>
            </div>
          </div>
        </div>

        {/* DOMPET (muncul bila punya 2 dompet atau lebih) */}
        {wallets.length > 1 && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Dompet</p>
              <button onClick={() => router.push('/wallets')} className="text-[10px] font-bold text-teal-600 dark:text-teal-400">Kelola</button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
              {wallets.map(w => (
                <button key={w.id} onClick={() => router.push('/wallets')} className="shrink-0 min-w-[130px] bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-left transition-colors">
                  <p className="text-lg leading-none mb-1">{w.emoji}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{w.name}</p>
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{isBalanceHidden ? 'Rp ******' : formatRupiah(walletCalc.balances[w.id] || 0)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

                {/* JATAH HARIAN & STREAK */}
        <div className="flex gap-3 relative">
          {/* Kotak Jatah Harian */}
          <div className="flex-1 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center relative">
            <button 
              onClick={() => setShowInfoJatah(true)} 
              className="absolute top-2 right-2 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
            >
              <Info className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Jatah Hari Ini</p>
            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{primaryTarget ? formatRupiah(jatahHariIni) : 'Belum ada'}</p>
            <p className="text-[9px] text-gray-400 mt-0.5">{primaryTarget ? `dari ${formatRupiah(dailyAllowance)}` : 'Aktifkan Target Utama'}</p>
          </div>

          {/* Kotak Streak Hemat */}
          <div className="flex-1 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center relative">
            <button 
              onClick={() => setShowInfoStreak(true)} 
              className="absolute top-2 right-2 text-gray-400 hover:text-orange-500 dark:hover:text-orange-400"
            >
              <Info className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Streak Hemat</p>
            <p className="font-bold text-orange-500 text-sm flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> {dailyAllowance > 0 ? `${streak} Hari` : 'Belum ada'}</p>
            <p className="text-[9px] text-gray-400 mt-0.5">{dailyAllowance > 0 ? 'di bawah jatah harian' : 'Aktifkan Target Utama'}</p>
          </div>
        </div>

        {/* PINTASAN FITUR (4 favorit + Semua, bisa diatur) */}
        <FeatureShortcuts userId={user?.id ?? null} initial={profile?.shortcuts} counts={{ tagihan: dueBills.length }} />

        {/* GRAFIK MINGGUAN */}
        <WeeklyChart
          days={weeklyData}
          rangeLabel={last7Days.length > 0 ? `${new Date(last7Days[0] + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(last7Days[6] + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}
        />

        {/* KALENDER PENGELUARAN / PEMASUKAN */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
          
                    {/* Header Kalender */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100">Kalender</h3>
            </div>
            
            {/* POIN 4: Tombol Navigasi Bulan */}
            <div className="flex items-center gap-1">
              <button onClick={() => {
                if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); } 
                else setCalendarMonth(calendarMonth - 1);
              }} className="p-1 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-500 hover:text-teal-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 w-16 text-center">
                {new Date(calendarYear, calendarMonth).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => {
                if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); } 
                else setCalendarMonth(calendarMonth + 1);
              }} className="p-1 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-500 hover:text-teal-600">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setShowCalendar(!showCalendar)} 
                className="text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-teal-600 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded-lg transition-colors"
              >
                {showCalendar ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
          </div>

          {/* Isi Kalender */}
          {showCalendar && (
            <div className="animate-in fade-in">
              
              {/* Tombol Filter (Hanya Masuk / Keluar) */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => setCalendarView('expense')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${calendarView === 'expense' ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`}>Keluar</button>
                <button onClick={() => setCalendarView('income')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${calendarView === 'income' ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`}>Masuk</button>
              </div>

              {/* Grid Tanggal */}
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['M','S','S','R','K','J','S'].map((d, i) => <span key={i} className="text-[10px] font-bold text-gray-400">{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {daysArray.map(d => {
                  const inc = transactions.filter(t => t.transaction_date === d.dateStr && t.type === 'income').reduce((a, b) => a + Number(b.amount), 0);
                  const exp = transactions.filter(t => t.transaction_date === d.dateStr && t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
                  
                  let val = 0;
                  let colorBase = '239, 68, 68'; // Merah (default)
                  if (calendarView === 'income') { val = inc; colorBase = '16, 185, 129'; } // Hijau
                  else if (calendarView === 'expense') { val = exp; colorBase = '239, 68, 68'; } // Merah

                  const maxVal = calendarView === 'income' ? maxDailyIncome : maxDailyExpense;
                  const intensity = val / maxVal;
                  const isToday = d.dateStr === todayStr;

                  return (
                    <button 
                      key={d.dateStr} 
                      onClick={() => router.push(`/transactions?date=${d.dateStr}`)}
                      className={`aspect-square flex items-center justify-center rounded-lg text-[10px] font-bold transition-all hover:scale-110 ${val > 0 ? 'text-white' : 'text-gray-600 dark:text-gray-400'} ${isToday ? 'ring-2 ring-teal-500 ring-offset-1 dark:ring-offset-gray-800' : ''}`}
                      style={{ backgroundColor: val > 0 ? `rgba(${colorBase}, ${Math.max(0.2, intensity)})` : 'rgba(156, 163, 175, 0.1)' }}
                      title={formatRupiah(val)}
                    >
                      {d.day}
                    </button>
                  );
                })}
              </div>

              {/* Keterangan */}
              {calendarView === 'expense' && mostExpensiveDay && mostExpensiveDay.expense > 0 && (
                <div className="mt-3 text-center">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Paling boros: <span className="font-bold text-red-500">{new Date(mostExpensiveDay.dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span> ({formatRupiah(mostExpensiveDay.expense)})
                  </p>
                </div>
              )}
              {calendarView === 'income' && (
                <div className="mt-3 text-center">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Menampilkan data pemasukan.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DONUT CHART BULAN INI */}
        {totalMonthly > 0 && (
          <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100">Statistik Bulan Ini</h3>
              <button onClick={() => setChartTheme((prev) => (prev + 1) % chartThemes.length)} className="text-[10px] font-bold bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-600 hover:bg-gray-100 transition-all">
                Tema: {chartThemes[chartTheme].label}
              </button>
            </div>
            
            <div className="flex items-center gap-5 mb-6">
              {chartThemes[chartTheme].id === 'donut' && (
                <div className="relative w-20 h-20 rounded-full flex items-center justify-center shrink-0 transition-all duration-300" style={{ background: `conic-gradient(${chartThemes[chartTheme].income} ${incomePercent}%, ${chartThemes[chartTheme].expense} 0)` }}>
                  <div className="absolute w-14 h-14 bg-white dark:bg-gray-800 rounded-full"></div>
                </div>
              )}
              {chartThemes[chartTheme].id === 'pie' && (
                <div className="w-20 h-20 rounded-full shrink-0 shadow-inner transition-all duration-300" style={{ background: `conic-gradient(${chartThemes[chartTheme].income} ${incomePercent}%, ${chartThemes[chartTheme].expense} 0)` }}></div>
              )}
              {chartThemes[chartTheme].id === 'gauge' && (
                <div className="relative w-24 h-12 overflow-hidden shrink-0 transition-all duration-300">
                  <div className="absolute top-0 left-0 w-24 h-24 rounded-full" style={{ background: `conic-gradient(from 270deg, ${chartThemes[chartTheme].income} ${incomePercent / 2}%, ${chartThemes[chartTheme].expense} 0)` }}></div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-16 bg-white dark:bg-gray-800 rounded-full"></div>
                </div>
              )}
              {chartThemes[chartTheme].id === 'bar' && (
                <div className="w-24 h-20 flex flex-col justify-center gap-2 shrink-0 transition-all duration-300">
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${incomePercent}%`, backgroundColor: chartThemes[chartTheme].income }}></div></div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${expensePercent}%`, backgroundColor: chartThemes[chartTheme].expense }}></div></div>
                </div>
              )}
              
              <div className="space-y-1">
                <p className="text-xs font-semibold flex items-center gap-2" style={{ color: chartThemes[chartTheme].income }}>
                  <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: chartThemes[chartTheme].income }}></span> Masuk: {formatRupiah(monthlyIncome)} ({incomePercent}%)
                </p>
                <p className="text-xs font-semibold flex items-center gap-2" style={{ color: chartThemes[chartTheme].expense }}>
                  <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: chartThemes[chartTheme].expense }}></span> Keluar: {formatRupiah(monthlyExpense)} ({expensePercent}%)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(incomeCategories).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Sumber Pemasukan</p>
                  <div className="space-y-1.5">
                    {Object.entries(incomeCategories).sort(([, a]: any, [, b]: any) => b - a).map(([name, amount]: any) => (
                      <div key={name} onClick={() => handleCategoryClick(name)} className="flex justify-between items-center text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 -mx-1 rounded transition-colors">
                        <span className="text-gray-600 dark:text-gray-300 truncate mr-2">{name}</span>
                        <div className="text-right shrink-0">
                          <span className="font-semibold text-gray-800 dark:text-gray-100 mr-2">{formatRupiah(amount)}</span>
                          <span className="font-bold" style={{ color: chartThemes[chartTheme].income }}>{Math.round((amount / monthlyIncome) * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.entries(expenseCategories).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Pengeluaran Terbesar</p>
                  <div className="space-y-1.5">
                    {Object.entries(expenseCategories).sort(([, a]: any, [, b]: any) => b - a).map(([name, amount]: any, index) => {
                      const isBiggest = index === 0;
                      return (
                        <div key={name} onClick={() => handleCategoryClick(name)} className={`flex justify-between items-center text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 -mx-1 rounded transition-colors ${isBiggest ? 'bg-red-50/50 dark:bg-red-900/20' : ''}`}>
                          <span className={`truncate mr-2 ${isBiggest ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-300'}`}>{name}</span>
                          <div className="text-right shrink-0">
                            <span className={`font-semibold mr-2 ${isBiggest ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>{formatRupiah(amount)}</span>
                            <span className={`font-bold ${isBiggest ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{Math.round((amount / monthlyExpense) * 100)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <button onClick={() => router.push('/transactions')} className="w-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-teal-300 transition-all shadow-sm">
          Lihat Semua Riwayat Transaksi
        </button>

      </main>

      {/* MODAL PROFIL (VERSI RINGKAS) */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-3xl w-full max-w-xs relative overflow-hidden shadow-2xl">
            <div className="pt-6 pb-12 flex flex-col items-center relative transition-colors duration-300" style={{ backgroundColor: profile?.theme_color || '#0f766e' }}>
              <button onClick={() => setIsProfileModalOpen(false)} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/10 rounded-full p-1"><X className="w-5 h-5" /></button>
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md relative z-10 mt-2 flex items-center justify-center">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-gray-400" />}
              </div>
            </div>
            <div className="px-5 pb-5 -mt-6 text-center relative z-10">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white bg-white dark:bg-gray-700 rounded-xl py-2 shadow-sm mb-4 inline-block px-6 border border-gray-100 dark:border-gray-600">{profile?.nickname || profile?.full_name || user?.email?.split('@')[0]}</h2>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUploadAvatar} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2 mb-4 shadow-sm">
                {isUploading ? 'Mengunggah...' : <><Upload className="w-4 h-4" /> Ganti Foto Profil</>}
              </button>
              <div className="bg-white dark:bg-gray-700 rounded-2xl border border-gray-100 dark:border-gray-600 shadow-sm overflow-hidden text-sm">
                {profile?.avatar_url && <button onClick={handleDeleteAvatar} className="w-full flex items-center gap-3 px-4 py-3.5 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/30 transition-all border-b border-gray-50 dark:border-gray-600 text-left"><Trash2 className="w-4 h-4" /> Hapus Foto</button>}
                <button onClick={() => { setNewNickname(profile?.nickname || ''); setIsNicknameModalOpen(true); }} className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 transition-all border-b border-gray-50 dark:border-gray-600 text-left"><User className="w-4 h-4 text-gray-400" /> Ubah Nickname</button>
                <button onClick={() => { setIsProfileModalOpen(false); setIsPasswordModalOpen(true); }} className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 transition-all border-b border-gray-50 dark:border-gray-600 text-left"><KeyRound className="w-4 h-4 text-gray-400" /> Ganti Password</button>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/30 transition-all text-left"><LogOut className="w-4 h-4" /> Keluar Akun</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UBAH NICKNAME */}
      {isNicknameModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setIsNicknameModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 text-center">Ubah Nickname</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nickname Baru</label>
                <div className="relative">
                  <input type="text" value={newNickname} onChange={(e) => setNewNickname(e.target.value.toLowerCase().replace(/\s/g, ''))} className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-teal-500 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white ${isNicknameAvailable === false ? 'border-red-400' : isNicknameAvailable === true ? 'border-green-400' : 'border-gray-200 dark:border-gray-600'}`} placeholder="cth: iman123" />
                  {newNickname.length >= 3 && <div className="absolute right-3 top-3.5">{isCheckingNickname ? <span className="text-[10px] text-gray-400">Cek...</span> : isNicknameAvailable ? <span className="text-[10px] text-green-500 font-bold">Tersedia</span> : <span className="text-[10px] text-red-500 font-bold">Dipakai</span>}</div>}
                </div>
              </div>
              <button onClick={handleUpdateNickname} disabled={isSavingNickname || !isNicknameAvailable || newNickname.length < 3} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50">{isSavingNickname ? 'Menyimpan...' : 'Simpan Nickname'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GANTI PASSWORD */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setIsPasswordModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 text-center">Ganti Password</h2>
            {passwordMsg.text && <div className={`text-xs p-3 rounded-xl mb-4 border ${passwordMsg.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-500 border-red-100 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/30 text-green-600 border-green-100 dark:border-green-800'}`}>{passwordMsg.text}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Password Baru</label>
                <div className="relative">
                  <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500 text-sm" placeholder="Buat password baru" />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">{showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                </div>
                {newPassword.length > 0 && <PasswordRequirements password={newPassword} />}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ulangi Password Baru</label>
                <div className="relative">
                  <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`w-full pl-4 pr-12 py-3 rounded-xl border focus:ring-2 focus:ring-teal-500 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white ${confirmPassword.length > 0 && !isPasswordMatch ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`} placeholder="Ketik ulang password baru" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">{showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                </div>
                {confirmPassword.length > 0 && !isPasswordMatch && <p className="text-xs text-red-500 mt-1">Password tidak cocok.</p>}
              </div>
              <button onClick={handleUpdatePassword} disabled={isUpdatingPassword || !isPasswordValid || !isPasswordMatch} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 mt-2">{isUpdatingPassword ? 'Menyimpan...' : 'Simpan Password Baru'}</button>
            </div>
          </div>
        </div>
      )}

      {selectedCategory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative max-h-[80vh] flex flex-col transition-colors">
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
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setShowInfoJatah(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Apa itu Jatah Hari Ini?</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Angka ini adalah batas maksimal uang yang <strong>boleh kamu belanjakan hari ini</strong> agar target keuanganmu tidak jebol.
            </p>
            <div className="bg-teal-50 dark:bg-teal-900/30 p-3 rounded-xl border border-teal-100 dark:border-teal-800 mb-4">
              <p className="text-[11px] font-bold text-teal-800 dark:text-teal-300 mb-1">Rumus Perhitungan:</p>
              <ul className="text-[10px] text-teal-700 dark:text-teal-400 space-y-1 list-disc pl-4">
                <li>Total Batas Pengeluaran dibagi Total Hari Periode Target.</li>
                <li>Hasilnya jadi patokan harian.</li>
                <li>Lalu dikurangi pengeluaran yang sudah kamu catat hari ini.</li>
              </ul>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
              Data diambil dari target yang sedang kamu aktifkan sebagai <strong>Target Utama</strong>.
            </p>
          </div>
        </div>
      )}

      {/* MODAL EDUKASI STREAK */}
      {showInfoStreak && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
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
      <TransactionModal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} onSuccess={() => fetchData()} showDialog={showDialog} initialType={txType} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}
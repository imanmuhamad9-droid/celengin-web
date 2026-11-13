'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AppHeader from '@/components/AppHeader';
import { useRouter } from 'next/navigation';
import { Save, Upload, Sun, Moon, Monitor, User, LogOut, Lock, Camera, Trash2, Eye, EyeOff, ChevronRight, CalendarClock, Wallet, Image as ImageIcon, Palette, Bell } from 'lucide-react';
import CardBgEditor from '@/components/CardBgEditor';
import PhotoCropper from '@/components/PhotoCropper';
import SkeletonLoader from '@/components/SkeletonLoader';
import PasswordRequirements from '@/components/PasswordRequirements';
import CustomDialog from '@/components/CustomDialog';
import PushSettingsCard from '@/components/PushSettingsCard';
import { cycleFor, normalizePayday } from '@/lib/cycle';
import { toLocalDateStr, formatRupiah } from '@/lib/utils';

type View = 'hub' | 'profil' | 'keamanan' | 'gajian' | 'saldo' | 'kartu' | 'tampilan' | 'notif';

const TITLES: Record<View, string> = {
  hub: 'Pengaturan',
  profil: 'Profil Saya',
  keamanan: 'Keamanan',
  gajian: 'Tanggal Gajian',
  saldo: 'Batas Saldo Aman',
  kartu: 'Kartu Saldo',
  tampilan: 'Tampilan',
  notif: 'Notifikasi',
};

const CARD = 'bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors';
const BTN_SOFT = 'flex-1 h-11 rounded-2xl bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all';
const BTN_DANGER_SOFT = 'flex-1 h-11 rounded-2xl bg-white dark:bg-gray-700 border border-red-200 dark:border-red-900/50 text-red-500 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40';
const BTN_MAIN = 'w-full h-12 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50';
const INPUT = 'w-full h-12 px-4 rounded-2xl border bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all';

function Row({ icon, title, sub, onClick, danger }: { icon: React.ReactNode; title: string; sub?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors">
      <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-50 dark:bg-red-900/30 text-red-500' : 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'}`}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-bold ${danger ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>{title}</span>
        {sub && <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{sub}</span>}
      </span>
      {!danger && <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-500 shrink-0" />}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">{label}</p>
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden transition-colors">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [view, setView] = useState<View>('hub');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Mode tampilan
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Tanggal gajian (disimpan langsung saat dipilih)
  const [payday, setPayday] = useState(1);
  const [paydayReady, setPaydayReady] = useState(true);
  const [todayStr, setTodayStr] = useState('');

  // Saldo
  const [safeLimitDisplay, setSafeLimitDisplay] = useState('');
  const [safeLimitRaw, setSafeLimitRaw] = useState(0);

  // Background kartu
  const [bgSafeUrl, setBgSafeUrl] = useState('');
  const [bgSafePos, setBgSafePos] = useState('center');
  const [bgSafeZoom, setBgSafeZoom] = useState(1);
  const [bgLowUrl, setBgLowUrl] = useState('');
  const [bgLowPos, setBgLowPos] = useState('center');
  const [bgLowZoom, setBgLowZoom] = useState(1);
  const [uploading, setUploading] = useState({ safe: false, low: false });
  const fileInputSafeRef = useRef<HTMLInputElement>(null);
  const fileInputLowRef = useRef<HTMLInputElement>(null);

  // Profil
  const [isUploading, setIsUploading] = useState(false);
  const [cropJob, setCropJob] = useState<{ file: File; kind: 'avatar' | 'cover' } | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newNickname, setNewNickname] = useState('');
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [isNicknameAvailable, setIsNicknameAvailable] = useState<boolean | null>(null);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [nickMsg, setNickMsg] = useState('');

  // Password
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

  const go = (v: View) => { setMsg(''); setNickMsg(''); setView(v); };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' || 'system';
    setTheme(savedTheme);

    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (data) {
        setProfile(data);
        setPayday(normalizePayday(data.payday));
        setPaydayReady('payday' in data);
        setTodayStr(toLocalDateStr(new Date()));

        const limit = data.safe_limit || 500000;
        setSafeLimitRaw(limit);
        setSafeLimitDisplay(new Intl.NumberFormat('id-ID').format(limit));

        setBgSafeUrl(data.bg_safe_url || '');
        setBgSafePos(data.bg_safe_pos || 'center');
        setBgSafeZoom(Number(data.bg_safe_zoom) || 1);

        setBgLowUrl(data.bg_low_url || '');
        setBgLowPos(data.bg_low_pos || 'center');
        setBgLowZoom(Number(data.bg_low_zoom) || 1);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [router]);

  // Isi kolom nickname saat halaman Profil dibuka; kembali ke atas tiap ganti halaman
  useEffect(() => {
    window.scrollTo(0, 0);
    if (view === 'profil') setNewNickname(profile?.nickname || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Cek ketersediaan nickname (real-time)
  useEffect(() => {
    if (view !== 'profil') return;
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
  }, [newNickname, profile?.nickname, view]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const reloadProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (data) setProfile(data);
  };

  // Pilih foto (profil / sampul) -> layar atur zoom dulu, baru diunggah saat Simpan
  const handlePickPhoto = (e: React.ChangeEvent<HTMLInputElement>, kind: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { showDialog('Gagal', 'File yang dipilih bukan gambar.', 'danger'); return; }
    setCropJob({ file, kind });
  };

  const uploadCropped = async (blob: Blob) => {
    if (!cropJob) return;
    const kind = cropJob.kind;
    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const fileName = `${session.user.id}-${kind}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('widget-images').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('widget-images').getPublicUrl(fileName);
      const col = kind === 'avatar' ? 'avatar_url' : 'cover_url';
      const { error: upErr } = await supabase.from('profiles').update({ [col]: publicUrl }).eq('id', session.user.id);
      if (upErr) throw new Error(kind === 'cover' ? 'Kolom sampul belum ada. Jalankan sql/06_cover.sql di Supabase.' : upErr.message);
      await reloadProfile(session.user.id);
      setCropJob(null);
    } catch (error: any) {
      setCropJob(null);
      showDialog('Gagal', 'Gagal upload: ' + error.message, 'danger');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = async (kind: 'avatar' | 'cover') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const col = kind === 'avatar' ? 'avatar_url' : 'cover_url';
    await supabase.from('profiles').update({ [col]: null }).eq('id', session.user.id);
    setProfile((p: any) => ({ ...p, [col]: null }));
  };

  const handleUpdateNickname = async () => {
    if (!isNicknameAvailable || newNickname.length < 3) return;
    setIsSavingNickname(true); setNickMsg('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsSavingNickname(false); return; }
    const { error } = await supabase.from('profiles').update({ nickname: newNickname, full_name: newNickname }).eq('id', session.user.id);
    if (error) setNickMsg('Gagal menyimpan: ' + error.message);
    else { await reloadProfile(session.user.id); setNickMsg('Nickname berhasil disimpan.'); setTimeout(() => setNickMsg(''), 2500); }
    setIsSavingNickname(false);
  };

  const handleUpdatePassword = async () => {
    if (!isPasswordValid) return setPasswordMsg({ text: 'Password belum memenuhi syarat.', type: 'error' });
    if (!isPasswordMatch) return setPasswordMsg({ text: 'Konfirmasi password tidak cocok.', type: 'error' });
    setIsUpdatingPassword(true); setPasswordMsg({ text: '', type: 'error' });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user.email) { setIsUpdatingPassword(false); return; }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: newPassword });
    if (!signInError) {
      setPasswordMsg({ text: 'Password baru tidak boleh sama dengan password lama.', type: 'error' });
      setIsUpdatingPassword(false); return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPasswordMsg({ text: error.message, type: 'error' }); }
    else {
      setPasswordMsg({ text: 'Password berhasil diubah!', type: 'success' });
      setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setPasswordMsg({ text: '', type: 'error' }), 3000);
    }
    setIsUpdatingPassword(false);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) { setSafeLimitDisplay(''); setSafeLimitRaw(0); return; }
    setSafeLimitRaw(Number(rawValue));
    setSafeLimitDisplay(new Intl.NumberFormat('id-ID').format(Number(rawValue)));
  };

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>, type: 'safe' | 'low') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${type}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('widget-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = await supabase.storage.from('widget-images').getPublicUrl(fileName);
      if (type === 'safe') { setBgSafeUrl(publicUrl); setBgSafePos('center'); setBgSafeZoom(1); }
      else { setBgLowUrl(publicUrl); setBgLowPos('center'); setBgLowZoom(1); }
    } catch (error: any) { showDialog('Gagal', 'Gagal upload: ' + error.message, 'danger'); }
    finally { setUploading(prev => ({ ...prev, [type]: false })); }
  };

  const handlePaydayChange = async (day: number) => {
    const before = payday;
    setPayday(day);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('profiles').update({ payday: day }).eq('id', session.user.id);
    if (error) {
      setPayday(before);
      showDialog('Belum Bisa Disimpan', 'Jalankan sql/08_payday.sql di Supabase SQL Editor dulu, lalu coba lagi.', 'danger');
    } else {
      setMsg('Tanggal gajian disimpan.'); setTimeout(() => setMsg(''), 2500);
    }
  };

  // Menyimpan batas saldo + background kartu (tombol Simpan di halaman Batas Saldo & Kartu Saldo)
  const handleSave = async () => {
    setIsSaving(true); setMsg('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsSaving(false); return; }
    const { error } = await supabase.from('profiles').update({
      safe_limit: safeLimitRaw,
      bg_safe_url: bgSafeUrl, bg_safe_pos: bgSafePos, bg_safe_zoom: bgSafeZoom,
      bg_low_url: bgLowUrl, bg_low_pos: bgLowPos, bg_low_zoom: bgLowZoom
    }).eq('id', session.user.id);

    if (error) setMsg('Gagal menyimpan: ' + error.message);
    else { setMsg('Berhasil disimpan!'); setTimeout(() => setMsg(''), 3000); }
    setIsSaving(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const isPasswordValid = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
  const isPasswordMatch = newPassword === confirmPassword && newPassword !== '';

  if (loading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  const themeLabel = theme === 'light' ? 'Terang' : theme === 'dark' ? 'Gelap' : 'Ikuti sistem';
  const SaveBar = ({ label }: { label: string }) => (
    <>
      {msg && <p className="text-center text-sm font-bold text-teal-600 dark:text-teal-400">{msg}</p>}
      <button onClick={handleSave} disabled={isSaving} className={BTN_MAIN}><Save className="w-5 h-5" /> {isSaving ? 'Menyimpan...' : label}</button>
    </>
  );

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-16 transition-colors">
      <AppHeader title={TITLES[view]} onBack={view !== 'hub' ? () => go('hub') : undefined} />

      <main className="max-w-md mx-auto p-5 mt-2 space-y-5">

        {/* ===== MENU UTAMA PENGATURAN ===== */}
        {view === 'hub' && (
          <>
            <button onClick={() => go('profil')} className={`${CARD} w-full flex items-center gap-4 text-left active:scale-[0.99] transition-transform`}>
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-teal-500 shadow-md shrink-0 flex items-center justify-center">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profil" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-extrabold text-gray-900 dark:text-white truncate">{profile?.nickname || 'Sobat'}</p>
                <p className="text-xs text-teal-600 dark:text-teal-400 font-bold">Ubah profil</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-500 shrink-0" />
            </button>

            <Group label="Akun">
              <Row icon={<User className="w-5 h-5" />} title="Profil Saya" sub="Foto profil, foto sampul, nickname" onClick={() => go('profil')} />
              <Row icon={<Lock className="w-5 h-5" />} title="Keamanan" sub="Ganti password" onClick={() => go('keamanan')} />
            </Group>

            <Group label="Atur Uang">
              <Row icon={<CalendarClock className="w-5 h-5" />} title="Tanggal Gajian" sub={payday === 1 ? 'Tanggal 1 (bulan kalender)' : `Tanggal ${payday}`} onClick={() => go('gajian')} />
              <Row icon={<Wallet className="w-5 h-5" />} title="Batas Saldo Aman" sub={formatRupiah(safeLimitRaw)} onClick={() => go('saldo')} />
              <Row icon={<ImageIcon className="w-5 h-5" />} title="Kartu Saldo" sub="Gambar saat saldo aman dan menipis" onClick={() => go('kartu')} />
            </Group>

            <Group label="Aplikasi">
              <Row icon={<Palette className="w-5 h-5" />} title="Tampilan" sub={themeLabel} onClick={() => go('tampilan')} />
              <Row icon={<Bell className="w-5 h-5" />} title="Notifikasi" sub="Pengingat di HP kamu" onClick={() => go('notif')} />
            </Group>

            <Group label="Sesi">
              <Row danger icon={<LogOut className="w-5 h-5" />} title="Keluar" sub="Keluar dari akun ini" onClick={() => showDialog('Keluar dari Celengin?', 'Kamu perlu masuk lagi nanti untuk membuka akunmu.', 'danger', handleLogout)} />
            </Group>
          </>
        )}

        {/* ===== PROFIL SAYA ===== */}
        {view === 'profil' && (
          <>
            <div className="rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="h-32 bg-cover bg-center relative" style={{ backgroundColor: profile?.theme_color || '#0f766e', ...(profile?.cover_url ? { backgroundImage: `url(${profile.cover_url})` } : {}) }}>
                {profile?.cover_url && <div className="absolute inset-0 bg-black/20" />}
              </div>
              <div className="flex flex-col items-center -mt-12 pb-5">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white dark:border-gray-800 shadow-md flex items-center justify-center relative">
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profil" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-gray-400" />}
                </div>
                <p className="mt-2 text-lg font-extrabold text-gray-900 dark:text-white">{profile?.nickname || 'Sobat'}</p>
              </div>
            </div>

            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => handlePickPhoto(e, 'avatar')} />
            <input type="file" accept="image/*" className="hidden" ref={coverInputRef} onChange={(e) => handlePickPhoto(e, 'cover')} />

            <div className={CARD}>
              <h3 className="font-bold text-gray-800 dark:text-white mb-3">Foto Profil</h3>
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className={BTN_SOFT}><Upload className="w-4 h-4" /> {isUploading ? 'Mengunggah...' : 'Ganti Foto'}</button>
                <button onClick={() => removePhoto('avatar')} disabled={!profile?.avatar_url} className={BTN_DANGER_SOFT}><Trash2 className="w-4 h-4" /> Hapus</button>
              </div>
            </div>

            <div className={CARD}>
              <h3 className="font-bold text-gray-800 dark:text-white mb-1">Foto Sampul</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Gambar latar di kartu profilmu.</p>
              <div className="flex gap-2">
                <button onClick={() => coverInputRef.current?.click()} disabled={isUploading} className={BTN_SOFT}><Camera className="w-4 h-4" /> Ganti Sampul</button>
                <button onClick={() => removePhoto('cover')} disabled={!profile?.cover_url} className={BTN_DANGER_SOFT}><Trash2 className="w-4 h-4" /> Hapus</button>
              </div>
            </div>

            <div className={CARD}>
              <h3 className="font-bold text-gray-800 dark:text-white mb-3">Nickname</h3>
              <div className="relative">
                <input type="text" value={newNickname} onChange={(e) => setNewNickname(e.target.value.toLowerCase().replace(/\s/g, ''))} className={`${INPUT} pr-24 ${isNicknameAvailable === false ? 'border-red-400' : isNicknameAvailable === true ? 'border-green-400' : 'border-gray-200 dark:border-gray-600'}`} placeholder="cth: iman123" autoCapitalize="none" autoCorrect="off" />
                {newNickname.length >= 3 && <div className="absolute right-4 top-1/2 -translate-y-1/2">{isCheckingNickname ? <span className="text-xs text-gray-400">Cek...</span> : isNicknameAvailable ? <span className="text-xs text-green-600 dark:text-green-400 font-bold">Tersedia</span> : <span className="text-xs text-red-500 font-bold">Dipakai</span>}</div>}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Minimal 3 huruf, tanpa spasi. Nickname juga bisa dipakai untuk masuk.</p>
              {nickMsg && <p className="text-xs font-bold text-teal-600 dark:text-teal-400 mt-2">{nickMsg}</p>}
              <button onClick={handleUpdateNickname} disabled={isSavingNickname || !isNicknameAvailable || newNickname.length < 3 || newNickname === profile?.nickname} className={`${BTN_MAIN} mt-3`}>{isSavingNickname ? 'Menyimpan...' : 'Simpan Nickname'}</button>
            </div>
          </>
        )}

        {/* ===== KEAMANAN ===== */}
        {view === 'keamanan' && (
          <div className={CARD}>
            <h3 className="font-bold text-gray-800 dark:text-white mb-4">Ganti Password</h3>
            {passwordMsg.text && <div className={`text-xs p-3 rounded-2xl mb-4 border ${passwordMsg.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800'}`}>{passwordMsg.text}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Password Baru</label>
                <div className="relative">
                  <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`${INPUT} pr-12 border-gray-200 dark:border-gray-600`} placeholder="Buat password baru" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} aria-label="Tampilkan password" className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">{showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                </div>
                {newPassword.length > 0 && <PasswordRequirements password={newPassword} />}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Ulangi Password Baru</label>
                <div className="relative">
                  <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${INPUT} pr-12 ${confirmPassword.length > 0 ? (isPasswordMatch ? 'border-green-400' : 'border-red-400') : 'border-gray-200 dark:border-gray-600'}`} placeholder="Ketik ulang password baru" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label="Tampilkan password" className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">{showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                </div>
                {confirmPassword.length > 0 && !isPasswordMatch && <p className="text-xs text-red-500 mt-1">Password tidak cocok.</p>}
                {confirmPassword.length > 0 && isPasswordMatch && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Password cocok.</p>}
              </div>
              <button onClick={handleUpdatePassword} disabled={isUpdatingPassword || !isPasswordValid || !isPasswordMatch} className={BTN_MAIN}>{isUpdatingPassword ? 'Menyimpan...' : 'Simpan Password Baru'}</button>
            </div>
          </div>
        )}

        {/* ===== TANGGAL GAJIAN ===== */}
        {view === 'gajian' && (
          <div className={CARD}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Statistik dan laporan bulanan dihitung dari tanggal ini. Pilih 1 untuk bulan kalender biasa. Tersimpan otomatis.</p>
            <select
              value={payday}
              onChange={(e) => handlePaydayChange(Number(e.target.value))}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-white font-bold text-base"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d === 1 ? 'Tanggal 1 (bulan kalender)' : `Tanggal ${d}`}</option>
              ))}
            </select>
            {todayStr && <p className="text-xs text-teal-700 dark:text-teal-400 font-bold mt-3">Siklus saat ini: {cycleFor(todayStr, payday).label}</p>}
            {msg && <p className="text-xs font-bold text-teal-600 dark:text-teal-400 mt-2">{msg}</p>}
            {!paydayReady && <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-2">Kolom tanggal gajian belum ada. Jalankan sql/08_payday.sql di Supabase dulu.</p>}
          </div>
        )}

        {/* ===== BATAS SALDO AMAN ===== */}
        {view === 'saldo' && (
          <>
            <div className={CARD}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Jika saldo di bawah angka ini, kartu saldo di Home berubah ke gambar "menipis".</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-bold">Rp</span>
                <input type="text" inputMode="numeric" value={safeLimitDisplay} onChange={handleLimitChange} className={`${INPUT} pl-12 border-gray-200 dark:border-gray-600 font-bold text-lg`} placeholder="0" />
              </div>
            </div>
            <SaveBar label="Simpan" />
          </>
        )}

        {/* ===== KARTU SALDO ===== */}
        {view === 'kartu' && (
          <>
            <div className={CARD}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Pilih gambar untuk kartu saldo saat kondisi aman dan saat saldo menipis.</p>
              <CardBgEditor
                safe={{ url: bgSafeUrl, pos: bgSafePos, zoom: bgSafeZoom }}
                low={{ url: bgLowUrl, pos: bgLowPos, zoom: bgLowZoom }}
                uploading={uploading}
                onChange={(side, pos, zoom) => { if (side === 'safe') { setBgSafePos(pos); setBgSafeZoom(zoom); } else { setBgLowPos(pos); setBgLowZoom(zoom); } }}
                onPick={(side) => (side === 'safe' ? fileInputSafeRef : fileInputLowRef).current?.click()}
              />
              <input type="file" accept="image/*" className="hidden" ref={fileInputSafeRef} onChange={(e) => handleUploadBg(e, 'safe')} />
              <input type="file" accept="image/*" className="hidden" ref={fileInputLowRef} onChange={(e) => handleUploadBg(e, 'low')} />
            </div>
            <SaveBar label="Simpan" />
          </>
        )}

        {/* ===== TAMPILAN ===== */}
        {view === 'tampilan' && (
          <div className={CARD}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Pilih mode warna aplikasi. Tersimpan otomatis.</p>
            <div className="grid grid-cols-3 gap-2">
              {[['light', 'Terang', Sun], ['dark', 'Gelap', Moon], ['system', 'Sistem', Monitor]].map(([val, label, Icon]: any) => (
                <button key={val} onClick={() => handleThemeChange(val)} className={`py-4 rounded-2xl text-xs font-bold border-2 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${theme === val ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                  <Icon className="w-5 h-5" /> {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== NOTIFIKASI ===== */}
        {view === 'notif' && <PushSettingsCard showDialog={showDialog} />}
      </main>

      {cropJob && (
        <PhotoCropper
          file={cropJob.file}
          shape={cropJob.kind === 'avatar' ? 'circle' : 'rect'}
          aspect={cropJob.kind === 'avatar' ? 1 : 320 / 150}
          outWidth={cropJob.kind === 'avatar' ? 512 : 960}
          title={cropJob.kind === 'avatar' ? 'Atur foto profil' : 'Atur foto sampul'}
          onCancel={() => setCropJob(null)}
          onConfirm={uploadCropped}
        />
      )}

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </div>
  );
}

'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Upload, Image as ImageIcon, Sun, Moon, Monitor, Palette, User, LogOut, KeyRound, X } from 'lucide-react';
import ImageCropper from '@/components/ImageCropper';
import SkeletonLoader from '@/components/SkeletonLoader';
import PasswordRequirements from '@/components/PasswordRequirements';
import CustomDialog from '@/components/CustomDialog';
import PushSettingsCard from '@/components/PushSettingsCard';

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');
  
  // State Tema & Warna
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [themeColor, setThemeColor] = useState('#0f766e');

  // State Saldo
  const [safeLimitDisplay, setSafeLimitDisplay] = useState('');
  const [safeLimitRaw, setSafeLimitRaw] = useState(0);

  // State Background
  const [bgSafeUrl, setBgSafeUrl] = useState('');
  const [bgSafePos, setBgSafePos] = useState('center');
  const [bgSafeZoom, setBgSafeZoom] = useState(1);
  const [showSafeCropper, setShowSafeCropper] = useState(false);

  const [bgLowUrl, setBgLowUrl] = useState('');
  const [bgLowPos, setBgLowPos] = useState('center');
  const [bgLowZoom, setBgLowZoom] = useState(1);
  const [showLowCropper, setShowLowCropper] = useState(false);

  // State Profil Modal
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

  const [uploading, setUploading] = useState({ safe: false, low: false });
  const fileInputSafeRef = useRef<HTMLInputElement>(null);
  const fileInputLowRef = useRef<HTMLInputElement>(null);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info'|'success'|'danger', onConfirm: undefined as (()=>void)|undefined });
  const showDialog = (title: string, msg: string, type: 'info'|'success'|'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const router = useRouter();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' || 'system';
    setTheme(savedTheme);

    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (data) {
        setProfile(data);
        setThemeColor(data.theme_color || '#0f766e');
        
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

  // Cek ketersediaan nickname (real-time, sama seperti di Dashboard)
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

  // Handle Tema
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Handle Upload Avatar
  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-avatar-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('widget-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('widget-images').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', session.user.id);
      
      // Refresh profile
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data);
    } catch (error: any) {
      showDialog('Gagal', 'Gagal upload: ' + error.message, 'danger');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateNickname = async () => {
    if (!isNicknameAvailable || newNickname.length < 3) return;
    setIsSavingNickname(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('profiles').update({ nickname: newNickname, full_name: newNickname }).eq('id', session.user.id);
    if (!error) { 
      setIsNicknameModalOpen(false); 
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data);
    }
    setIsSavingNickname(false);
  };

  const handleUpdatePassword = async () => {
    if (!isPasswordValid) return setPasswordMsg({ text: 'Password belum memenuhi syarat.', type: 'error' });
    if (!isPasswordMatch) return setPasswordMsg({ text: 'Konfirmasi password tidak cocok.', type: 'error' });
    setIsUpdatingPassword(true); setPasswordMsg({ text: '', type: 'error' });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user.email) return;

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: newPassword });
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
      if (type === 'safe') { setBgSafeUrl(publicUrl); setBgSafePos('center'); setBgSafeZoom(1); setShowSafeCropper(true); }
      else { setBgLowUrl(publicUrl); setBgLowPos('center'); setBgLowZoom(1); setShowLowCropper(true); }
    } catch (error: any) { showDialog('Gagal', 'Gagal upload: ' + error.message, 'danger'); }
    finally { setUploading(prev => ({ ...prev, [type]: false })); }
  };

  const handleSave = async () => {
    setIsSaving(true); setMsg('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('profiles').update({
      safe_limit: safeLimitRaw,
      theme_color: themeColor,
      bg_safe_url: bgSafeUrl, bg_safe_pos: bgSafePos, bg_safe_zoom: bgSafeZoom,
      bg_low_url: bgLowUrl, bg_low_pos: bgLowPos, bg_low_zoom: bgLowZoom
    }).eq('id', session.user.id);

    if (error) setMsg('Gagal menyimpan: ' + error.message);
    else { setMsg('Pengaturan berhasil disimpan!'); setTimeout(() => setMsg(''), 3000); }
    setIsSaving(false);
  };

  const isPasswordValid = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
  const isPasswordMatch = newPassword === confirmPassword && newPassword !== '';

  if (loading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  const THEME_COLORS = ['#0f766e', '#be123c', '#4338ca', '#b45309', '#1e293b', '#6d28d9'];

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-24 transition-colors">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-5 py-4 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 transition-colors">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 dark:text-gray-400 hover:text-teal-600"><ArrowLeft className="w-6 h-6" /></button>
        <span className="font-bold text-xl text-gray-800 dark:text-white">Pengaturan</span>
      </header>

      <main className="max-w-md mx-auto p-5 mt-2 space-y-5">
        
        {/* PROFIL & GAYA */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Profil & Gaya</h3>
          <div className="flex items-center gap-4 mb-4">
            {/* Area Foto Profil */}
            <div 
              onClick={() => fileInputRef.current?.click()} 
              className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-teal-500 shadow-md shrink-0 cursor-pointer group"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-gray-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              )}
              
              {/* Overlay Ikon Upload */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Input File Tersembunyi (Diletakkan di luar div foto) */}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleUploadAvatar} 
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800 dark:text-white">{profile?.nickname || 'Sobat'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Ketuk foto untuk ganti</p>
              <button onClick={() => setIsProfileModalOpen(true)} className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-3 py-1.5 rounded-lg border border-teal-100 dark:border-teal-800">Kelola Akun</button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Mode Tampilan</label>
            <div className="flex gap-2">
              {[['light', 'Terang', Sun], ['dark', 'Gelap', Moon], ['system', 'Sistem', Monitor]].map(([val, label, Icon]: any) => (
                <button key={val} onClick={() => handleThemeChange(val)} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${theme === val ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Warna Tema Profil</label>
            <div className="flex gap-3">
              {THEME_COLORS.map(color => (
                <button key={color} onClick={() => setThemeColor(color)} className={`w-8 h-8 rounded-full border-2 transition-all ${themeColor === color ? 'border-gray-800 dark:border-white scale-110 shadow-md' : 'border-transparent'}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
        </div>

        {/* APLIKASI & NOTIFIKASI */}
        <PushSettingsCard showDialog={showDialog} />

        {/* BATAS SALDO AMAN */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <label className="block font-bold text-gray-800 dark:text-white mb-1">Batas Saldo Aman</label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Jika saldo di bawah angka ini, background berubah jadi gambar menipis.</p>
          <div className="relative">
            <span className="absolute left-4 top-3 text-gray-500 dark:text-gray-400 font-bold">Rp</span>
            <input type="text" inputMode="numeric" value={safeLimitDisplay} onChange={handleLimitChange} className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 font-bold text-lg transition-colors" placeholder="0" />
          </div>
        </div>

        {/* BACKGROUND KARTU */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Background Kartu</h3>
          
          {/* Gambar Aman */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Saat Saldo Aman</label>
              {bgSafeUrl && <button onClick={() => fileInputSafeRef.current?.click()} className="text-xs text-teal-600 font-bold">Ganti</button>}
            </div>
            {!bgSafeUrl ? (
              <button onClick={() => fileInputSafeRef.current?.click()} className="w-full h-24 bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-teal-500 transition-all">
                {uploading.safe ? 'Mengunggah...' : <><Upload className="w-5 h-5 mb-1" /> Pilih Gambar</>}
              </button>
            ) : (
              <div>
                <button onClick={() => setShowSafeCropper(!showSafeCropper)} className="w-full flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300">
                  <span>Atur Posisi</span> {showSafeCropper ? 'Tutup' : 'Buka'}
                </button>
                {showSafeCropper && <ImageCropper imageUrl={bgSafeUrl} initialPos={bgSafePos} initialZoom={bgSafeZoom} onSave={(pos, zoom) => { setBgSafePos(pos); setBgSafeZoom(zoom); }} />}
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" ref={fileInputSafeRef} onChange={(e) => handleUploadBg(e, 'safe')} />
          </div>

          {/* Gambar Menipis */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Saat Saldo Menipis</label>
              {bgLowUrl && <button onClick={() => fileInputLowRef.current?.click()} className="text-xs text-teal-600 font-bold">Ganti</button>}
            </div>
            {!bgLowUrl ? (
              <button onClick={() => fileInputLowRef.current?.click()} className="w-full h-24 bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-teal-500 transition-all">
                {uploading.low ? 'Mengunggah...' : <><Upload className="w-5 h-5 mb-1" /> Pilih Gambar</>}
              </button>
            ) : (
              <div>
                <button onClick={() => setShowLowCropper(!showLowCropper)} className="w-full flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300">
                  <span>Atur Posisi</span> {showLowCropper ? 'Tutup' : 'Buka'}
                </button>
                {showLowCropper && <ImageCropper imageUrl={bgLowUrl} initialPos={bgLowPos} initialZoom={bgLowZoom} onSave={(pos, zoom) => { setBgLowPos(pos); setBgLowZoom(zoom); }} />}
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" ref={fileInputLowRef} onChange={(e) => handleUploadBg(e, 'low')} />
          </div>
        </div>

        {msg && <p className="text-center text-sm font-bold text-teal-600 dark:text-teal-400">{msg}</p>}

        <button onClick={handleSave} disabled={isSaving} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-200 dark:shadow-none transition-all">
          <Save className="w-5 h-5" /> {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </main>

      {/* MODAL KELOLA AKUN */}
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
              <h2 className="text-lg font-bold text-gray-800 dark:text-white bg-white dark:bg-gray-700 rounded-xl py-2 shadow-sm mb-4 inline-block px-6 border border-gray-100 dark:border-gray-600">{profile?.nickname || 'Sobat'}</h2>
              <div className="bg-white dark:bg-gray-700 rounded-2xl border border-gray-100 dark:border-gray-600 shadow-sm overflow-hidden text-sm">
                <button onClick={() => { setNewNickname(profile?.nickname || ''); setIsNicknameModalOpen(true); }} className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 transition-all border-b border-gray-50 dark:border-gray-600 text-left"><User className="w-4 h-4 text-gray-400" /> Ubah Nickname</button>
                <button onClick={() => { setIsProfileModalOpen(false); setIsPasswordModalOpen(true); }} className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 transition-all border-b border-gray-50 dark:border-gray-600 text-left"><KeyRound className="w-4 h-4 text-gray-400" /> Ganti Password</button>
                <button onClick={async () => { setIsProfileModalOpen(false); await supabase.auth.signOut(); router.push('/login'); }} className="w-full flex items-center gap-3 px-4 py-3.5 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/30 transition-all text-left"><LogOut className="w-4 h-4" /> Keluar Akun</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NICKNAME */}
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

      {/* MODAL PASSWORD */}
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
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">{showNewPassword ? <X className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}</button>
                </div>
                {newPassword.length > 0 && <PasswordRequirements password={newPassword} />}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ulangi Password Baru</label>
                <div className="relative">
                  <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`w-full pl-4 pr-12 py-3 rounded-xl border focus:ring-2 focus:ring-teal-500 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white ${confirmPassword.length > 0 && !isPasswordMatch ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`} placeholder="Ketik ulang password baru" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">{showConfirmPassword ? <X className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}</button>
                </div>
                {confirmPassword.length > 0 && !isPasswordMatch && <p className="text-xs text-red-500 mt-1">Password tidak cocok.</p>}
              </div>
              <button onClick={handleUpdatePassword} disabled={isUpdatingPassword || !isPasswordValid || !isPasswordMatch} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 mt-2">{isUpdatingPassword ? 'Menyimpan...' : 'Simpan Password Baru'}</button>
            </div>
          </div>
        </div>
      )}

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </div>
  );
}
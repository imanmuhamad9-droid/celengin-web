'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Upload, Image as ImageIcon, Sparkles, Moon, Sun, Monitor, ChevronUp, ChevronDown } from 'lucide-react';
import ImageCropper from '@/components/ImageCropper';
import SkeletonLoader from '@/components/SkeletonLoader';

export default function SettingsPage() {
  const [safeLimitDisplay, setSafeLimitDisplay] = useState('');
  const [safeLimitRaw, setSafeLimitRaw] = useState(0);
  
  const [bgSafeUrl, setBgSafeUrl] = useState('');
  const [bgSafePos, setBgSafePos] = useState('center');
  const [bgSafeZoom, setBgSafeZoom] = useState(1);
  const [showSafeCropper, setShowSafeCropper] = useState(false);

  const [bgLowUrl, setBgLowUrl] = useState('');
  const [bgLowPos, setBgLowPos] = useState('center');
  const [bgLowZoom, setBgLowZoom] = useState(1);
  const [showLowCropper, setShowLowCropper] = useState(false);
  
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({ safe: false, low: false });
  const [msg, setMsg] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);

  const fileInputSafeRef = useRef<HTMLInputElement>(null);
  const fileInputLowRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' || 'system';
    setTheme(savedTheme);

    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (data) {
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
      setIsPageLoading(false);
    };
    fetchProfile();
  }, [router]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) { setSafeLimitDisplay(''); setSafeLimitRaw(0); return; }
    setSafeLimitRaw(Number(rawValue));
    setSafeLimitDisplay(new Intl.NumberFormat('id-ID').format(Number(rawValue)));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'safe' | 'low') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${type}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('widget-images').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('widget-images').getPublicUrl(filePath);

      if (type === 'safe') { 
        setBgSafeUrl(publicUrl); setBgSafePos('center'); setBgSafeZoom(1); setShowSafeCropper(true); 
      } else { 
        setBgLowUrl(publicUrl); setBgLowPos('center'); setBgLowZoom(1); setShowLowCropper(true); 
      }

    } catch (error: any) {
      alert('Gagal upload gambar: ' + error.message);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSave = async () => {
    setLoading(true); setMsg('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('profiles').update({
      safe_limit: safeLimitRaw,
      bg_safe_url: bgSafeUrl,
      bg_safe_pos: bgSafePos,
      bg_safe_zoom: bgSafeZoom,
      bg_low_url: bgLowUrl,
      bg_low_pos: bgLowPos,
      bg_low_zoom: bgLowZoom
    }).eq('id', session.user.id);

    if (error) setMsg('Gagal menyimpan: ' + error.message);
    else { setMsg('Pengaturan berhasil disimpan!'); setTimeout(() => setMsg(''), 3000); }
    setLoading(false);
  };

  if (isPageLoading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-900"><SkeletonLoader /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors duration-300">
      <header className="bg-white dark:bg-gray-800 px-6 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-10 transition-colors">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 dark:text-gray-400 hover:text-teal-600"><ArrowLeft className="w-6 h-6" /></button>
        <span className="font-bold text-xl text-gray-800 dark:text-white">Pengaturan</span>
      </header>

      <main className="max-w-md mx-auto p-6 mt-2 space-y-5">
        
        {/* PENGATURAN TEMA */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <label className="block font-bold text-gray-800 dark:text-white mb-1">Tema Tampilan</label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Pilih tema yang paling nyaman untuk matamu.</p>
          <div className="flex gap-2">
            <button onClick={() => handleThemeChange('light')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${theme === 'light' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}><Sun className="w-4 h-4" /> Terang</button>
            <button onClick={() => handleThemeChange('dark')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${theme === 'dark' ? 'border-teal-500 bg-teal-900/30 text-teal-400' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}><Moon className="w-4 h-4" /> Gelap</button>
            <button onClick={() => handleThemeChange('system')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 flex items-center justify-center gap-1 transition-all ${theme === 'system' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}><Monitor className="w-4 h-4" /> Sistem</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <label className="block font-bold text-gray-800 dark:text-white mb-1">Batas Saldo Aman (Rp)</label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Jika saldo di bawah angka ini, background akan berubah jadi gambar menipis.</p>
          <div className="relative">
            <span className="absolute left-4 top-3 text-gray-500 dark:text-gray-400 font-bold">Rp</span>
            <input type="text" inputMode="numeric" value={safeLimitDisplay} onChange={handleLimitChange} className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 font-bold text-lg transition-colors" placeholder="0" />
          </div>
        </div>

        {/* Gambar Aman */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-green-500" />
              <label className="font-bold text-gray-800 dark:text-white">Background Aman</label>
            </div>
            {bgSafeUrl && <button onClick={() => fileInputSafeRef.current?.click()} className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline">Ganti</button>}
          </div>
          
          {!bgSafeUrl ? (
            <button onClick={() => fileInputSafeRef.current?.click()} className="w-full h-24 bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:border-teal-500 hover:text-teal-600 transition-all mt-2">
              {uploading.safe ? 'Mengunggah...' : <><Upload className="w-5 h-5 mb-1" /> Pilih Gambar</>}
            </button>
          ) : (
            <div className="mt-2">
              <button onClick={() => setShowSafeCropper(!showSafeCropper)} className="w-full flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 transition-all">
                <span>Atur Posisi Gambar</span>
                {showSafeCropper ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showSafeCropper && <ImageCropper imageUrl={bgSafeUrl} initialPos={bgSafePos} initialZoom={bgSafeZoom} onSave={(pos, zoom) => { setBgSafePos(pos); setBgSafeZoom(zoom); }} />}
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputSafeRef} onChange={(e) => handleUpload(e, 'safe')} />
        </div>

        {/* Gambar Menipis */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-red-500" />
              <label className="font-bold text-gray-800 dark:text-white">Background Menipis</label>
            </div>
            {bgLowUrl && <button onClick={() => fileInputLowRef.current?.click()} className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline">Ganti</button>}
          </div>
          
          {!bgLowUrl ? (
            <button onClick={() => fileInputLowRef.current?.click()} className="w-full h-24 bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:border-teal-500 hover:text-teal-600 transition-all mt-2">
              {uploading.low ? 'Mengunggah...' : <><Upload className="w-5 h-5 mb-1" /> Pilih Gambar</>}
            </button>
          ) : (
            <div className="mt-2">
              <button onClick={() => setShowLowCropper(!showLowCropper)} className="w-full flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 transition-all">
                <span>Atur Posisi Gambar</span>
                {showLowCropper ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showLowCropper && <ImageCropper imageUrl={bgLowUrl} initialPos={bgLowPos} initialZoom={bgLowZoom} onSave={(pos, zoom) => { setBgLowPos(pos); setBgLowZoom(zoom); }} />}
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputLowRef} onChange={(e) => handleUpload(e, 'low')} />
        </div>

        {msg && <p className="text-center text-sm font-bold text-teal-600 dark:text-teal-400">{msg}</p>}

        <button onClick={handleSave} disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-200 dark:shadow-none transition-all">
          <Save className="w-5 h-5" /> {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </main>
    </div>
  );
}
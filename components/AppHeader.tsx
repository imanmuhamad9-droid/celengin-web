'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Info, RefreshCw, Settings, User, X } from 'lucide-react';
import { MENU_INFO } from '@/lib/menuInfo';
import { supabase } from '@/lib/supabaseClient';
import { useRefresh } from '@/components/RefreshProvider';

type Props = {
  /** Nama menu yang sedang dibuka. Dipakai untuk penjelasan ⓘ dan subjudul halaman non-menu (mis. Pengaturan). */
  title?: string;
  /** Hanya untuk kasus khusus (mis. dari dalam sebuah buku Split Bill kembali ke daftar). */
  onBack?: () => void;
  /** Elemen di pojok kanan, mis. lonceng notifikasi */
  topRight?: React.ReactNode;
  /** Tombol aksi di pojok kanan, mis. "+ Tambah" */
  action?: React.ReactNode;
  z?: 'z-40' | 'z-50';
  /** Kunci penjelasan ⓘ bila berbeda dari judul */
  infoKey?: string;
  /** Aksi saat foto profil diketuk. Bawaan: buka /settings */
  onAvatarClick?: () => void;
};

const SEEN_PREFIX = 'celengin:menu-info-seen:';

// Foto profil dibaca sekali per sesi halaman (hanya baca, tidak mengubah data)
let avatarCache: string | null | undefined;

// Top Bar Liquid Glass: logo C + "Celengin" di kiri; Settings + foto profil di kanan; segmented control di bawahnya.
export default function AppHeader({ title, onBack, topRight, action, z = 'z-50', infoKey, onAvatarClick }: Props) {
  const router = useRouter();
  const key = infoKey || title;
  const info = key ? MENU_INFO[key] : undefined;
  const [infoOpen, setInfoOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { refresh, refreshing, stale } = useRefresh();
  const [avatar, setAvatar] = useState<string | null>(avatarCache ?? null);

  useEffect(() => {
    if (avatarCache !== undefined) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('profiles').select('avatar_url').eq('id', session.user.id).maybeSingle();
      const url: string | null = data?.avatar_url ?? null;
      avatarCache = url;
      if (!cancelled) setAvatar(url);
    })();
    return () => { cancelled = true; };
  }, []);

  // Sembunyi saat scroll ke bawah, muncul lagi begitu scroll ke atas (tanpa harus sampai paling atas)
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      if (y < 80) setHidden(false);
      else if (delta > 6) setHidden(true);
      else if (delta < -6) setHidden(false);
      if (Math.abs(delta) > 6) lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!key || !MENU_INFO[key]) { setInfoOpen(false); return; }
    try { setInfoOpen(localStorage.getItem(SEEN_PREFIX + key) !== '1'); } catch { setInfoOpen(true); }
  }, [key]);

  const closeInfo = () => {
    setInfoOpen(false);
    if (!key) return;
    try { localStorage.setItem(SEEN_PREFIX + key, '1'); } catch { /* abaikan */ }
  };

  // Judul menu tampil di kiri atas (kecuali Home yang tanpa judul)
  const pageTitle = title && title !== 'Home' ? title : '';
  const showToolbar = Boolean(action || info || pageTitle);

  return (
    <>
      {/* Bar menempel di atas saat scroll; latar blur supaya konten yang lewat di bawahnya tetap rapi */}
      <header
        className={`sticky top-0 ${z} px-4 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2 transition-transform duration-300 ease-out ${hidden ? '-translate-y-full' : 'translate-y-0'}`}
        style={{ background: 'var(--bar-bg)', WebkitBackdropFilter: 'blur(14px)', backdropFilter: 'blur(14px)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <button onClick={onBack} aria-label="Kembali" className="glass glass-pressable shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[color:var(--text-muted)]">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => router.push('/dashboard')} aria-label="Ke Home" className="glass-pressable flex items-center gap-2.5 min-w-0">
              <img src="/icon.png" alt="" width={36} height={36} className="rounded-xl object-contain shrink-0" />
              <span className="font-bold text-lg tracking-tight truncate" style={{ color: 'var(--text-main)' }}>Celengin</span>
            </button>
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            <button
              onClick={refresh}
              disabled={refreshing}
              aria-label={stale ? 'Muat ulang halaman (data sudah lama)' : 'Muat ulang halaman'}
              className="glass glass-pressable relative w-9 h-9 rounded-full flex items-center justify-center text-[color:var(--text-muted)]"
            >
              <RefreshCw className={`w-[17px] h-[17px] ${refreshing ? 'animate-spin' : ''}`} />
              {stale && !refreshing && <span aria-hidden="true" className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[color:var(--teal-primary)] ring-2 ring-white dark:ring-gray-900" />}
            </button>
            {topRight}
            <button onClick={() => router.push('/settings')} aria-label="Pengaturan" className="glass glass-pressable w-9 h-9 rounded-full flex items-center justify-center text-[color:var(--text-muted)]">
              <Settings className="w-[17px] h-[17px]" />
            </button>
            <button onClick={onAvatarClick ?? (() => router.push('/settings'))} aria-label="Profil" className="glass glass-pressable w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-[color:var(--text-muted)]">
              {avatar ? <img src={avatar} alt="Foto profil" className="w-full h-full object-cover" /> : <User className="w-[17px] h-[17px]" />}
            </button>
          </div>
        </div>

        {showToolbar && (
          <div className="mt-3 flex items-center justify-between gap-3 min-h-[36px]">
            <h1 className="font-extrabold text-2xl tracking-tight truncate" style={{ color: 'var(--text-main)' }}>{pageTitle}</h1>
            <div className="shrink-0 flex items-center gap-2">
              {info && (
                <button
                  onClick={() => (infoOpen ? closeInfo() : setInfoOpen(true))}
                  aria-label="Menu ini untuk apa?"
                  aria-expanded={infoOpen}
                  className={`glass glass-pressable w-9 h-9 rounded-full flex items-center justify-center ${infoOpen ? 'glass-teal' : 'text-[color:var(--text-muted)]'}`}
                >
                  <Info className="w-4 h-4" />
                </button>
              )}
              {action}
            </div>
          </div>
        )}
      </header>

      {info && infoOpen && (
        <div className="max-w-md mx-auto px-4 pt-1">
          <div className="glass relative rounded-3xl p-4">
            <button onClick={closeInfo} aria-label="Sembunyikan penjelasan" className="absolute top-3 right-3 text-[color:var(--text-muted)]"><X className="w-4 h-4" /></button>
            <p className="text-xs font-bold mb-1 pr-6" style={{ color: 'var(--text-main)' }}>{info.heading}</p>
            <p className="text-[11px] leading-relaxed text-[color:var(--text-muted)]">{info.body}</p>
            {info.points && (
              <ul className="mt-2 text-[11px] leading-relaxed space-y-1 list-disc pl-4 text-[color:var(--text-muted)]">
                {info.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
            <button onClick={closeInfo} className="mt-3 text-[11px] font-bold underline underline-offset-2 text-[color:var(--teal-primary)]">Mengerti, sembunyikan</button>
            <p className="text-[10px] mt-1 text-[color:var(--text-muted)]">Bisa dibuka lagi lewat tombol ⓘ di bawah menu.</p>
          </div>
        </div>
      )}
    </>
  );
}

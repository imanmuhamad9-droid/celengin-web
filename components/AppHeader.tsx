'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Info, Settings, User, X } from 'lucide-react';
import { MENU_INFO } from '@/lib/menuInfo';
import { supabase } from '@/lib/supabaseClient';

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
const MENU_LABELS: string[] = ['Home', 'Tantangan', 'Impian', 'Kolektif', 'Split Bill', 'Laporan'];

// Foto profil dibaca sekali per sesi halaman (hanya baca, tidak mengubah data)
let avatarCache: string | null | undefined;

// Top Bar Liquid Glass: logo C + "Celengin" di kiri; Settings + foto profil di kanan; segmented control di bawahnya.
export default function AppHeader({ title, onBack, topRight, action, z = 'z-50', infoKey, onAvatarClick }: Props) {
  const router = useRouter();
  const key = infoKey || title;
  const info = key ? MENU_INFO[key] : undefined;
  const [infoOpen, setInfoOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(avatarCache ?? null);

  useEffect(() => {
    if (avatarCache !== undefined) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('profiles').select('avatar_url').eq('id', session.user.id).maybeSingle();
      avatarCache = data?.avatar_url ?? null;
      if (!cancelled) setAvatar(avatarCache);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!key || !MENU_INFO[key]) { setInfoOpen(false); return; }
    try { setInfoOpen(localStorage.getItem(SEEN_PREFIX + key) !== '1'); } catch (_) { setInfoOpen(true); }
  }, [key]);

  const closeInfo = () => {
    setInfoOpen(false);
    if (!key) return;
    try { localStorage.setItem(SEEN_PREFIX + key, '1'); } catch (_) { /* abaikan */ }
  };

  const pageTitle = title && !MENU_LABELS.includes(title) ? title : '';
  const showToolbar = Boolean(action || info || pageTitle);

  return (
    <>
      <header
        className={`sticky top-0 ${z} px-4 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2`}
        style={{ background: 'color-mix(in srgb, var(--bg-main) 80%, transparent)', WebkitBackdropFilter: 'blur(14px)', backdropFilter: 'blur(14px)' }}
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

          <div className="shrink-0 flex items-center gap-2">
            {topRight}
            <button onClick={() => router.push('/settings')} aria-label="Pengaturan" className="glass glass-pressable w-10 h-10 rounded-full flex items-center justify-center text-[color:var(--text-muted)]">
              <Settings className="w-[18px] h-[18px]" />
            </button>
            <button onClick={onAvatarClick ?? (() => router.push('/settings'))} aria-label="Profil" className="glass glass-pressable w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-[color:var(--text-muted)]">
              {avatar ? <img src={avatar} alt="Foto profil" className="w-full h-full object-cover" /> : <User className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </div>

        {showToolbar && (
          <div className="mt-2.5 flex items-center justify-between gap-3 min-h-[36px]">
            <h1 className="font-bold text-base truncate" style={{ color: 'var(--text-main)' }}>{pageTitle}</h1>
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
          <div className="glass glass-teal relative rounded-3xl p-4">
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

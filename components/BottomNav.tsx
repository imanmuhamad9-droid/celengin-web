'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { NOTIF_EVENT, emitNotifChanged, fetchUnreadCount } from '@/lib/notifications';
import { EXTRA_MENUS, syncExtraMenusFromProfile, useExtraMenus } from '@/lib/menuSettings';
import { useCatatEntry } from '@/lib/catatAction';
import TransactionModal from './TransactionModal';
import CustomDialog from './CustomDialog';

type NavLink = { key: string; label: string; href: string; img: string; also?: string[] };

// Bottom bar kaca melayang: 6 menu utama dengan ikon gambar; Catat = gelembung terpisah di atas menu Laporan.
// Ikon tidak dipilih = abu (grayscale) tembus pandang; dipilih = warna penuh (teal).
const ITEMS: NavLink[] = [
  { key: 'home', label: 'Home', href: '/dashboard', img: '/nav-icons/home.png' },
  { key: 'target', label: 'Tantangan', href: '/spending-challenge', img: '/nav-icons/tantangan.png' },
  { key: 'impian', label: 'Impian', href: '/dream-planner', img: '/nav-icons/impian.png' },
  { key: 'bareng', label: 'Kolektif', href: '/couple', img: '/nav-icons/kolektif.png' },
  { key: 'splitbill', label: 'Split Bill', href: '/splitbill', img: '/nav-icons/splitbill.png', also: ['/gantian'] },
  { key: 'laporan', label: 'Laporan', href: '/reports', img: '/nav-icons/laporan.png', also: ['/transactions', '/bills'] },
];

// Posisi sorotan terakhir, di level modul supaya sorotan meluncur antar halaman
let lastIdx: number | null = null;

const matches = (pathname: string, it: NavLink) =>
  [it.href, ...(it.also || [])].some((p) => pathname === p || pathname.startsWith(p + '/'));

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const curIdx = ITEMS.findIndex((it) => matches(pathname, it));
  const [pos, setPos] = useState<number>(lastIdx !== null && lastIdx >= 0 ? lastIdx : Math.max(curIdx, 0));
  useEffect(() => {
    if (curIdx < 0) return;
    const t = setTimeout(() => { setPos(curIdx); lastIdx = curIdx; }, 30);
    return () => clearTimeout(t);
  }, [curIdx]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastUnread = useRef(0);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  // Hamburger: muncul menggantikan gelembung Catat bila ada menu tambahan yang dinyalakan (Pengaturan > Menu Tambahan).
  // Panel terbuka hanya untuk halaman tempat ia dibuka, jadi otomatis tertutup saat pindah halaman.
  const extras = useExtraMenus();
  const entry = useCatatEntry();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuOpen = openPath === pathname;
  const runCatat = () => { if (entry) entry.run(); else setIsModalOpen(true); };

  useEffect(() => { syncExtraMenusFromProfile(); }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenPath(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // ---- Titik merah notifikasi: realtime + polling 60 detik + saat kembali ke aplikasi ----
  // announce = true -> umumkan ke lonceng di Home supaya daftarnya ikut dimuat ulang
  const refreshUnread = useCallback(async (announce: boolean) => {
    const n = await fetchUnreadCount();
    const changed = n !== lastUnread.current;
    lastUnread.current = n;
    setUnread(n);
    if (announce && changed) emitNotifChanged(n);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      const uid = session.user.id;

      refreshUnread(false);
      timer = setInterval(() => refreshUnread(true), 60000);

      try {
        channel = supabase
          .channel(`notif-${uid}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => {
            fetchUnreadCount().then((n) => { lastUnread.current = n; setUnread(n); emitNotifChanged(n); });
          })
          .subscribe();
      } catch (_) { /* realtime belum aktif: polling tetap jalan */ }
    })();

    const onVisible = () => { if (document.visibilityState === 'visible') refreshUnread(true); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    // Aksi di lonceng (baca / hapus / terima) memberi tahu kita lewat event ini
    const onChanged = (e: Event) => {
      const n = (e as CustomEvent<{ unread?: number }>).detail?.unread;
      if (typeof n === 'number') { lastUnread.current = n; setUnread(n); }
      else refreshUnread(false);
    };
    window.addEventListener(NOTIF_EVENT, onChanged);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener(NOTIF_EVENT, onChanged);
    };
  }, [refreshUnread]);

  // Pindah halaman (mis. habis menerima undangan di halaman lain) -> hitung ulang
  useEffect(() => { refreshUnread(false); }, [pathname, refreshUnread]);

  // Halaman yang sedang tampil memuat ulang datanya lewat event ini
  const handleSuccess = () => {
    window.dispatchEvent(new CustomEvent('celengin:tx-saved'));
    router.refresh();
  };

  const handleSelect = (item: NavLink) => {
    if (pathname !== item.href) {
      // Sorotan langsung meluncur ke menu tujuan selagi halaman dimuat
      const idx = ITEMS.indexOf(item);
      if (idx >= 0 && curIdx >= 0) { setPos(idx); lastIdx = idx; }
      router.push(item.href);
    }
  };

  const renderItem = (item: NavLink) => {
    const active = matches(pathname, item);
    const showDot = item.key === 'home' && unread > 0;
    return (
      <button
        key={item.key}
        onClick={() => handleSelect(item)}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        className={`glass-pressable relative z-10 flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full ${active ? 'text-[color:var(--teal-primary)]' : 'text-[color:var(--text-muted)]'}`}
      >
        <img src={item.img} alt="" className={`w-6 h-6 object-contain transition-all duration-300 ${active ? '' : 'grayscale opacity-55'}`} />
        <span className="text-[9.5px] font-bold whitespace-nowrap">{item.label}</span>
        {showDot && (
          <span className="glass glass-danger absolute top-0 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {!isModalOpen && menuOpen && extras.length > 0 && (
        <div className="fixed inset-0 z-[55]" onClick={() => setOpenPath(null)} aria-hidden="true" />
      )}

      {!isModalOpen && (
        <nav
          aria-label="Menu utama"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
          className="fixed left-1/2 -translate-x-1/2 z-[56] w-[calc(100%-24px)] max-w-[400px]"
        >
          {/* Gelembung di atas ujung kanan bar: Catat (mengikuti halaman) atau, bila ada menu tambahan, hamburger */}
          <div className="absolute right-0 bottom-[calc(100%+10px)]">
            {extras.length > 0 ? (
              <button
                onClick={() => setOpenPath(menuOpen ? null : pathname)}
                aria-label="Menu"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="glass glass-solid-teal glass-pressable w-11 h-11 rounded-full flex items-center justify-center"
              >
                {menuOpen ? <X className="w-5 h-5" strokeWidth={2.6} /> : <Menu className="w-5 h-5" strokeWidth={2.6} />}
              </button>
            ) : (
              <button
                onClick={runCatat}
                aria-label={entry?.long || 'Catat transaksi'}
                className="glass glass-solid-teal glass-pressable h-11 px-5 rounded-full flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" strokeWidth={2.6} />
                <span className="text-xs font-extrabold leading-none">{entry?.label || 'Catat'}</span>
              </button>
            )}

            {extras.length > 0 && menuOpen && (
              <div role="menu" className="absolute right-0 bottom-[calc(100%+8px)] w-56 glass glass-sheet rounded-3xl p-2 space-y-1">
                <button
                  role="menuitem"
                  onClick={() => { setOpenPath(null); runCatat(); }}
                  className="glass glass-solid-teal glass-pressable w-full h-11 rounded-full flex items-center gap-2 px-4 text-sm font-bold"
                >
                  <Plus className="w-4 h-4 shrink-0" strokeWidth={2.6} />
                  <span className="truncate">{entry?.long || 'Catat transaksi'}</span>
                </button>
                {EXTRA_MENUS.filter((m) => extras.includes(m.key)).map((m) => {
                  const on = pathname === m.href || pathname.startsWith(m.href + '/');
                  return (
                    <button
                      key={m.key}
                      role="menuitem"
                      onClick={() => { setOpenPath(null); if (!on) router.push(m.href); }}
                      className={`glass-pressable w-full h-11 rounded-full flex items-center gap-2.5 px-4 text-sm font-bold ${on ? 'text-[color:var(--teal-primary)]' : ''}`}
                      style={on ? { background: 'rgba(44, 143, 126, 0.14)' } : { color: 'var(--text-main)' }}
                    >
                      <m.Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass rounded-full px-2 py-1.5">
            <div className="relative flex items-center">
              {curIdx >= 0 && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
                  style={{ width: `${100 / ITEMS.length}%`, transform: `translateX(${pos * 100}%)` }}
                >
                  <span className="block h-full mx-0.5 rounded-full" style={{ background: 'rgba(44, 143, 126, 0.14)', boxShadow: 'inset 0 0 0 1px rgba(44, 143, 126, 0.30)' }} />
                </span>
              )}
              {ITEMS.map(renderItem)}
            </div>
          </div>
        </nav>
      )}

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} showDialog={showDialog} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </>
  );
}

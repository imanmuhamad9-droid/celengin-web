'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Menu, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { NOTIF_EVENT, emitNotifChanged, fetchUnreadCount } from '@/lib/notifications';
import TransactionModal from './TransactionModal';
import CustomDialog from './CustomDialog';

type Item =
  | { key: string; label: string; href: string; img: string }
  | { key: 'catat'; label: string; action: 'catat' };

// Bar melayang berisi 5 menu utama. Di sub menu (Tagihan, Dompet, Laporan, dst.) bar mengecil jadi tombol burger
// di pojok kanan bawah; kalau diketuk, 5 menu utama yang sama melebar ke kiri. Sub menu dibuka dari Home -> "Semua".
const ITEMS: Item[] = [
  { key: 'home', label: 'Home', href: '/dashboard', img: '/icon-home.png' },
  { key: 'target', label: 'Target', href: '/spending-challenge', img: '/icon-target.png' },
  { key: 'catat', label: 'Catat', action: 'catat' },
  { key: 'impian', label: 'Impian', href: '/dream-planner', img: '/icon-dream.png' },
  { key: 'bareng', label: 'Bareng', href: '/couple', img: '/icon-couple.png' },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastUnread = useRef(0);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  // Tutup menu saat pindah halaman atau menekan Escape
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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

  const handleSelect = (item: Item) => {
    setOpen(false);
    if ('action' in item) { setIsModalOpen(true); return; }
    if (pathname !== item.href) router.push(item.href);
  };

  const isMain = ITEMS.some((it) => 'href' in it && (pathname === it.href || pathname.startsWith(it.href + '/')));
  const bottomStyle: React.CSSProperties = { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' };

  const renderItem = (item: Item) => {
    if ('action' in item) {
      return (
        <button
          key={item.key}
          onClick={() => handleSelect(item)}
          aria-label="Catat transaksi"
          className="flex-1 min-w-0 flex flex-col items-center"
        >
          <span className="-mt-6 w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-900/30 border-4 border-white/80 dark:border-gray-900/80 active:scale-95 transition-transform">
            <Plus className="w-6 h-6" />
          </span>
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 mt-0.5">{item.label}</span>
        </button>
      );
    }

    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    const showDot = item.key === 'home' && unread > 0;

    return (
      <button
        key={item.key}
        onClick={() => handleSelect(item)}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full transition-all active:scale-95 ${active ? 'bg-teal-500/20 dark:bg-teal-400/20 ring-1 ring-teal-500/50' : 'bg-transparent'}`}
      >
        <img src={item.img} alt="" className={`w-6 h-6 object-contain transition-all ${active ? '' : 'grayscale opacity-60'}`} />
        <span className={`text-[10px] font-bold ${active ? 'text-teal-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400'}`}>{item.label}</span>
        {showDot && (
          <span className="absolute top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-gray-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    );
  };

  const glass = 'bg-white/65 dark:bg-gray-900/65 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-lg shadow-black/10';

  return (
    <>
      {isMain ? (
        // Menu utama: bar melayang selalu terlihat
        !isModalOpen && (
          <nav aria-label="Menu utama" style={bottomStyle} className="fixed left-1/2 -translate-x-1/2 z-[56] w-[calc(100%-32px)] max-w-[380px]">
            <div className={`flex items-center gap-1 rounded-full px-2 py-1.5 ${glass}`}>
              {ITEMS.map((item) => renderItem(item))}
            </div>
          </nav>
        )
      ) : (
        // Sub menu: tombol burger kanan bawah, menu utama melebar ke kiri
        !isModalOpen && (
          <>
            {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-[55]" />}
            <nav aria-label="Menu utama" style={bottomStyle} className="fixed right-4 z-[56] flex items-center gap-2 max-w-[calc(100%-32px)]">
              <div
                aria-hidden={!open}
                className={`min-w-0 flex-1 origin-right transition-all duration-300 ease-out ${open ? 'opacity-100 scale-x-100 pointer-events-auto' : 'opacity-0 scale-x-50 pointer-events-none'}`}
              >
                <div className={`flex items-center gap-1 rounded-full px-2 py-1.5 w-[300px] max-w-full ${glass}`}>
                  {ITEMS.map((item) => renderItem(item))}
                </div>
              </div>
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Tutup menu' : unread > 0 ? `Buka menu, ${unread} notifikasi belum dibaca` : 'Buka menu'}
                aria-expanded={open}
                className={`relative shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-teal-700 dark:text-teal-300 active:scale-95 transition-transform ${glass}`}
              >
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                {unread > 0 && !open && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-gray-900">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            </nav>
          </>
        )
      )}

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} showDialog={showDialog} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </>
  );
}

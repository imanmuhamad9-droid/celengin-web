'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, History, Plus, Receipt, User } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { NOTIF_EVENT, emitNotifChanged, fetchUnreadCount } from '@/lib/notifications';
import TransactionModal from './TransactionModal';
import CustomDialog from './CustomDialog';

type NavLink = { key: string; label: string; href: string; icon: typeof Home; also?: string[] };

// Bottom bar kaca melayang: tepat 5 menu. Catat (tengah) membuka modal Catat + OCR yang sudah ada.
const LEFT: NavLink[] = [
  { key: 'beranda', label: 'Beranda', href: '/dashboard', icon: Home },
  { key: 'riwayat', label: 'Riwayat', href: '/transactions', icon: History },
];
const RIGHT: NavLink[] = [
  { key: 'splitbill', label: 'Split Bill', href: '/splitbill', icon: Receipt, also: ['/gantian'] },
  { key: 'profil', label: 'Profil', href: '/settings', icon: User },
];

const matches = (pathname: string, it: NavLink) =>
  [it.href, ...(it.also || [])].some((p) => pathname === p || pathname.startsWith(p + '/'));

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastUnread = useRef(0);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

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
    if (pathname !== item.href) router.push(item.href);
  };

  const renderItem = (item: NavLink) => {
    const active = matches(pathname, item);
    const Icon = item.icon;
    const showDot = item.key === 'beranda' && unread > 0;
    return (
      <button
        key={item.key}
        onClick={() => handleSelect(item)}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        className={`glass-pressable relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full ${active ? 'text-[color:var(--teal-primary)]' : 'text-[color:var(--text-muted)]'}`}
        style={active ? { background: 'rgba(44, 143, 126, 0.14)' } : undefined}
      >
        <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 2} />
        <span className="text-[10px] font-bold">{item.label}</span>
        {showDot && (
          <span className="glass glass-danger absolute top-0 right-3 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {!isModalOpen && (
        <nav
          aria-label="Menu utama"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
          className="fixed left-1/2 -translate-x-1/2 z-[56] w-[calc(100%-24px)] max-w-[400px]"
        >
          <div className="glass rounded-full px-2 py-1.5 flex items-center">
            {LEFT.map(renderItem)}
            <div className="flex-1 min-w-0 flex flex-col items-center">
              <button
                onClick={() => setIsModalOpen(true)}
                aria-label="Catat transaksi"
                className="glass glass-solid-teal glass-pressable -mt-7 w-[60px] h-[60px] rounded-full flex items-center justify-center"
              >
                <Plus className="w-7 h-7" strokeWidth={2.6} />
              </button>
              <span className="text-[10px] font-bold mt-0.5 text-[color:var(--teal-primary)]">Catat</span>
            </div>
            {RIGHT.map(renderItem)}
          </div>
        </nav>
      )}

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} showDialog={showDialog} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </>
  );
}

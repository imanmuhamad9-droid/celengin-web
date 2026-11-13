'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { NOTIF_EVENT, emitNotifChanged, fetchUnreadCount } from '@/lib/notifications';
import TransactionModal from './TransactionModal';
import CustomDialog from './CustomDialog';

type Item =
  | { key: string; label: string; href: string; img: string }
  | { key: 'catat'; label: string; action: 'catat' };

// Menu burger hanya 5 menu utama. Fitur lain (Riwayat, Tagihan, Laporan, Split Bill, Dompet, Badge, Setelan)
// ada di kartu pintasan Home -> tombol "Semua".
const ITEMS: Item[] = [
  { key: 'home', label: 'Home', href: '/dashboard', img: '/icon-home.png' },
  { key: 'target', label: 'Target', href: '/spending-challenge', img: '/icon-target.png' },
  { key: 'catat', label: 'Catat', action: 'catat' },
  { key: 'impian', label: 'Impian', href: '/dream-planner', img: '/icon-dream.png' },
  { key: 'bareng', label: 'Bareng', href: '/couple', img: '/icon-couple.png' },
];

/** Posisi (x,y) item pada setengah lingkaran di atas tombol. Sudut 165° (kiri) sampai 15° (kanan). */
function place(index: number, count: number, radius: number) {
  const from = 165, to = 15;
  const deg = count === 1 ? 90 : from - ((from - to) / (count - 1)) * index;
  const rad = (deg * Math.PI) / 180;
  return { x: Math.round(radius * Math.cos(rad)), y: -Math.round(radius * Math.sin(rad)) };
}

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

  const renderItem = (item: Item, pos: { x: number; y: number }, order: number) => {
    const isCatat = 'action' in item;
    const active = !isCatat && pathname === item.href;
    const style: React.CSSProperties = open
      ? { transform: `translate(${pos.x}px, ${pos.y}px) rotate(0deg) scale(1)`, opacity: 1, transitionDelay: `${order * 40}ms` }
      : { transform: 'translate(0px, 0px) rotate(-300deg) scale(0.2)', opacity: 0, transitionDelay: '0ms' };

    return (
      <button
        key={item.key}
        onClick={() => handleSelect(item)}
        tabIndex={open ? 0 : -1}
        aria-label={item.label}
        style={style}
        className={`absolute left-0 top-0 -ml-[24px] -mt-[24px] w-12 flex flex-col items-center transition-all duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <span
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 ${
            isCatat
              ? 'bg-teal-600 border-white dark:border-gray-900 text-white'
              : active
                ? 'bg-teal-50 dark:bg-teal-900/60 border-teal-400 text-teal-700 dark:text-teal-300'
                : 'bg-white dark:bg-gray-800 border-white dark:border-gray-700 text-teal-700 dark:text-teal-400'
          }`}
        >
          {'img' in item ? (
            <img src={item.img} alt="" className="w-7 h-7 object-contain" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </span>
        <span className="mt-1 text-[10px] font-bold text-white whitespace-nowrap [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Latar gelap: tekan di luar menu untuk menutup */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[55] bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {!isModalOpen && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[56] w-0 h-0"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 44px)' }}
        >
          {ITEMS.map((item, i) => renderItem(item, place(i, ITEMS.length, 108), i))}

          {/* Tombol burger */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Tutup menu' : unread > 0 ? `Buka menu, ${unread} notifikasi belum dibaca` : 'Buka menu'}
            aria-expanded={open}
            className={`absolute left-0 top-0 -ml-7 -mt-7 w-14 h-14 rounded-full bg-teal-600 text-white shadow-lg shadow-teal-900/30 border-4 border-white dark:border-gray-900 flex items-center justify-center active:scale-95 transition-transform duration-500 ${open ? 'rotate-180' : 'rotate-0'}`}
          >
            <span className="relative block w-5 h-4">
              <span className={`absolute left-0 w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${open ? 'top-[7px] rotate-45' : 'top-0'}`} />
              <span className={`absolute left-0 top-[7px] w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${open ? 'opacity-0 scale-x-0' : 'opacity-100'}`} />
              <span className={`absolute left-0 w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${open ? 'top-[7px] -rotate-45' : 'top-[14px]'}`} />
            </span>
          </button>

          {/* Titik merah di luar tombol agar tidak ikut berputar */}
          {unread > 0 && !open && (
            <span className="absolute left-[10px] top-[-34px] pointer-events-none min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-gray-900">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
      )}

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} showDialog={showDialog} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </>
  );
}

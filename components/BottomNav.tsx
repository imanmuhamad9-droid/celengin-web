'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Menu, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { NOTIF_EVENT, emitNotifChanged, fetchUnreadCount } from '@/lib/notifications';
import TransactionModal from './TransactionModal';
import CustomDialog from './CustomDialog';

type Item =
  | { key: string; label: string; href: string; img: string; also?: string[] }
  | { key: 'catat'; label: string; action: 'catat' };

// Bar melayang berisi menu utama. Di halaman lain (Pengaturan, Pencapaian, dst.) bar mengecil jadi tombol burger
// di pojok kanan bawah; kalau diketuk, 5 menu utama yang sama melebar ke kiri. Sub menu dibuka dari Home -> "Semua".
const ITEMS: Item[] = [
  { key: 'home', label: 'Home', href: '/dashboard', img: '/nav-icons/home.png' },
  { key: 'target', label: 'Tantangan', href: '/spending-challenge', img: '/nav-icons/tantangan.png' },
  { key: 'impian', label: 'Impian', href: '/dream-planner', img: '/nav-icons/impian.png' },
  // Kolektif hanya berisi Nabung Bareng
  { key: 'bareng', label: 'Kolektif', href: '/couple', img: '/nav-icons/kolektif.png' },
  // Split Bill mencakup dua tab: Patungan (/splitbill), Bayarin (/gantian)
  { key: 'splitbill', label: 'Split Bill', href: '/splitbill', img: '/nav-icons/splitbill.png', also: ['/gantian'] },
  // Laporan mencakup tiga tab: Tagihan, Riwayat, Laporan
  { key: 'laporan', label: 'Laporan', href: '/reports', img: '/menu-icons/laporan.png', also: ['/transactions', '/bills'] },
];

// Posisi sorotan terakhir. Setiap halaman memasang BottomNav sendiri, jadi posisi ini disimpan di level modul
// supaya sorotan bisa meluncur dari menu lama ke menu baru setelah halaman berganti.
let lastIdx: number | null = null;

const matches = (pathname: string, it: Item) =>
  'href' in it && [it.href, ...(it.also || [])].some((p) => pathname === p || pathname.startsWith(p + '/'));

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
    if (pathname !== item.href) {
      // Sorotan langsung meluncur ke menu tujuan selagi halaman dimuat
      const idx = ITEMS.indexOf(item);
      if (idx >= 0 && curIdx >= 0) { setPos(idx); lastIdx = idx; }
      router.push(item.href);
    }
  };

  // Bar menu selalu tampil di semua halaman (termasuk Pengaturan) supaya mudah kembali; sorotan hanya muncul di menu utama.
  const isMain = true;
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

    const active = matches(pathname, item);
    const showDot = item.key === 'home' && unread > 0;

    return (
      <button
        key={item.key}
        onClick={() => handleSelect(item)}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        className="relative z-10 flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full active:scale-95 transition-transform"
      >
        <img src={item.img} alt="" className={`w-7 h-7 object-contain transition-all duration-300 ${active ? '' : 'grayscale opacity-60'}`} />
        <span className={`text-[10px] font-bold transition-colors duration-300 ${active ? 'text-teal-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400'}`}>{item.label}</span>
        {showDot && (
          <span className="absolute top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-gray-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    );
  };

  // Catat: gelembung tersendiri, melayang di atas menu Laporan (ujung kanan bar)
  const catatBubble = (
    <button
      onClick={() => { setOpen(false); setIsModalOpen(true); }}
      aria-label="Catat transaksi"
      className="shrink-0 w-14 h-14 rounded-full border-2 btn-accent backdrop-blur-xl flex flex-col items-center justify-center active:scale-95 transition-transform"
    >
      <Plus className="w-5 h-5" />
      <span className="text-[9px] font-extrabold leading-none mt-0.5">Catat</span>
    </button>
  );

  const glass = 'bg-white/65 dark:bg-gray-900/65 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-lg shadow-black/10';

  const renderBar = (extra: string) => (
    <div className={`relative rounded-full px-2 py-1.5 ${glass} ${extra}`}>
      <div className="relative flex items-center">
        {curIdx >= 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
            style={{ width: `${100 / ITEMS.length}%`, transform: `translateX(${pos * 100}%)` }}
          >
            <span className="block h-full mx-0.5 rounded-full bg-teal-500/20 dark:bg-teal-400/20 ring-1 ring-teal-500/50" />
          </span>
        )}
        {ITEMS.map((item) => renderItem(item))}
      </div>
    </div>
  );


  return (
    <>
      {isMain ? (
        // Menu utama: bar melayang selalu terlihat
        !isModalOpen && (
          <nav aria-label="Menu utama" style={bottomStyle} className="fixed left-1/2 -translate-x-1/2 z-[56] w-[calc(100%-24px)] max-w-[400px]">
            <div className="absolute right-0 bottom-[calc(100%+10px)]">{catatBubble}</div>
            {renderBar('')}
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
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">{renderBar('w-[300px] max-w-full')}</div>
                  {catatBubble}
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

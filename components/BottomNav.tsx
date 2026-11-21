'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { NOTIF_EVENT, emitNotifChanged, fetchUnreadCount } from '@/lib/notifications';
import { syncExtraMenusFromProfile } from '@/lib/menuSettings';
import { useCatatEntry } from '@/lib/catatAction';
import TransactionModal from './TransactionModal';
import CustomDialog from './CustomDialog';

type NavLink = { key: string; label: string; href: string; img: string; also?: string[] };

// Bottom bar kaca melayang simetris: 3 menu | tombol Catat (+) di tengah | 3 menu.
// Ikon tidak dipilih = abu (grayscale) tembus pandang; dipilih = warna penuh (teal).
const ITEMS: NavLink[] = [
  { key: 'home', label: 'Home', href: '/dashboard', img: '/nav-icons/home.png' },
  { key: 'impian', label: 'Impian', href: '/dream-planner', img: '/nav-icons/impian.png' },
  { key: 'bareng', label: 'Kolektif', href: '/couple', img: '/nav-icons/kolektif.png' },
  { key: 'splitbill', label: 'Split Bill', href: '/splitbill', img: '/nav-icons/splitbill.png', also: ['/gantian'] },
  { key: 'cicilan', label: 'Cicilan', href: '/installments', img: '/nav-icons/cicilan.png' },
  { key: 'laporan', label: 'Laporan', href: '/reports', img: '/nav-icons/laporan.png', also: ['/transactions', '/bills'] },
];
const HALF = ITEMS.length / 2;
const CENTER_W = 64; // lebar kolom tombol Catat (px)

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

  const entry = useCatatEntry();
  const runCatat = () => { if (entry) entry.run(); else setIsModalOpen(true); };

  useEffect(() => { syncExtraMenusFromProfile(); }, []);

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
      } catch { /* realtime belum aktif: polling tetap jalan */ }
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
        className={`glass-pressable relative z-10 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full ${active ? 'text-[color:var(--teal-primary)]' : 'text-[color:var(--text-muted)]'}`}
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
      {!isModalOpen && (
        <nav
          aria-label="Menu utama"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
          className="fixed left-1/2 -translate-x-1/2 z-[56] w-[calc(100%-24px)] max-w-[400px]"
        >
          <div className="glass rounded-full px-2 py-1.5">
            <div className="relative grid items-center" style={{ gridTemplateColumns: `repeat(${HALF}, 1fr) ${CENTER_W}px repeat(${HALF}, 1fr)` }}>
              {curIdx >= 0 && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
                  style={{ width: `calc((100% - ${CENTER_W}px) / ${ITEMS.length})`, transform: `translateX(calc(${pos * 100}% + ${pos >= HALF ? CENTER_W : 0}px))` }}
                >
                  <span className="block h-full mx-0.5 rounded-full" style={{ background: 'rgba(2, 132, 199, 0.14)', boxShadow: 'inset 0 0 0 1px rgba(2, 132, 199, 0.30)' }} />
                </span>
              )}
              {ITEMS.slice(0, HALF).map(renderItem)}
              <div className="flex justify-center">
                <button
                  onClick={runCatat}
                  aria-label={entry?.long || 'Catat transaksi'}
                  className="glass glass-solid-teal glass-pressable w-14 h-14 -translate-y-3 rounded-full flex items-center justify-center"
                >
                  <Plus className="w-6 h-6" strokeWidth={2.8} />
                </button>
              </div>
              {ITEMS.slice(HALF).map(renderItem)}
            </div>
          </div>
        </nav>
      )}

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} showDialog={showDialog} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </>
  );
}

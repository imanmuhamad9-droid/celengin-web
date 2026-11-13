'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, History, Receipt, BarChart3, Users2, Wallet, Trophy, Settings } from 'lucide-react';
import TransactionModal from './TransactionModal';
import CustomDialog from './CustomDialog';

type Item =
  | { key: string; label: string; href: string; img: string }
  | { key: string; label: string; href: string; Icon: React.ComponentType<{ className?: string }> }
  | { key: 'catat'; label: string; action: 'catat' };

// Cincin dalam (5 menu utama) dan cincin luar (7 menu lainnya)
const INNER: Item[] = [
  { key: 'home', label: 'Home', href: '/dashboard', img: '/icon-home.png' },
  { key: 'target', label: 'Target', href: '/spending-challenge', img: '/icon-target.png' },
  { key: 'catat', label: 'Catat', action: 'catat' },
  { key: 'impian', label: 'Impian', href: '/dream-planner', img: '/icon-dream.png' },
  { key: 'bareng', label: 'Bareng', href: '/couple', img: '/icon-couple.png' },
];
const OUTER: Item[] = [
  { key: 'riwayat', label: 'Riwayat', href: '/transactions', Icon: History },
  { key: 'tagihan', label: 'Tagihan', href: '/bills', Icon: Receipt },
  { key: 'laporan', label: 'Laporan', href: '/reports', Icon: BarChart3 },
  { key: 'split', label: 'Split Bill', href: '/splitbill', Icon: Users2 },
  { key: 'dompet', label: 'Dompet', href: '/wallets', Icon: Wallet },
  { key: 'badge', label: 'Badge', href: '/badges', Icon: Trophy },
  { key: 'setelan', label: 'Setelan', href: '/settings', Icon: Settings },
];

/** Posisi (x,y) item pada setengah lingkaran di atas tombol. Sudut 160° (kiri) sampai 20° (kanan). */
function place(index: number, count: number, radius: number) {
  const from = 160, to = 20;
  const deg = count === 1 ? 90 : from - ((from - to) / (count - 1)) * index;
  const rad = (deg * Math.PI) / 180;
  return { x: Math.round(radius * Math.cos(rad)), y: -Math.round(radius * Math.sin(rad)) };
}

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      ? { transform: `translate(${pos.x}px, ${pos.y}px) rotate(0deg) scale(1)`, opacity: 1, transitionDelay: `${order * 28}ms` }
      : { transform: 'translate(0px, 0px) rotate(-300deg) scale(0.2)', opacity: 0, transitionDelay: '0ms' };

    return (
      <button
        key={item.key}
        onClick={() => handleSelect(item)}
        tabIndex={open ? 0 : -1}
        aria-label={item.label}
        style={style}
        className={`absolute left-0 top-0 -ml-[22px] -mt-[22px] w-11 flex flex-col items-center transition-all duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <span
          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg border-2 ${
            isCatat
              ? 'bg-teal-600 border-white dark:border-gray-900 text-white'
              : active
                ? 'bg-teal-50 dark:bg-teal-900/60 border-teal-400 text-teal-700 dark:text-teal-300'
                : 'bg-white dark:bg-gray-800 border-white dark:border-gray-700 text-teal-700 dark:text-teal-400'
          }`}
        >
          {'img' in item ? (
            <img src={item.img} alt="" className="w-6 h-6 object-contain" />
          ) : 'Icon' in item ? (
            <item.Icon className="w-5 h-5" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </span>
        <span className="mt-1 text-[9px] font-bold text-white whitespace-nowrap [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">{item.label}</span>
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
          {/* Cincin luar dulu agar berada di belakang cincin dalam */}
          {OUTER.map((item, i) => renderItem(item, place(i, OUTER.length, 162), INNER.length + i))}
          {INNER.map((item, i) => renderItem(item, place(i, INNER.length, 92), i))}

          {/* Tombol burger */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={open}
            className={`absolute left-0 top-0 -ml-7 -mt-7 w-14 h-14 rounded-full bg-teal-600 text-white shadow-lg shadow-teal-900/30 border-4 border-white dark:border-gray-900 flex items-center justify-center active:scale-95 transition-transform duration-500 ${open ? 'rotate-180' : 'rotate-0'}`}
          >
            <span className="relative block w-5 h-4">
              <span className={`absolute left-0 w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${open ? 'top-[7px] rotate-45' : 'top-0'}`} />
              <span className={`absolute left-0 top-[7px] w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${open ? 'opacity-0 scale-x-0' : 'opacity-100'}`} />
              <span className={`absolute left-0 w-5 h-0.5 bg-white rounded-full transition-all duration-300 ${open ? 'top-[7px] -rotate-45' : 'top-[14px]'}`} />
            </span>
          </button>
        </div>
      )}

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} showDialog={showDialog} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </>
  );
}

'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

type Props = {
  /** Judul halaman (baris bawah). Kosongkan untuk Home. */
  title?: string;
  /** Tampilkan panah kembali di baris judul (untuk sub menu) */
  back?: boolean;
  /** Bila diisi, dipakai menggantikan perilaku kembali bawaan (ke Home) */
  onBack?: () => void;
  /** Pojok kanan baris logo, mis. lonceng notifikasi */
  topRight?: React.ReactNode;
  /** Tombol aksi di ujung kanan baris judul, mis. "+ Tambah" */
  action?: React.ReactNode;
  z?: 'z-40' | 'z-50';
};

// Header seragam: baris atas selalu logo + "Celengin.", baris bawah judul halaman yang sedang dibuka.
export default function AppHeader({ title, back = false, onBack, topRight, action, z = 'z-50' }: Props) {
  const router = useRouter();
  const goBack = () => { if (onBack) onBack(); else router.push('/dashboard'); };

  return (
    <header className={`sticky top-0 ${z} bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors`}>
      <div className="px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-bold text-xl text-teal-800 dark:text-teal-400">Celengin.</span>
        </div>
        {topRight}
      </div>
      {title && (
        <div className="px-5 pb-3 -mt-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {back && (
              <button onClick={goBack} aria-label="Kembali" className="shrink-0 -ml-1 p-1 text-gray-500 dark:text-gray-400 hover:text-teal-600 active:scale-95 transition-transform">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="font-bold text-lg text-gray-800 dark:text-white truncate">{title}</h1>
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </div>
      )}
    </header>
  );
}

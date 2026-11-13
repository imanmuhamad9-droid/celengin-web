'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

type Props = {
  /** Nama menu yang sedang dibuka. Kosong = Home (menampilkan "Celengin."). */
  title?: string;
  /** Hanya untuk kasus khusus (mis. dari dalam sebuah buku Split Bill kembali ke daftar). Kembali ke Home cukup dengan menekan logo. */
  onBack?: () => void;
  /** Elemen di pojok kanan, mis. lonceng notifikasi */
  topRight?: React.ReactNode;
  /** Tombol aksi di pojok kanan, mis. "+ Tambah" */
  action?: React.ReactNode;
  z?: 'z-40' | 'z-50';
};

// Header seragam satu baris: logo + nama menu (Home = "Celengin."). Menekan logo selalu kembali ke Home.
export default function AppHeader({ title, onBack, topRight, action, z = 'z-50' }: Props) {
  const router = useRouter();

  return (
    <header className={`sticky top-0 ${z} bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors`}>
      <div className="px-5 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button onClick={onBack} aria-label="Kembali" className="shrink-0 -ml-2 p-1.5 text-gray-500 dark:text-gray-400 hover:text-teal-600 active:scale-95 transition-transform">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <button onClick={() => router.push('/dashboard')} aria-label="Ke Home" className="shrink-0 active:scale-90 transition-transform">
            <img src="/icon.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          </button>
          <h1 className="font-bold text-xl text-teal-800 dark:text-teal-400 truncate">{title || 'Celengin.'}</h1>
        </div>
        {(action || topRight) && (
          <div className="shrink-0 flex items-center gap-2">{action}{topRight}</div>
        )}
      </div>
    </header>
  );
}

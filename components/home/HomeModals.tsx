'use client';
import { LogOut, Settings, User, X } from 'lucide-react';
import type { Profile, Transaction } from '@/lib/types';
import { formatRupiah } from '@/lib/utils';

// Modal-modal kecil di Home: profil, detail kategori, dan dua penjelasan (jatah harian, streak).

export function ProfileModal({ profile, displayName, onClose, onSettings, onLogout }: {
  profile: Profile | null;
  displayName: string | undefined;
  onClose: () => void;
  onSettings: () => void;
  onLogout: () => void;
}) {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="bg-gray-50 dark:bg-gray-800 rounded-3xl w-full max-w-xs relative overflow-hidden shadow-2xl">
        <div className="pt-6 pb-12 flex flex-col items-center relative bg-cover bg-center" style={{ backgroundColor: profile?.theme_color || '#0369a1', ...(profile?.cover_url ? { backgroundImage: `url(${profile.cover_url})` } : {}) }}>
          {profile?.cover_url && <div className="absolute inset-0 bg-black/25" />}
          <button onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 z-10 text-white/80 hover:text-white bg-black/20 rounded-full p-1"><X className="w-5 h-5" /></button>
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md relative z-10 mt-2 flex items-center justify-center">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-gray-400" />}
          </div>
        </div>
        <div className="px-5 pb-5 -mt-6 text-center relative z-10">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white bg-white dark:bg-gray-700 rounded-xl py-2 shadow-sm mb-5 inline-block px-6 border border-gray-100 dark:border-gray-600">{displayName}</h2>
          <div className="space-y-3">
            <button onClick={onSettings} className="glass glass-solid-teal w-full h-12 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <Settings className="w-4 h-4" /> Pengaturan
            </button>
            <button onClick={onLogout} className="glass glass-danger w-full h-12 rounded-2xl border font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" /> Keluar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CategoryDetailModal({ name, transactions, onClose }: { name: string; transactions: Transaction[]; onClose: () => void }) {
  const sorted = [...transactions].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 relative max-h-[80vh] flex flex-col transition-colors">
        <button onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold text-center mb-1 text-gray-800 dark:text-white">Detail Kategori</h2>
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-4">{name}</p>
        <div className="overflow-y-auto space-y-2 flex-1 pr-1">
          {sorted.length === 0 ? <p className="text-center text-xs text-gray-400 py-4">Tidak ada transaksi di bulan ini.</p> :
            sorted.map((tx) => (
              <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                <div>
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{new Date(tx.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <p className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{formatRupiah(tx.amount)}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export function AllowanceInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 relative transition-colors">
        <button onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Apa itu Jatah Hari Ini?</h2>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
          Angka ini adalah batas maksimal uang yang <strong>boleh kamu belanjakan hari ini</strong> agar tantangan hematmu tidak jebol.
        </p>
        <div className="bg-sky-50 dark:bg-sky-900/30 p-3 rounded-xl border border-sky-100 dark:border-sky-800 mb-4">
          <p className="text-[11px] font-bold text-sky-800 dark:text-sky-300 mb-1">Rumus Perhitungan:</p>
          <ul className="text-[10px] text-sky-700 dark:text-sky-400 space-y-1 list-disc pl-4">
            <li>Total Batas Pengeluaran dibagi Total Hari Periode Tantangan.</li>
            <li>Hasilnya jadi patokan harian.</li>
            <li>Lalu dikurangi pengeluaran yang sudah kamu catat hari ini.</li>
          </ul>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
          Data diambil dari target yang sedang kamu aktifkan sebagai <strong>Tantangan Utama</strong>.
        </p>
      </div>
    </div>
  );
}

export function StreakInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 relative transition-colors">
        <button onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Apa itu Streak Hemat?</h2>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
          Streak adalah penghitung <strong>berapa hari berturut-turut</strong> kamu berhasil mengendalikan pengeluaran di bawah jatah harian.
        </p>
        <div className="bg-orange-50 dark:bg-orange-900/30 p-3 rounded-xl border border-orange-100 dark:border-orange-800 mb-4">
          <p className="text-[11px] font-bold text-orange-800 dark:text-orange-300 mb-1">Cara Kerjanya:</p>
          <ul className="text-[10px] text-orange-700 dark:text-orange-400 space-y-1 list-disc pl-4">
            <li>Setiap hari sistem mengecek pengeluaranmu.</li>
            <li>Jika belanja &le; Jatah Harian, streak bertambah +1.</li>
            <li>Jika kamu <em>overbudget</em> sehari saja, streak akan <strong>reset kembali ke 0</strong>.</li>
          </ul>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
          Semakin panjang streak-mu, semakin sehat keuanganmu! 🔥
        </p>
      </div>
    </div>
  );
}

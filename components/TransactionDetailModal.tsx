'use client';
import { X, ArrowDownCircle, ArrowUpCircle, StickyNote, CalendarDays, Repeat } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

// Popup detail satu transaksi (dibuka dari Riwayat Terakhir di Home).
// tx = baris dari tabel transactions.
export default function TransactionDetailModal({ tx, onClose }: { tx: any | null, onClose: () => void }) {
  if (!tx) return null;

  const isIncome = tx.type === 'income';
  const dateLabel = new Date(tx.transaction_date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 relative transition-colors" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>

        {/* Kategori + tipe */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isIncome ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'}`}>
            {isIncome ? <ArrowDownCircle className="w-6 h-6" /> : <ArrowUpCircle className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-800 dark:text-white truncate">{tx.merchant_name}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{isIncome ? 'Uang masuk' : 'Uang keluar'}{tx.is_routine ? ' · rutin' : ''}</p>
          </div>
        </div>

        {/* Nominal */}
        <p className={`text-2xl font-extrabold mb-4 ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
          {isIncome ? '+' : ''}{formatRupiah(Number(tx.amount))}
        </p>

        {/* Rincian */}
        <div className="space-y-2.5 text-sm">
          <div className="flex items-start gap-2.5">
            <CalendarDays className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <span className="text-gray-700 dark:text-gray-300">{dateLabel}</span>
          </div>
          {tx.is_routine && (
            <div className="flex items-start gap-2.5">
              <Repeat className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">Transaksi rutin</span>
            </div>
          )}
          {tx.notes && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <StickyNote className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-gray-700 dark:text-gray-300 break-words min-w-0">{tx.notes}</p>
            </div>
          )}
        </div>

        <button onClick={onClose} className="glass glass-teal mt-5 w-full h-11 rounded-[9px] border text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"><X className="w-4 h-4" /> Tutup</button>
      </div>
    </div>
  );
}

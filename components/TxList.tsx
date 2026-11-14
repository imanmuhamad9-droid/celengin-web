'use client';
import { StickyNote, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

const dateLabel = (ymd: string) => new Date(ymd + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// Daftar transaksi dikelompokkan per tanggal (judul tanggal kecil di atas grup).
// Tiap baris: keterangan transaksi + catatan kecil di bawahnya; nominal di kanan
// (keluar merah tanpa tanda minus, masuk hijau dengan +). Dipakai di Home dan Riwayat.
export default function TxList({ transactions, onSelect, onDelete }: {
  transactions: any[];
  /** Dipanggil saat baris diketuk (buka detail / edit) */
  onSelect?: (tx: any) => void;
  /** Bila diisi, tiap baris diberi tombol hapus kecil di kanan */
  onDelete?: (tx: any) => void;
}) {
  // Kelompokkan berurutan per tanggal (data sudah terurut dari yang terbaru)
  const groups: { date: string; items: any[] }[] = [];
  for (const tx of transactions) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.transaction_date) last.items.push(tx);
    else groups.push({ date: tx.transaction_date, items: [tx] });
  }

  return (
    <div>
      {groups.map((g) => (
        <div key={g.date}>
          <p className="text-xs font-semibold pt-3 pb-0.5 px-1 text-[color:var(--text-muted)]">{dateLabel(g.date)}</p>
          <div className="divide-y divide-black/[0.06] dark:divide-white/10">
            {g.items.map((tx) => (
              <div key={tx.id} className="flex items-center gap-2 py-3 px-1">
                <button type="button" onClick={() => onSelect?.(tx)} className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold truncate flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}>
                      <span className="truncate">{tx.merchant_name}</span>
                      {tx.notes && <StickyNote className="w-3.5 h-3.5 shrink-0 text-[color:var(--text-muted)]" aria-label="Ada catatan" />}
                    </p>
                    {tx.notes && <p className="text-xs truncate mt-0.5 text-[color:var(--text-muted)]">{tx.notes}</p>}
                  </div>
                  <span className={`text-[15px] font-bold shrink-0 ${tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {tx.type === 'income' ? '+' : ''}{formatRupiah(Number(tx.amount))}
                  </span>
                </button>
                {onDelete && (
                  <button type="button" onClick={() => onDelete(tx)} aria-label="Hapus transaksi" className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:text-red-500 active:scale-90 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';
import { StickyNote, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import type { SplitExpense } from '@/lib/splitTypes';

const dateLabel = (ymd: string) => new Date(ymd + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

// Daftar catatan Split Bill, tampilannya sama dengan daftar Riwayat transaksi (TxList):
// dikelompokkan per tanggal, tiap baris judul + keterangan kecil, nominal di kanan.
// Ketuk baris untuk membuka popup detail.
export default function SplitExpenseList({ expenses, nameOf, canDelete, onSelect, onDelete }: {
  expenses: SplitExpense[];
  nameOf: (memberId: string) => string;
  canDelete: (x: SplitExpense) => boolean;
  onSelect: (x: SplitExpense) => void;
  onDelete: (x: SplitExpense) => void;
}) {
  // Data sudah terurut dari tanggal terbaru; kelompokkan yang tanggalnya sama
  const groups: { date: string; items: SplitExpense[] }[] = [];
  for (const x of expenses) {
    const last = groups[groups.length - 1];
    if (last && last.date === x.expense_date) last.items.push(x);
    else groups.push({ date: x.expense_date, items: [x] });
  }
  const lastDate = groups[groups.length - 1]?.date;

  return (
    <div className="glass rounded-3xl px-4 py-1">
      {groups.map((g) => {
        const dayTotal = g.items.reduce((s, x) => s + Number(x.total_amount), 0);
        return (
          <div key={g.date}>
            <div className="flex items-center justify-between pt-2.5 pb-1">
              <p className="text-[11px] font-semibold -ml-1.5 text-[color:var(--text-muted)]">{dateLabel(g.date)}</p>
              {g.items.length > 1 && <p className="text-[11px] font-semibold text-[color:var(--text-muted)]">{formatRupiah(dayTotal)}</p>}
            </div>
            {g.items.map((x, i) => {
              const isLast = g.date === lastDate && i === g.items.length - 1;
              const sub = [x.store_name, `dibayar ${nameOf(x.paid_by)}`, x.split_type === 'items' && x.split_expense_items ? `${x.split_expense_items.length} barang` : null].filter(Boolean).join(' · ');
              return (
                <div key={x.id} className={`flex items-center gap-2 py-2 ${isLast ? '' : 'border-b border-black/[0.07] dark:border-white/10'}`}>
                  <button type="button" onClick={() => onSelect(x)} className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left active:opacity-70 transition-opacity">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold truncate flex items-center gap-1.5 leading-tight" style={{ color: 'var(--text-main)' }}>
                        <span className="truncate">{x.title}</span>
                        {x.note && <StickyNote className="w-3.5 h-3.5 shrink-0 text-[color:var(--text-muted)]" aria-label="Ada catatan" />}
                      </p>
                      <p className="text-[11px] truncate mt-0.5 leading-tight text-[color:var(--text-muted)]">{sub}</p>
                    </div>
                    <span className="text-[15px] font-bold shrink-0 text-red-500 dark:text-red-400">{formatRupiah(Number(x.total_amount))}</span>
                  </button>
                  {canDelete(x) && (
                    <button type="button" onClick={() => onDelete(x)} aria-label="Hapus catatan" className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:text-red-500 active:scale-90 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

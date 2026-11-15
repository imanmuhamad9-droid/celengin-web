'use client';
import { X, CalendarDays, Store, StickyNote, Wallet } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import type { SplitExpense } from '@/lib/splitTypes';
import GlassButton from '@/components/GlassButton';

// Popup detail satu catatan Split Bill: barang dan pemakainya, rincian pajak, bagian tiap orang,
// lalu tombol Kirim ke WhatsApp, Ubah, dan Hapus (sesuai hak akses).
export default function SplitExpenseDetailModal({ expense, nameOf, canManage, canEdit, onClose, onEdit, onDelete, onWa }: {
  expense: SplitExpense | null;
  nameOf: (memberId: string) => string;
  canManage: boolean;   // boleh menghapus (pembuat catatan atau pemilik grup)
  canEdit: boolean;     // boleh mengubah (hanya buku Bayarin)
  onClose: () => void;
  onEdit: (x: SplitExpense) => void;
  onDelete: (x: SplitExpense) => void;
  onWa: (x: SplitExpense) => void;
}) {
  if (!expense) return null;
  const x = expense;
  const items = (x.split_expense_items || []).slice().sort((a, b) => a.position - b.position);
  const shares = (x.split_shares || []).filter((s) => Number(s.share_amount) > 0);
  const dateText = new Date(x.expense_date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 relative max-h-[88vh] overflow-y-auto transition-colors" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 text-[color:var(--text-muted)]"><X className="w-5 h-5" /></button>

        <p className="text-base font-bold pr-8 break-words" style={{ color: 'var(--text-main)' }}>{x.title}</p>
        <p className="text-2xl font-extrabold mt-1 mb-4 text-red-500 dark:text-red-400">{formatRupiah(Number(x.total_amount))}</p>

        <div className="space-y-2.5 text-sm">
          <div className="flex items-start gap-2.5"><CalendarDays className="w-4 h-4 shrink-0 mt-0.5 text-[color:var(--text-muted)]" /><span style={{ color: 'var(--text-main)' }}>{dateText}</span></div>
          <div className="flex items-start gap-2.5"><Wallet className="w-4 h-4 shrink-0 mt-0.5 text-[color:var(--text-muted)]" /><span style={{ color: 'var(--text-main)' }}>Dibayar dulu oleh {nameOf(x.paid_by)}</span></div>
          {x.store_name && <div className="flex items-start gap-2.5"><Store className="w-4 h-4 shrink-0 mt-0.5 text-[color:var(--text-muted)]" /><span className="break-words min-w-0" style={{ color: 'var(--text-main)' }}>{x.store_name}</span></div>}
          {x.note && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <StickyNote className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="break-words min-w-0" style={{ color: 'var(--text-main)' }}>{x.note}</p>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase mb-1.5 text-[color:var(--text-muted)]">Barang</p>
            <div className="space-y-1.5">
              {items.map((it) => (
                <div key={it.id} className="text-[11px]">
                  <p className="flex justify-between gap-2" style={{ color: 'var(--text-main)' }}><span className="truncate">{it.name}{it.qty > 1 ? ` x${it.qty}` : ''}</span><span className="shrink-0 font-medium">{formatRupiah(Number(it.price) * it.qty)}</span></p>
                  <p className="text-[10px] truncate text-[color:var(--text-muted)]">{(it.split_item_assignees || []).map((a) => nameOf(a.member_id)).join(', ') || '-'}</p>
                </div>
              ))}
              {(Number(x.discount_amount) > 0 || Number(x.service_amount) > 0 || Number(x.tax_amount) > 0) && (
                <div className="pt-1.5 border-t border-dashed border-black/10 dark:border-white/15 text-[10px] space-y-0.5 text-[color:var(--text-muted)]">
                  <p className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(Number(x.subtotal || 0))}</span></p>
                  {Number(x.discount_amount) > 0 && <p className="flex justify-between"><span>Diskon</span><span>-{formatRupiah(Number(x.discount_amount))}</span></p>}
                  {Number(x.service_amount) > 0 && <p className="flex justify-between"><span>Service</span><span>+{formatRupiah(Number(x.service_amount))}</span></p>}
                  {Number(x.tax_amount) > 0 && <p className="flex justify-between"><span>Pajak</span><span>+{formatRupiah(Number(x.tax_amount))}</span></p>}
                </div>
              )}
            </div>
          </div>
        )}

        {shares.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase mb-1.5 text-[color:var(--text-muted)]">Bagian tiap orang</p>
            <div className="space-y-1">
              {shares.map((s) => (
                <p key={s.member_id} className="text-[12px] flex justify-between gap-2" style={{ color: 'var(--text-main)' }}><span className="truncate">{nameOf(s.member_id)}</span><span className="font-bold shrink-0">{formatRupiah(Number(s.share_amount))}</span></p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 space-y-2">
          <GlassButton variant="teal" size="lg" full onClick={() => onWa(x)}>Kirim ke WhatsApp</GlassButton>
          {(canEdit || canManage) && (
            <div className="flex gap-2">
              {canEdit && <GlassButton variant="teal" size="lg" className="flex-1" onClick={() => onEdit(x)}>Ubah</GlassButton>}
              {canManage && <GlassButton variant="danger" size="lg" className="flex-1" onClick={() => onDelete(x)}>Hapus</GlassButton>}
            </div>
          )}
          <GlassButton size="lg" full onClick={onClose}>Tutup</GlassButton>
        </div>
      </div>
    </div>
  );
}

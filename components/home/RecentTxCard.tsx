'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import GlassCard from '@/components/GlassCard';
import SectionToggle from '@/components/SectionToggle';
import TxList from '@/components/TxList';

// Lipatan Daftar Transaksi: tersembunyi dulu, isinya 5 transaksi terakhir.
export default function RecentTxCard({ transactions, onSelect }: { transactions: Transaction[]; onSelect: (tx: Transaction) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <GlassCard>
      <SectionToggle title="Daftar Transaksi" open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <div className="mt-3">
          {transactions.length === 0 ? (
            <p className="text-xs py-4 text-center text-[color:var(--text-muted)]">Belum ada transaksi. Ketuk Catat untuk mulai.</p>
          ) : (
            <TxList transactions={transactions} onSelect={onSelect} />
          )}
          <button onClick={() => router.push('/transactions')} className="mt-2 ml-auto text-sm font-bold flex items-center gap-0.5 text-[color:var(--teal-primary)] active:opacity-70 transition-opacity">
            Lihat semua <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </GlassCard>
  );
}

'use client';
import { useRouter } from 'next/navigation';
import { Receipt, AlertTriangle, PartyPopper, ChevronRight } from 'lucide-react';

export interface AttentionItem {
  key: string;
  tone: 'warning' | 'danger' | 'praise';
  kind: 'bill' | 'target' | 'praise';
  title: string;
  sub: string;
  href: string;
}

const TONE: Record<AttentionItem['tone'], string> = {
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/40 text-amber-800 dark:text-amber-300',
  danger: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/40 text-red-800 dark:text-red-300',
  praise: 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800/40 text-teal-800 dark:text-teal-300',
};

// Baris kartu "Perlu perhatian". Tidak menampilkan apa pun bila tidak ada isi.
export default function AttentionStrip({ items }: { items: AttentionItem[] }) {
  const router = useRouter();
  if (items.length === 0) return null;
  const billCount = items.filter((i) => i.kind === 'bill').length;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Perlu perhatian</p>
        {billCount > 0 && (
          <button onClick={() => router.push('/bills')} className="text-[10px] font-bold text-teal-600 dark:text-teal-400">Semua tagihan</button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar snap-x">
        {items.map((it) => {
          const Icon = it.kind === 'bill' ? Receipt : it.kind === 'praise' ? PartyPopper : AlertTriangle;
          return (
            <button
              key={it.key}
              onClick={() => router.push(it.href)}
              className={`snap-start shrink-0 w-[62%] max-w-[220px] text-left rounded-2xl border p-3 active:scale-[0.98] transition-transform ${TONE[it.tone]}`}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon className="w-4 h-4" />
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </div>
              <p className="text-xs font-bold truncate">{it.title}</p>
              <p className="text-[10px] opacity-80 truncate">{it.sub}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

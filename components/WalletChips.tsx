'use client';
import type { Wallet } from '@/lib/wallets';

// Pilihan dompet. Tidak tampil kalau user hanya punya 1 dompet (tidak perlu memilih).
export default function WalletChips({ wallets, value, onChange }: {
  wallets: Wallet[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (wallets.length < 2) return null;
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5">Dompet</p>
      <div className="flex flex-wrap gap-1.5">
        {wallets.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => onChange(w.id)}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-all border ${value === w.id ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-500 text-teal-700 dark:text-teal-400' : 'bg-gray-50 dark:bg-gray-700 border-transparent text-gray-600 dark:text-gray-300'}`}
          >
            {w.emoji} {w.name}
          </button>
        ))}
      </div>
    </div>
  );
}

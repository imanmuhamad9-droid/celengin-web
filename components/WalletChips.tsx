'use client';
import type { Wallet } from '@/lib/wallets';

// Pilihan dompet di form Catat/Ubah. Hanya tampil bila ada lebih dari satu dompet. Kalau tidak tampil, transaksi masuk ke dompet utama otomatis.
export default function WalletChips({ wallets, value, onChange }: {
  wallets: Wallet[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (wallets.length < 2) return null;
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5 text-[color:var(--text-muted)]">Dompet</label>
      <div className="flex flex-wrap gap-1.5">
        {wallets.map((w) => (
          <button
            type="button"
            key={w.id}
            onClick={() => onChange(w.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold max-w-full truncate ${value === w.id ? 'glass glass-teal' : 'glass text-[color:var(--text-muted)]'}`}
          >
            {w.emoji} {w.name}
          </button>
        ))}
      </div>
    </div>
  );
}

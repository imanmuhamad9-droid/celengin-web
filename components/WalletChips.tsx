'use client';
import type { Wallet } from '@/lib/wallets';

// Menu Dompet sudah dihapus: semua transaksi masuk ke dompet utama otomatis, jadi pilihan dompet tidak ditampilkan lagi.
// Komponennya dipertahankan supaya form lama tetap valid; data dompet di database tidak diubah.
export default function WalletChips(_props: {
  wallets: Wallet[];
  value: string;
  onChange: (id: string) => void;
}) {
  return null;
}

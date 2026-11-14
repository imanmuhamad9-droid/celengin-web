// Ekspor laporan ke CSV (buka di Excel). Cetak/PDF ada di components/PrintReportView.tsx.
// Tanpa library tambahan. Panggil hanya dari event handler (klik tombol).
import type { Tx } from '@/lib/insights';

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(opts: { filename: string; transactions: Tx[]; walletName?: (id?: string | null) => string }) {
  const head = ['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Catatan', 'Dompet', 'Rutin'];
  const rows = opts.transactions
    .slice()
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
    .map((t) => [
      t.transaction_date,
      t.type === 'income' ? 'Masuk' : 'Keluar',
      t.merchant_name || '',
      Number(t.amount),
      t.notes || '',
      opts.walletName ? opts.walletName(t.wallet_id) : '',
      t.is_routine ? 'Ya' : 'Tidak',
    ]);
  // "sep=;" + titik koma: terbuka rapi di Excel versi Indonesia. BOM supaya emoji/aksara tidak rusak.
  const body = ['sep=;', head.join(';'), ...rows.map((r) => r.map(csvCell).join(';'))].join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

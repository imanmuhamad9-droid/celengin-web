// Ekspor laporan: CSV (buka di Excel) dan Cetak/Simpan PDF (lewat dialog print browser).
// Tanpa library tambahan. Panggil hanya dari event handler (klik tombol).
import type { Tx, Summary } from '@/lib/insights';

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

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Buka halaman laporan siap cetak; pilih "Simpan sebagai PDF" di dialog print. Return false kalau popup diblokir. */
export function printReport(opts: {
  title: string; periodLabel: string; summary: Summary; transactions: Tx[];
  fmt: (n: number) => string; nickname?: string;
}): boolean {
  const { summary: s, fmt } = opts;
  const catRows = (list: { name: string; amount: number }[], total: number) =>
    list.map((c) => `<tr><td>${esc(c.name)}</td><td class="r">${fmt(c.amount)}</td><td class="r">${total > 0 ? Math.round((c.amount / total) * 100) : 0}%</td></tr>`).join('');
  const txRows = opts.transactions
    .slice()
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
    .map((t) => `<tr><td>${t.transaction_date}</td><td>${esc(t.merchant_name || '')}</td><td>${t.type === 'income' ? 'Masuk' : 'Keluar'}</td><td class="r ${t.type === 'income' ? 'g' : 'rd'}">${t.type === 'income' ? '+' : '-'}${fmt(Number(t.amount))}</td></tr>`)
    .join('');

  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(opts.title)} - ${esc(opts.periodLabel)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px}
  h1{color:#0f766e;margin:0 0 2px;font-size:20px} h2{font-size:14px;margin:20px 0 6px;color:#0f766e}
  .sub{color:#666;margin-bottom:14px}
  .cards{display:flex;gap:10px;margin:10px 0} .card{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:10px}
  .card b{display:block;font-size:15px;margin-top:3px}
  table{width:100%;border-collapse:collapse} th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}
  th{background:#f0fdfa;color:#0f766e} .r{text-align:right} .g{color:#16a34a} .rd{color:#dc2626}
  @media print{body{margin:10mm} button{display:none}}
</style></head><body>
<button onclick="window.print()" style="float:right;padding:8px 14px;background:#0f766e;color:#fff;border:0;border-radius:8px;cursor:pointer">Cetak / Simpan PDF</button>
<h1>${esc(opts.title)}</h1>
<div class="sub">${esc(opts.periodLabel)}${opts.nickname ? ' · ' + esc(opts.nickname) : ''}</div>
<div class="cards">
  <div class="card">Pemasukan<b class="g">${fmt(s.income)}</b></div>
  <div class="card">Pengeluaran<b class="rd">${fmt(s.expense)}</b></div>
  <div class="card">Selisih<b>${fmt(s.net)}</b></div>
  <div class="card">Tabungan<b>${Math.round(s.savingRate * 100)}%</b></div>
</div>
<h2>Pengeluaran per kategori</h2>
<table><tr><th>Kategori</th><th class="r">Nominal</th><th class="r">%</th></tr>${catRows(s.expenseCats, s.expense) || '<tr><td colspan="3">Tidak ada data</td></tr>'}</table>
<h2>Pemasukan per kategori</h2>
<table><tr><th>Kategori</th><th class="r">Nominal</th><th class="r">%</th></tr>${catRows(s.incomeCats, s.income) || '<tr><td colspan="3">Tidak ada data</td></tr>'}</table>
<h2>Daftar transaksi (${opts.transactions.length})</h2>
<table><tr><th>Tanggal</th><th>Kategori</th><th>Tipe</th><th class="r">Nominal</th></tr>${txRows || '<tr><td colspan="4">Tidak ada transaksi</td></tr>'}</table>
<p class="sub" style="margin-top:18px">Dibuat oleh Celengin.</p>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* abaikan */ } }, 400);
  return true;
}

// Laporan PDF sungguhan (file .pdf), dibuat langsung di browser dengan pdf-lib.
// Tidak bergantung pada dialog cetak, jadi hasilnya sama di Android, iPhone, dan komputer.
// Panggil hanya dari event handler (klik tombol).
import type { Tx, Summary } from '@/lib/insights';

/** Font standar PDF hanya mengenal karakter Latin. Emoji dan simbol lain dibuang. */
const clean = (s: string | null | undefined) =>
  String(s ?? '').replace(/ /g, ' ').replace(/[^\x20-\x7E¡-ÿ]/g, '').replace(/\s+/g, ' ').trim();

export interface PdfReportOptions {
  title: string;
  periodLabel: string;
  nickname?: string;
  summary: Summary;
  transactions: Tx[];
  fmt: (n: number) => string;
}

export async function buildReportPdf(opts: PdfReportOptions): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PW = 595.28, PH = 841.89, M = 40, CW = PW - M * 2;
  const TEAL = rgb(0.059, 0.463, 0.431), GRAY = rgb(0.42, 0.45, 0.5), LINE = rgb(0.9, 0.91, 0.92);
  const GREEN = rgb(0.086, 0.639, 0.29), RED = rgb(0.863, 0.149, 0.149), INK = rgb(0.07, 0.09, 0.15);
  const TINT = rgb(0.94, 0.99, 0.98);

  let page = doc.addPage([PW, PH]);
  let y = PH - M;

  const widthOf = (t: string, size: number, b = false) => (b ? bold : font).widthOfTextAtSize(t, size);
  const fit = (t: string, size: number, maxW: number, b = false) => {
    let s = clean(t);
    if (widthOf(s, size, b) <= maxW) return s;
    while (s.length > 1 && widthOf(s + '...', size, b) > maxW) s = s.slice(0, -1);
    return s + '...';
  };
  const text = (t: string, x: number, yy: number, size = 9, o: { b?: boolean; color?: ReturnType<typeof rgb>; right?: boolean; maxW?: number } = {}) => {
    const s = o.maxW ? fit(t, size, o.maxW, o.b) : clean(t);
    const w = widthOf(s, size, o.b);
    page.drawText(s, { x: o.right ? x - w : x, y: yy, size, font: o.b ? bold : font, color: o.color ?? INK });
  };
  const ensure = (need: number, onNewPage?: () => void) => {
    if (y - need < M + 24) {
      page = doc.addPage([PW, PH]);
      y = PH - M;
      onNewPage?.();
    }
  };
  const rule = (yy: number) => page.drawLine({ start: { x: M, y: yy }, end: { x: PW - M, y: yy }, thickness: 0.5, color: LINE });

  // ---- Judul ----
  text(opts.title, M, y - 16, 18, { b: true, color: TEAL });
  y -= 34;
  text(`${opts.periodLabel}${opts.nickname ? '  |  ' + opts.nickname : ''}`, M, y, 10, { color: GRAY });
  y -= 22;

  // ---- Ringkasan ----
  const s = opts.summary;
  const gap = 8, bw = (CW - gap * 3) / 4, bh = 44;
  const cards: [string, string, ReturnType<typeof rgb>][] = [
    ['Pemasukan', opts.fmt(s.income), GREEN],
    ['Pengeluaran', opts.fmt(s.expense), RED],
    ['Selisih', opts.fmt(s.net), INK],
    ['Tabungan', `${Math.round(s.savingRate * 100)}%`, INK],
  ];
  cards.forEach(([label, value, color], i) => {
    const x = M + i * (bw + gap);
    page.drawRectangle({ x, y: y - bh, width: bw, height: bh, borderColor: LINE, borderWidth: 1, color: rgb(1, 1, 1) });
    text(label, x + 8, y - 15, 8, { color: GRAY });
    let size = 12;
    while (size > 7 && widthOf(clean(value), size, true) > bw - 16) size -= 0.5;
    text(value, x + 8, y - 33, size, { b: true, color });
  });
  y -= bh + 22;

  // ---- Tabel kategori ----
  const catTable = (heading: string, list: { name: string; amount: number }[], total: number) => {
    ensure(40);
    text(heading, M, y, 11, { b: true, color: TEAL });
    y -= 8;
    if (list.length === 0) { y -= 14; text('Tidak ada data', M, y, 9, { color: GRAY }); y -= 18; return; }
    list.forEach((c) => {
      ensure(18);
      y -= 16;
      text(c.name, M + 2, y, 9, { maxW: CW - 150 });
      text(opts.fmt(c.amount), PW - M - 44, y, 9, { right: true });
      text(`${total > 0 ? Math.round((c.amount / total) * 100) : 0}%`, PW - M - 2, y, 9, { right: true, color: GRAY });
      rule(y - 5);
    });
    y -= 18;
  };
  catTable('Pengeluaran per kategori', s.expenseCats, s.expense);
  catTable('Pemasukan per kategori', s.incomeCats, s.income);

  // ---- Daftar transaksi ----
  const colDate = M + 4, colCat = M + 78, colType = PW - M - 120, colAmt = PW - M - 4;
  const txHeader = () => {
    page.drawRectangle({ x: M, y: y - 18, width: CW, height: 18, color: TINT });
    text('Tanggal', colDate, y - 12, 8.5, { b: true, color: TEAL });
    text('Kategori', colCat, y - 12, 8.5, { b: true, color: TEAL });
    text('Tipe', colType, y - 12, 8.5, { b: true, color: TEAL });
    text('Nominal', colAmt, y - 12, 8.5, { b: true, color: TEAL, right: true });
    y -= 18;
  };
  const sorted = opts.transactions.slice().sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
  ensure(60);
  text(`Daftar transaksi (${sorted.length})`, M, y, 11, { b: true, color: TEAL });
  y -= 10;
  txHeader();
  if (sorted.length === 0) { y -= 16; text('Tidak ada transaksi', colDate, y, 9, { color: GRAY }); }
  sorted.forEach((t) => {
    ensure(18, txHeader);
    y -= 16;
    const inc = t.type === 'income';
    text(t.transaction_date, colDate, y, 9);
    text(t.merchant_name || '-', colCat, y, 9, { maxW: colType - colCat - 10 });
    text(inc ? 'Masuk' : 'Keluar', colType, y, 9);
    text(`${inc ? '+' : '-'}${opts.fmt(Number(t.amount))}`, colAmt, y, 9, { right: true, color: inc ? GREEN : RED });
    rule(y - 5);
  });

  // ---- Nomor halaman ----
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Dibuat oleh Celengin  |  Halaman ${i + 1} dari ${pages.length}`;
    const w = font.widthOfTextAtSize(label, 8);
    p.drawText(label, { x: (PW - w) / 2, y: 22, size: 8, font, color: GRAY });
  });

  return doc.save();
}

/** Bagikan lewat menu berbagi di HP (bisa "Simpan ke File"), atau unduh langsung di komputer. */
export async function savePdf(bytes: Uint8Array, filename: string): Promise<'shared' | 'downloaded'> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && typeof File !== 'undefined' && nav.canShare && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'shared'; // pengguna menutup menu berbagi
      /* gagal berbagi: lanjut unduh biasa */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

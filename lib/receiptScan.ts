// Pemindai struk: OCR berjalan di perangkat pengguna (Tesseract.js dimuat saat dibutuhkan dari CDN, tanpa paket tambahan).
// Hasil hanya berupa tebakan, jadi selalu ditampilkan sebagai data yang bisa diubah sebelum disimpan.

export interface ReceiptResult {
  amount: number | null;
  date: string | null;      // yyyy-mm-dd
  merchant: string | null;
  rawText: string;
}

const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let loader: Promise<any> | null = null;
function loadTesseract(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Hanya tersedia di browser.'));
  const w = window as any;
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESS_URL;
    s.async = true;
    s.onload = () => (w.Tesseract ? resolve(w.Tesseract) : reject(new Error('Pemindai gagal dimuat.')));
    s.onerror = () => { loader = null; reject(new Error('Pemindai gagal dimuat. Periksa koneksi internet.')); };
    document.head.appendChild(s);
  });
  return loader;
}

// Perkecil foto agar OCR lebih cepat dan hemat memori.
async function prepareImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Foto tidak bisa dibuka.'));
      i.src = url;
    });
    const MAX = 1800;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.filter = 'grayscale(1) contrast(1.25)';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.9));
    return blob || file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const BULAN: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6,
  jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, aug: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10,
  nov: 11, november: 11, des: 12, desember: 12, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');
const validYmd = (y: number, m: number, d: number) => y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

export function parseReceiptText(text: string): ReceiptResult {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // --- Total ---
  const toNumber = (raw: string): number | null => {
    let t = raw.replace(/\s/g, '');
    t = t.replace(/[.,]\d{2}$/, ''); // buang sen, mis. 25.000,00
    t = t.replace(/[.,]/g, '');
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const numRe = /\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{3,}/g;
  const numbersIn = (line: string) => (line.match(numRe) || []).map(toNumber).filter((n): n is number => n !== null && n < 1_000_000_000);

  let amount: number | null = null;
  const strong = /(grand\s*total|total\s*bayar|total\s*tagihan|total\s*belanja|jumlah\s*bayar|total\s*pembayaran|amount\s*due)/i;
  const weak = /(total|jumlah|tagihan|subtotal|tunai|bayar)/i;
  const skip = /(kembali|kembalian|change|ppn|pajak|tax|diskon|disc)/i;

  for (const re of [strong, weak]) {
    const cands: number[] = [];
    lines.forEach((l, i) => {
      if (!re.test(l) || skip.test(l)) return;
      const here = numbersIn(l);
      if (here.length) cands.push(...here);
      else if (lines[i + 1]) cands.push(...numbersIn(lines[i + 1]));
    });
    if (cands.length) { amount = Math.max(...cands); break; }
  }
  if (amount === null) {
    const all = lines.filter(l => !skip.test(l)).flatMap(numbersIn).filter(n => n >= 500);
    if (all.length) amount = Math.max(...all);
  }

  // --- Tanggal ---
  let date: string | null = null;
  const joined = lines.join(' ');
  let m = joined.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const d = Number(m[1]); const mo = Number(m[2]); let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (validYmd(y, mo, d)) date = `${y}-${pad(mo)}-${pad(d)}`;
  }
  if (!date) {
    m = joined.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (m) {
      const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
      if (validYmd(y, mo, d)) date = `${y}-${pad(mo)}-${pad(d)}`;
    }
  }
  if (!date) {
    m = joined.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})/);
    if (m) {
      const mo = BULAN[m[2].toLowerCase()];
      let y = Number(m[3]); if (y < 100) y += 2000;
      if (mo && validYmd(y, mo, Number(m[1]))) date = `${y}-${pad(mo)}-${pad(Number(m[1]))}`;
    }
  }

  // --- Nama toko: baris pertama yang berisi cukup huruf ---
  const merchant = lines.slice(0, 6).find(l => (l.match(/[A-Za-z]/g) || []).length >= 4 && !/^\d/.test(l)) || null;

  return { amount, date, merchant: merchant ? merchant.slice(0, 40) : null, rawText: text };
}

export async function scanReceipt(file: File, onProgress?: (pct: number) => void): Promise<ReceiptResult> {
  const Tesseract = await loadTesseract();
  const image = await prepareImage(file);
  const res = await Tesseract.recognize(image, 'ind+eng', {
    logger: (msg: any) => {
      if (onProgress && msg?.status === 'recognizing text' && typeof msg.progress === 'number') onProgress(Math.round(msg.progress * 100));
    },
  });
  return parseReceiptText(res?.data?.text || '');
}

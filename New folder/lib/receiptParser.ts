// Mengubah teks hasil OCR sebuah struk menjadi data terstruktur (murni, tanpa Supabase / browser).
// Dibuat toleran: OCR struk jarang sempurna, jadi hasilnya selalu diperiksa dan diedit pengguna.
//
// Format yang dikenali:
//   Nasi Goreng  2 x 25.000  50.000     (nama, jumlah x harga satuan, total baris)
//   2 Es Kopi Susu  44.000              (jumlah di depan)
//   Kerupuk  5.000                      (jumlah 1)
//   Ayam Bakar / 1 x 35.000  35.000     (nama dan angka di dua baris)
//   SUBTOTAL, DISKON, SERVICE CHARGE, PB1 / PPN / PAJAK, TOTAL / GRAND TOTAL

export interface ParsedItem { name: string; qty: number; unitPrice: number }
export interface ParsedAdj { amount: number; percent: number | null }
export interface ParsedReceipt {
  merchant: string | null;
  date: string | null; // YYYY-MM-DD
  items: ParsedItem[];
  subtotal: number | null;
  discount: ParsedAdj | null;
  service: ParsedAdj | null;
  tax: ParsedAdj | null;
  total: number | null;
  warnings: string[];
}

// Angka rupiah: 25.000 | 25,000 | 25.000,00 | 25000 | Rp 25.000 | -11.400
const MONEY_RE = /(-|−|–)?\s*(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\s?\d{3})+(?:[.,]\d{2})?|\d{4,9}(?:[.,]\d{2})?)(?!\d)/gi;
const PERCENT_RE = /(\d{1,2}(?:[.,]\d{1,2})?)\s*%/;

const NOISE_RE = /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}|npwp|telp|\btel\b|\bhp\b|wa\s*:|kasir|cashier|\bmeja\b|\btable\b|\bno\s*[.:]|\border\b|invoice|struk|receipt|terima\s*kasih|thank|selamat|welcome|www\.|\.com|\.co\.id|instagram|\bkode\b|\bref\b|\bid\s*:/i;
const SKIP_RE = /tunai|\bcash\b|debit|kredit|credit|kartu|\bcard\b|kembali|\bchange\b|dibayar|\bpaid\b|qris|ovo|gopay|\bdana\b|shopee|linkaja|e-?money|flazz|\btip\b|rounding|pembulatan|total\s*(item|qty|barang|pesanan)|jml\s*(item|qty)|\bqty\s*[:=]|\bpoin\b|\bpoint|saldo|\bedc\b|\bapproval|\bbatch|\bmid\b|\btid\b/i;
const SUBTOTAL_RE = /sub\s*-?\s*total/i;
const GRAND_RE = /grand\s*total|total\s*(bayar|tagihan|pembayaran|akhir|belanja|harga)|amount\s*due|total\s*due|jumlah\s*bayar/i;
const SERVICE_RE = /service|serv\.?\s*(chg|charge)|\bsvc\b|s\.?\s*charge|\bsc\s*\d/i;
const TAX_RE = /\bpb\s*-?\s*1\b|\bppn\b|pajak|\btax\b|\bvat\b|resto\s*tax/i;
const DISCOUNT_RE = /disc|diskon|potongan|promo|voucher|hemat|\bpot\b/i;
const TOTAL_RE = /\btotal\b/i;
const HEADER_WORD_RE = /^(item|items|qty|harga|price|jumlah|amount|description|deskripsi|menu|nama|no)\b/i;

/** OCR sering salah baca: 44.OOO -> 44.000, 1O.5OO -> 10.500. Hanya diperbaiki di dalam token yang berisi angka. */
function fixDigits(line: string): string {
  return line.replace(/[\dOoIl.,]{3,}/g, (tok) => (/\d/.test(tok) ? tok.replace(/[Oo]/g, '0').replace(/[Il]/g, '1') : tok));
}

function parseMoney(raw: string): number {
  let t = raw.replace(/[^\d.,]/g, '');
  t = t.replace(/[.,]\d{2}$/, (m) => (t.length > 3 ? '' : m)); // buang desimal ,00
  t = t.replace(/[.,]/g, '');
  return Number(t) || 0;
}

interface MoneyTok { value: number; index: number; end: number; negative: boolean }

function findMoney(line: string): MoneyTok[] {
  const out: MoneyTok[] = [];
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(line)) !== null) {
    const value = parseMoney(m[2]);
    if (value > 0) out.push({ value, index: m.index, end: m.index + m[0].length, negative: !!m[1] });
  }
  return out;
}

function letters(s: string): number { return (s.match(/[A-Za-z]/g) || []).length; }

function tidyName(raw: string, stripTail = true): string {
  let n = raw.replace(/[|_~=*#]+/g, ' ').replace(/\s+/g, ' ').replace(/^[^A-Za-z0-9(]+|[^A-Za-z0-9)]+$/g, '').trim();
  if (stripTail) n = n.replace(/\s+(x|@)$/i, '').trim();
  if (n.length > 3 && n === n.toUpperCase()) n = n.toLowerCase().replace(/(^|[\s(\-/])([a-z])/g, (_, a, b) => a + b.toUpperCase());
  return n;
}

function extractDate(lines: string[]): string | null {
  for (const l of lines) {
    let m = l.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    let y: number, mo: number, d: number;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else {
      m = l.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (!m) continue;
      d = +m[1]; mo = +m[2]; y = +m[3];
      if (y < 100) y += 2000;
    }
    if (y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const rawLines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length > 0);
  const lines = rawLines.map(fixDigits);
  const warnings: string[] = [];

  // Nama toko: baris pertama yang berisi huruf dan bukan alamat / tanggal / angka
  let merchant: string | null = null;
  for (const l of lines.slice(0, 5)) {
    if (letters(l) >= 3 && findMoney(l).length === 0 && !NOISE_RE.test(l) && !/\bjl\b|jalan|\bblok\b|\brt\b|\brw\b/i.test(l)) { merchant = tidyName(l, false); break; }
  }

  const date = extractDate(lines);

  // Batas daerah item = baris subtotal / total pertama
  let stop = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (SKIP_RE.test(l)) continue;
    if (SUBTOTAL_RE.test(l) || GRAND_RE.test(l) || (TOTAL_RE.test(l) && findMoney(l).length > 0)) { stop = i; break; }
  }

  const items: ParsedItem[] = [];
  let subtotal: number | null = null;
  let grandTotal: number | null = null;
  let plainTotal: number | null = null;
  const adj = {
    discount: { amount: 0, percents: [] as number[], seen: false },
    service: { amount: 0, percents: [] as number[], seen: false },
    tax: { amount: 0, percents: [] as number[], seen: false },
  };

  const lastMoney = (l: string): number | null => { const t = findMoney(l); return t.length ? t[t.length - 1].value : null; };
  const addAdj = (key: 'discount' | 'service' | 'tax', l: string) => {
    const a = adj[key];
    a.seen = true;
    const money = findMoney(l);
    // Angka yang sebenarnya persen (mis. "10%") tidak ikut terhitung karena bukan format rupiah
    if (money.length) a.amount += money[money.length - 1].value;
    const p = l.match(PERCENT_RE);
    if (p) a.percents.push(Number(p[1].replace(',', '.')));
  };

  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (SKIP_RE.test(l)) continue;

    // Baris ringkasan (boleh berada sebelum maupun sesudah batas)
    if (SUBTOTAL_RE.test(l)) { const v = lastMoney(l); if (v) subtotal = v; continue; }
    if (GRAND_RE.test(l)) { const v = lastMoney(l); if (v) grandTotal = v; continue; }
    if (SERVICE_RE.test(l) && !NOISE_RE.test(l.replace(/\d{1,2}:\d{2}/g, ''))) { addAdj('service', l); continue; }
    if (TAX_RE.test(l)) { addAdj('tax', l); continue; }
    if (DISCOUNT_RE.test(l)) { addAdj('discount', l); continue; }
    if (TOTAL_RE.test(l)) { const v = lastMoney(l); if (v) plainTotal = v; continue; }

    if (i >= stop) continue;
    if (NOISE_RE.test(l)) continue;

    // Nama di satu baris, angka di baris berikutnya
    if (findMoney(l).length === 0) {
      const next = lines[i + 1];
      if (next && i + 1 < stop && letters(l) >= 3 && !HEADER_WORD_RE.test(l) && !SKIP_RE.test(next) && !SUBTOTAL_RE.test(next) && !TOTAL_RE.test(next)) {
        const nt = findMoney(next);
        const lead = nt.length ? next.slice(0, nt[0].index) : '';
        if (nt.length > 0 && letters(lead.replace(/\b(x|pcs|pc|porsi|item)\b/gi, '')) === 0) {
          l = `${l} ${next}`;
          i += 1;
        } else continue;
      } else continue;
    }

    const toks = findMoney(l);
    if (toks.length === 0) continue;
    const totalTok = toks[toks.length - 1];
    let total = totalTok.value;
    if (totalTok.negative) { adj.discount.seen = true; adj.discount.amount += total; continue; } // "Disc -5.000" di bawah item
    let unit: number | null = toks.length >= 2 ? toks[toks.length - 2].value : null;
    let qty = 1;
    let nameEnd = toks[0].index;
    let name = '';

    const xMatch = l.match(/(?:^|\s)(\d{1,3})\s*[xX×@]\s*(?:Rp\.?\s*)?\d/);
    const leadQty = l.match(/^(\d{1,2})\s*([xX×])?\s+(?=[A-Za-z])/);
    const midQty = l.slice(0, toks[0].index).match(/^(.*?\D)\s(\d{1,2})\s*$/);
    const midQtyOk = !!midQty && letters(midQty[1]) >= 2 && (toks.length >= 2 || (Number(midQty[2]) <= 12 && total % Number(midQty[2]) === 0 && total / Number(midQty[2]) >= 1000));

    if (xMatch && xMatch.index !== undefined) {
      qty = Math.max(1, Number(xMatch[1]));
      nameEnd = Math.min(nameEnd, xMatch.index);
      name = l.slice(0, nameEnd);
      if (leadQty && l.startsWith(xMatch[1]) && letters(name) === 0) { // "2 x Nasi Goreng 50.000" (jarang)
        name = l.slice(leadQty[0].length, toks[0].index);
      }
    } else if (midQtyOk && midQty) { // "Nasi Goreng 2 25.000 50.000" atau "Bakso Urat 2 22.000"
      qty = Number(midQty[2]);
      name = midQty[1];
    } else if (leadQty) {
      const q = Number(leadQty[1]);
      if (leadQty[2] || total % q === 0) { qty = q; name = l.slice(leadQty[0].length, toks[0].index); unit = null; }
      else name = l.slice(0, nameEnd);
    } else {
      name = l.slice(0, nameEnd);
    }

    // Samakan jumlah x satuan = total baris
    let unitPrice: number;
    if (qty > 1 && unit && Math.abs(unit * qty - total) <= Math.max(100, total * 0.01)) unitPrice = unit;
    else if (qty > 1 && total % qty === 0) unitPrice = total / qty;
    else if (qty > 1 && unit && unit < total) { unitPrice = unit; total = unit * qty; }
    else { qty = 1; unitPrice = total; }

    name = tidyName(name);
    if (letters(name) < 2 || HEADER_WORD_RE.test(name) || unitPrice < 100) continue;
    items.push({ name, qty, unitPrice });
  }

  const pickAdj = (key: 'discount' | 'service' | 'tax'): ParsedAdj | null => {
    const a = adj[key];
    if (!a.seen) return null;
    if (a.amount === 0 && a.percents.length === 0) return null;
    return { amount: a.amount, percent: a.percents.length === 1 ? a.percents[0] : null };
  };

  const itemsSum = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  if (items.length === 0) {
    warnings.push('Tidak ada item yang terbaca. Isi manual saja, atau coba foto ulang dengan struk lurus dan cahaya terang.');
  } else if (subtotal && Math.abs(itemsSum - subtotal) > Math.max(500, subtotal * 0.01)) {
    warnings.push('Jumlah semua item tidak sama dengan subtotal di struk. Ada item atau harga yang kemungkinan salah baca.');
  }

  return {
    merchant,
    date,
    items,
    subtotal,
    discount: pickAdj('discount'),
    service: pickAdj('service'),
    tax: pickAdj('tax'),
    total: grandTotal ?? plainTotal,
    warnings,
  };
}

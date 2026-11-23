// Logika murni untuk form "Catat Bayarin" (tanpa Supabase dan tanpa React).
// Satu Catatan = satu toko = satu baris pengeluaran (split_expenses).
import { AdjMode, ReceiptItem, computeReceipt } from '@/lib/splitReceipt';
import { splitEqual } from '@/lib/splitbill';
import { formatRupiah, parseRupiahInput } from '@/lib/utils';
import type { SplitExpense, SplitMember } from '@/lib/splitTypes';
import type { ParsedAdj, ParsedReceipt } from '@/lib/receiptParser';

export interface Adj { mode: AdjMode; display: string; raw: number }
export interface ItemDraft { key: string; name: string; priceDisplay: string; priceRaw: number; qtyText: string; memberIds: string[] }
export interface ScanInfo { receiptTotal: number | null; count: number; warnings: string[] }

export interface Catatan {
  key: string;
  source: 'manual' | 'struk';
  store: string;               // nama toko / tempat (opsional)
  note: string;                // catatan (opsional)
  date: string;                // YYYY-MM-DD
  paidBy: string;              // id anggota yang membayar dulu
  split: 'items' | 'nominal';  // items = per barang; nominal = bagi nominal sendiri tanpa rincian barang
  items: ItemDraft[];
  discount: Adj; service: Adj; tax: Adj;
  adjOpen: boolean;
  // Mode nominal
  nName: string; nTotalDisplay: string; nTotal: number; nMode: 'equal' | 'custom';
  nSelected: Record<string, boolean>; nCustom: Record<string, number>;
  scan?: ScanInfo;
}

let seq = 0;
export const nextKey = (prefix: string) => `${prefix}${++seq}`;

export const emptyAdj = (mode: AdjMode = 'percent'): Adj => ({ mode, display: '', raw: 0 });
export const newItem = (memberIds: string[] = []): ItemDraft => ({ key: nextKey('i'), name: '', priceDisplay: '', priceRaw: 0, qtyText: '1', memberIds });

function allSelected(memberIds: string[]): Record<string, boolean> {
  const sel: Record<string, boolean> = {};
  memberIds.forEach((id) => { sel[id] = true; });
  return sel;
}

export function newCatatan(opts: { date: string; paidBy: string; memberIds: string[] }): Catatan {
  return {
    key: nextKey('c'), source: 'manual', store: '', note: '', date: opts.date, paidBy: opts.paidBy,
    split: 'nominal', items: [newItem([...opts.memberIds])],
    discount: emptyAdj(), service: emptyAdj(), tax: emptyAdj(), adjOpen: false,
    nName: '', nTotalDisplay: '', nTotal: 0, nMode: 'equal', nSelected: allSelected(opts.memberIds), nCustom: {},
  };
}

/** Catatan kosong yang belum disentuh (dipakai untuk menggantinya saat scan pertama masuk). */
export function isBlank(c: Catatan): boolean {
  return c.source === 'manual' && !c.store.trim() && !c.note.trim()
    && (c.split === 'items' ? c.items.every((it) => !it.name.trim() && it.priceRaw === 0) : !c.nName.trim() && c.nTotal === 0)
    && c.discount.raw === 0 && c.service.raw === 0 && c.tax.raw === 0;
}

const toAdj = (a: ParsedAdj | null): Adj => {
  if (!a) return emptyAdj();
  if (a.amount > 0) { const p = parseRupiahInput(String(a.amount)); return { mode: 'nominal', display: p.display, raw: p.raw }; }
  if (a.percent) return { mode: 'percent', display: String(a.percent), raw: a.percent };
  return emptyAdj();
};

/** Hasil scan satu struk menjadi satu catatan baru. */
export function fromScan(r: ParsedReceipt, base: { date: string; paidBy: string; memberIds: string[] }): Catatan {
  const c = newCatatan(base);
  c.source = 'struk';
  c.store = (r.merchant || '').slice(0, 80);
  if (r.date) c.date = r.date;
  c.items = r.items.map((it) => {
    const p = parseRupiahInput(String(it.unitPrice));
    return { key: nextKey('i'), name: it.name, priceDisplay: p.display, priceRaw: p.raw, qtyText: String(it.qty), memberIds: [] };
  });
  c.discount = toAdj(r.discount); c.service = toAdj(r.service); c.tax = toAdj(r.tax);
  c.adjOpen = c.discount.raw > 0 || c.service.raw > 0 || c.tax.raw > 0;
  c.scan = { receiptTotal: r.total, count: r.items.length, warnings: r.warnings };
  return c;
}

export function autoTitle(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  const t = clean.length <= 2 ? clean.join(', ') : `${clean[0]}, ${clean[1]} +${clean.length - 2}`;
  return t.slice(0, 120);
}

const adjFromAmount = (v: number | string | null | undefined): Adj => {
  const n = Number(v) || 0;
  if (n <= 0) return emptyAdj();
  return { mode: 'nominal', display: parseRupiahInput(String(Math.round(n))).display, raw: Math.round(n) };
};

/** Isi form dari pengeluaran yang sudah tersimpan (untuk tombol Ubah). */
export function fromExpense(exp: SplitExpense, members: SplitMember[]): Catatan {
  const memberIds = members.map((m) => m.id);
  const c = newCatatan({ date: exp.expense_date, paidBy: exp.paid_by, memberIds });
  c.store = (exp.store_name || '').slice(0, 80);
  c.note = (exp.note || '').slice(0, 300);
  const rows = (exp.split_expense_items || []).slice().sort((a, b) => a.position - b.position);

  if (exp.split_type === 'items' && rows.length > 0) {
    c.items = rows.map((it) => {
      const p = parseRupiahInput(String(Math.round(Number(it.price))));
      return { key: nextKey('i'), name: it.name, priceDisplay: p.display, priceRaw: p.raw, qtyText: String(it.qty), memberIds: (it.split_item_assignees || []).map((a) => a.member_id) };
    });
    c.discount = adjFromAmount(exp.discount_amount);
    c.service = adjFromAmount(exp.service_amount);
    c.tax = adjFromAmount(exp.tax_amount);
    c.adjOpen = c.discount.raw > 0 || c.service.raw > 0 || c.tax.raw > 0;
    // Judul lama yang berbeda dari judul otomatis disimpan sebagai nama toko supaya tidak hilang
    if (!c.store && exp.title && exp.title !== autoTitle(rows.map((r) => r.name))) c.store = exp.title.slice(0, 80);
    return c;
  }

  const shares = exp.split_shares || [];
  const sel: Record<string, boolean> = {};
  const custom: Record<string, number> = {};
  memberIds.forEach((id) => { sel[id] = false; });
  shares.forEach((s) => { if (Number(s.share_amount) > 0) { sel[s.member_id] = true; custom[s.member_id] = Math.round(Number(s.share_amount)); } });
  const total = Math.round(Number(exp.total_amount));
  c.split = 'nominal';
  c.nName = exp.title;
  c.nTotal = total; c.nTotalDisplay = parseRupiahInput(String(total)).display;
  c.nMode = exp.split_type === 'custom' ? 'custom' : 'equal';
  c.nSelected = sel; c.nCustom = custom;
  return c;
}

export function receiptItemsOf(c: Catatan): ReceiptItem[] {
  return c.items
    .filter((it) => it.name.trim() || it.priceRaw > 0)
    .map((it) => ({ key: it.key, name: it.name.trim() || 'Barang', unitPrice: it.priceRaw, qty: Math.max(1, parseInt(it.qtyText, 10) || 1), memberIds: it.memberIds }));
}

export function computeFor(c: Catatan, memberIds: string[]) {
  return computeReceipt(receiptItemsOf(c), {
    discount: c.discount.raw, discountMode: c.discount.mode,
    service: c.service.raw, serviceMode: c.service.mode,
    tax: c.tax.raw, taxMode: c.tax.mode,
  }, memberIds);
}

/** Total catatan untuk ringkasan (tanpa validasi). */
export function totalOf(c: Catatan, memberIds: string[]): number {
  return c.split === 'nominal' ? c.nTotal : computeFor(c, memberIds).total;
}

export interface Calc {
  title: string; total: number; subtotal: number; discount: number; service: number; tax: number;
  splitType: 'items' | 'equal' | 'custom';
  shares: Record<string, number>;
  items: { name: string; price: number; qty: number; memberIds: string[] }[];
}
export type CalcResult = { ok: Calc } | { error: { title: string; msg: string } };
const fail = (title: string, msg: string): CalcResult => ({ error: { title, msg } });

/** Validasi + hitung satu catatan. Pesan error sama gaya dengan form lama. */
export function calcCatatan(c: Catatan, members: SplitMember[]): CalcResult {
  const memberIds = members.map((m) => m.id);
  if (!c.date) return fail('Data Belum Lengkap', 'Pilih tanggalnya.');
  if (!c.paidBy) return fail('Data Belum Lengkap', 'Pilih siapa yang membayar.');

  if (c.split === 'items') {
    const valid = c.items.filter((it) => it.name.trim() || it.priceRaw > 0);
    if (valid.length === 0) return fail('Belum Ada Barang', 'Tambahkan minimal satu barang.');
    if (valid.some((it) => !it.name.trim() || it.priceRaw <= 0)) return fail('Barang Belum Lengkap', 'Setiap barang perlu nama dan harga.');
    const r = computeFor(c, memberIds);
    if (r.unassigned.length > 0) return fail('Pemakai Belum Dipilih', `${r.unassigned.length} barang belum dipilih siapa yang memakainya.`);
    if (r.total <= 0) return fail('Total Nol', 'Total tagihan harus lebih dari nol.');
    const shares: Record<string, number> = {};
    memberIds.forEach((id) => { if (r.perMember[id] && r.perMember[id].total > 0) shares[id] = r.perMember[id].total; });
    return {
      ok: {
        title: autoTitle(valid.map((it) => it.name)), total: r.total, subtotal: r.subtotal, discount: r.discount, service: r.service, tax: r.tax,
        splitType: 'items', shares,
        items: valid.map((it) => ({ name: it.name.trim(), price: it.priceRaw, qty: Math.max(1, parseInt(it.qtyText, 10) || 1), memberIds: it.memberIds })),
      },
    };
  }

  // Mode nominal
  if (!c.nName.trim()) return fail('Data Belum Lengkap', 'Isi nama barangnya.');
  if (c.nTotal <= 0) return fail('Nominal Kosong', 'Isi total tagihan.');
  const ids = members.filter((m) => c.nSelected[m.id]).map((m) => m.id);
  if (ids.length === 0) return fail('Data Belum Lengkap', 'Pilih minimal satu orang yang ikut menanggung.');
  let shares: Record<string, number> = {};
  if (c.nMode === 'equal') shares = splitEqual(c.nTotal, ids);
  else {
    ids.forEach((id) => { shares[id] = c.nCustom[id] || 0; });
    const sum = Object.values(shares).reduce((a, b) => a + b, 0);
    if (sum !== c.nTotal) {
      const diff = c.nTotal - sum;
      return fail('Pembagian Belum Pas', diff > 0 ? `Masih kurang ${formatRupiah(diff)} dari total tagihan.` : `Kelebihan ${formatRupiah(-diff)} dari total tagihan.`);
    }
  }
  return { ok: { title: c.nName.trim().slice(0, 120), total: c.nTotal, subtotal: c.nTotal, discount: 0, service: 0, tax: 0, splitType: c.nMode, shares, items: [] } };
}

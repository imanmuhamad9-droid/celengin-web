// Hitungan Cicilan yang MURNI (tanpa Supabase). Bulan berbentuk "YYYY-MM".
// Konsep: tiap bulan sebuah bucket punya tagihan = jumlah cicilan yang jatuh di bulan itu.
// Yang belum dibayar ikut terbawa ke bulan berikutnya, dan bayar lebih mengurangi bulan depan.

export type InstKind = 'cc' | 'paylater' | 'kta' | 'other';

export const KIND_LABEL: Record<InstKind, string> = {
  cc: 'Kartu kredit',
  paylater: 'Paylater',
  kta: 'KTA / pinjaman',
  other: 'Lainnya',
};

/** Aturan bank untuk satu bucket. Kolom kosong / 0 = aturan itu tidak dipakai. */
export interface GroupRules {
  /** bunga atas sisa tagihan, persen per bulan */
  interest_pct?: number | string | null;
  /** pembayaran minimum: persen dari tagihan */
  min_pct?: number | string | null;
  /** pembayaran minimum: batas bawah rupiah */
  min_floor?: number | string | null;
  /** true: minimum = cicilan bulan itu + persen dari sisanya (gaya BCA) */
  min_with_installments?: boolean | null;
  /** denda bila minimum belum terbayar saat jatuh tempo: persen tagihan, dengan batas bawah dan atas */
  late_fee_pct?: number | string | null;
  late_fee_min?: number | string | null;
  late_fee_max?: number | string | null;
}

export interface InstGroup extends GroupRules {
  id: string; name: string; kind: InstKind; due_day: number;
  /** Lembar tagihan terakhir: bulan jatuh temponya (YYYY-MM), total tagihan, dan minimum yang tertera */
  statement_month?: string | null;
  statement_total?: number | string | null;
  min_payment?: number | string | null;
  /** Keterangan bebas, mis. harus bayar ke mana atau transfer ke rekening apa */
  pay_note?: string | null;
}

/**
 * Aturan per bank, dibaca dari RIPLAY/tarif resmi (BCA berlaku per 19 Agu 2026, CIMB Niaga halaman tarif).
 * Keduanya masih memakai relaksasi BI (minimum 5%, denda 1%) sampai 31 Des 2026; setelah itu bisa kembali
 * ke aturan lama, jadi semua angka bisa diubah per bucket.
 */
export const BANK_PRESETS: Record<string, { label: string; rules: Required<GroupRules> }> = {
  bca: { label: 'BCA', rules: { interest_pct: 1.75, min_pct: 5, min_floor: 0, min_with_installments: true, late_fee_pct: 1, late_fee_min: 0, late_fee_max: 100_000 } },
  cimb: { label: 'CIMB Niaga', rules: { interest_pct: 1.75, min_pct: 5, min_floor: 50_000, min_with_installments: false, late_fee_pct: 1, late_fee_min: 75_000, late_fee_max: 100_000 } },
  none: { label: 'Tanpa aturan', rules: { interest_pct: 0, min_pct: 0, min_floor: 0, min_with_installments: false, late_fee_pct: 0, late_fee_min: 0, late_fee_max: 0 } },
};
export interface InstItem {
  id: string; group_id: string; name: string;
  principal: number | string; rate_pct: number | string; tenor: number;
  monthly_amount: number | string; start_month: string; note: string | null;
  /** null = dilacak sejak start_month */
  track_from?: string | null;
}
export interface InstPayment { id: string; group_id: string; month: string; amount: number | string; paid_on: string }

const num = (v: number | string) => Number(v) || 0;
const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

export function addMonthKey(ym: string, n: number): string {
  const t = monthIndex(ym) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** Cicilan per bulan dari harga pokok, tenor, dan bunga flat per bulan (0 = tanpa bunga). */
export function calcMonthly(principal: number, tenor: number, ratePctPerMonth: number): number {
  if (principal <= 0 || tenor <= 0) return 0;
  return Math.round(principal / tenor + (principal * Math.max(0, ratePctPerMonth)) / 100);
}

/** Cicilan ke berapa di bulan ym (1..tenor), atau 0 bila belum mulai / sudah lunas. */
export function installmentNo(item: InstItem, ym: string): number {
  const n = monthIndex(ym) - monthIndex(item.start_month) + 1;
  return n >= 1 && n <= item.tenor ? n : 0;
}

/** Bulan pertama yang dilacak: cicilan sebelum bulan ini dianggap sudah dibayar. */
export const trackStart = (item: InstItem) => (item.track_from && item.track_from > item.start_month ? item.track_from : item.start_month);

/** Bulan mulai dilacak untuk cicilan baru: bulan ini, atau bulan pertama bila belum mulai. */
export const defaultTrackFrom = (startMonth: string, currentMonth: string) => (startMonth > currentMonth ? startMonth : currentMonth);

/** Jumlah cicilan yang masih harus dilacak (tenor dikurangi yang sudah lewat sebelum track_from). */
const trackedCount = (item: InstItem) => Math.max(0, item.tenor - (monthIndex(trackStart(item)) - monthIndex(item.start_month)));

/** Total cicilan item ini yang jatuh tempo (dan dilacak) sampai dan termasuk bulan ym. */
function cumDueItem(item: InstItem, ym: string): number {
  const n = Math.min(trackedCount(item), Math.max(0, monthIndex(ym) - monthIndex(trackStart(item)) + 1));
  return n * num(item.monthly_amount);
}

export function dueIn(items: InstItem[], ym: string): number {
  return items.reduce((s, i) => s + (installmentNo(i, ym) ? num(i.monthly_amount) : 0), 0);
}
export const cumDue = (items: InstItem[], ym: string) => items.reduce((s, i) => s + cumDueItem(i, ym), 0);
export const cumPaid = (payments: InstPayment[], ym: string) =>
  payments.reduce((s, p) => s + (p.month <= ym ? num(p.amount) : 0), 0);
export const paidIn = (payments: InstPayment[], ym: string) =>
  payments.reduce((s, p) => s + (p.month === ym ? num(p.amount) : 0), 0);

export interface MonthPlan {
  month: string;
  /** cicilan baru yang jatuh di bulan ini */
  due: number;
  /** sisa bulan-bulan sebelumnya yang belum dibayar (bawaan) */
  carry: number;
  /** yang sudah dibayar untuk bulan ini */
  paid: number;
  /** yang masih harus dibayar: bawaan + cicilan baru - pembayaran sampai bulan ini, tidak negatif */
  payable: number;
}

/** Rencana satu bulan untuk satu bucket (item dan pembayaran HANYA milik bucket itu). */
export function monthPlan(items: InstItem[], payments: InstPayment[], ym: string): MonthPlan {
  const prev = addMonthKey(ym, -1);
  return {
    month: ym,
    due: dueIn(items, ym),
    carry: Math.max(0, cumDue(items, prev) - cumPaid(payments, prev)),
    paid: paidIn(payments, ym),
    payable: Math.max(0, cumDue(items, ym) - cumPaid(payments, ym)),
  };
}

/** Proyeksi `count` bulan mulai dari `fromYm` bila tidak ada pembayaran baru. */
export function forecast(items: InstItem[], payments: InstPayment[], fromYm: string, count: number): MonthPlan[] {
  return Array.from({ length: count }, (_, i) => monthPlan(items, payments, addMonthKey(fromYm, i)));
}

/** Sisa seluruh cicilan yang belum dibayar (semua bulan, termasuk yang belum jatuh tempo). */
export function totalRemaining(items: InstItem[], payments: InstPayment[]): number {
  const all = items.reduce((s, i) => s + trackedCount(i) * num(i.monthly_amount), 0);
  return Math.max(0, all - payments.reduce((s, p) => s + num(p.amount), 0));
}

/** Bulan cicilan terakhir di bucket ini, atau null kalau kosong. */
export function lastMonth(items: InstItem[]): string | null {
  if (!items.length) return null;
  return items.map((i) => addMonthKey(i.start_month, i.tenor - 1)).sort().at(-1) ?? null;
}

/** Tanggal jatuh tempo bucket di bulan ym; hari 31 di bulan pendek jadi hari terakhir bulan itu. */
export function dueDateOf(group: Pick<InstGroup, 'due_day'>, ym: string): string {
  const last = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
  return `${ym}-${String(Math.min(group.due_day, last)).padStart(2, '0')}`;
}

export interface GroupStatus {
  /** total tagihan bulan ini sebelum dibayar (lembar tagihan bila ada, kalau tidak dari cicilan) */
  bill: number;
  paid: number;
  remaining: number;
  /** pembayaran minimum, 0 bila tidak diketahui */
  minDue: number;
  fromStatement: boolean;
  plan: MonthPlan;
}

/** Posisi satu bucket di bulan ym. Memakai total lembar tagihan bila lembar itu untuk bulan ym. */
export function groupStatus(g: InstGroup, items: InstItem[], payments: InstPayment[], ym: string): GroupStatus {
  const plan = monthPlan(items, payments, ym);
  const fromStatement = g.statement_month === ym && num(g.statement_total ?? 0) > 0;
  const bill = fromStatement ? num(g.statement_total ?? 0) : plan.carry + plan.due;
  const paid = fromStatement ? paidIn(payments, ym) : plan.paid;
  const remaining = fromStatement ? Math.max(0, bill - paid) : plan.payable;

  let minDue = 0;
  if (fromStatement && num(g.min_payment ?? 0) > 0) {
    minDue = num(g.min_payment ?? 0);
  } else {
    const pct = num(g.min_pct ?? 0) / 100;
    minDue = g.min_with_installments
      ? plan.due + pct * Math.max(0, bill - plan.due)
      : Math.max(pct * bill, num(g.min_floor ?? 0));
  }
  return { bill, paid, remaining, minDue: Math.round(Math.min(minDue, bill)), fromStatement, plan };
}

export interface NextProjection {
  month: string;
  /** sisa bulan ini yang ikut ke bulan berikutnya (0 bila belum ada pembayaran sama sekali) */
  remaining: number;
  /** perkiraan bunga atas sisa itu (satu bulan penuh) */
  interest: number;
  /** denda bila minimum belum terpenuhi saat jatuh tempo */
  lateFee: number;
  /** cicilan baru yang jatuh bulan depan */
  newInstallments: number;
  total: number;
  minDue: number;
  belowMin: boolean;
  /** sudah ada pembayaran (termasuk simulasi) untuk bulan ini */
  hasPayment: boolean;
}

/**
 * Bulan tagihan yang sedang ditunggu pembayarannya untuk bucket ini. Bila ada lembar tagihan yang jatuh
 * tempo bulan ini atau nanti (mis. jatuh tempo 7 Des, dilihat 19 Nov), itulah bulannya; kalau tidak, bulan kalender.
 */
export function activeMonth(g: InstGroup, calendarMonth: string): string {
  return g.statement_month && num(g.statement_total ?? 0) > 0 && g.statement_month >= calendarMonth ? g.statement_month : calendarMonth;
}

/**
 * Perkiraan tagihan bulan berikutnya, bila bulan ini ditambah pembayaran `extraPay`.
 * - Belum ada pembayaran sama sekali: murni cicilan yang jatuh bulan berikutnya (sisa tidak diasumsikan).
 * - Sudah ada pembayaran tapi kurang dari tagihan: sisanya ikut, ditambah bunga dan denda (bila di bawah minimum).
 * Belum termasuk belanja non-cicilan baru. Bunga memakai satu bulan penuh dari sisa (kasar: bank menghitung harian).
 */
export function projectNext(g: InstGroup, items: InstItem[], payments: InstPayment[], ym: string, extraPay = 0): NextProjection {
  const st = groupStatus(g, items, payments, ym);
  const paidTotal = st.paid + Math.max(0, extraPay);
  const hasPayment = paidTotal > 0;
  const remaining = hasPayment ? Math.max(0, st.remaining - Math.max(0, extraPay)) : 0;
  const interest = Math.round(remaining * (num(g.interest_pct ?? 0) / 100));
  const belowMin = hasPayment && st.minDue > 0 && paidTotal < st.minDue;
  const feePct = num(g.late_fee_pct ?? 0) / 100;
  let lateFee = 0;
  if (belowMin && feePct > 0) {
    const max = num(g.late_fee_max ?? 0);
    lateFee = Math.max(num(g.late_fee_min ?? 0), Math.round(st.bill * feePct));
    if (max > 0) lateFee = Math.min(lateFee, max);
  }
  const next = addMonthKey(ym, 1);
  const newInstallments = dueIn(items, next);
  return { month: next, remaining, interest, lateFee, newInstallments, total: remaining + interest + lateFee + newInstallments, minDue: st.minDue, belowMin, hasPayment };
}

/**
 * Tagihan satu bucket di bulan ym, dilihat dari bulan kalender `calendarMonth`:
 * bulan tagihannya = yang belum dibayar; bulan setelahnya = perkiraan (termasuk sisa/bunga bila sudah bayar sebagian);
 * bulan sesudahnya lagi = cicilan yang jatuh di bulan itu saja; bulan sebelumnya = 0.
 */
export function groupMonthTotal(g: InstGroup, items: InstItem[], payments: InstPayment[], calendarMonth: string, ym: string): number {
  const gm = activeMonth(g, calendarMonth);
  if (ym < gm) return 0;
  if (ym === gm) return groupStatus(g, items, payments, gm).remaining;
  if (ym === addMonthKey(gm, 1)) return projectNext(g, items, payments, gm).total;
  return dueIn(items, ym);
}

/** Tagihan 3 bulan berurutan untuk semua bucket, mulai dari bulan tagihan paling awal yang sedang ditunggu. */
export function upcomingTotals(
  groups: InstGroup[],
  itemsOf: (gid: string) => InstItem[],
  paysOf: (gid: string) => InstPayment[],
  calendarMonth: string,
): { months: [string, string, string]; totals: [number, number, number] } {
  const m0 = groups.length > 0 ? groups.map((g) => activeMonth(g, calendarMonth)).reduce((a, b) => (a < b ? a : b)) : calendarMonth;
  const months: [string, string, string] = [m0, addMonthKey(m0, 1), addMonthKey(m0, 2)];
  const totals = months.map((ym) => groups.reduce((sum, g) => sum + groupMonthTotal(g, itemsOf(g.id), paysOf(g.id), calendarMonth, ym), 0)) as [number, number, number];
  return { months, totals };
}

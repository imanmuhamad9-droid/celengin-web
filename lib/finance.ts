// Perhitungan murni untuk Anggaran, Dana Darurat, dan Kekayaan Bersih (tanpa Supabase dan tanpa React).

/** Nama kategori tanpa emoji/simbol di depan, huruf kecil: "🍜 Makan" dan "Makan" dianggap sama. */
export const normCat = (s: string | null | undefined): string => (s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase();
/** Nama kategori untuk ditampilkan (tanpa emoji di depan). */
export const catLabel = (s: string | null | undefined): string => (s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Tanpa kategori';

const num = (v: number | string | null | undefined): number => Number(v) || 0;

// ---------- Anggaran ----------
export interface BudgetRow { id: string; category: string; monthly_limit: number | string }
export interface BudgetUsage { id: string; category: string; limit: number; spent: number; remaining: number; pct: number; status: 'ok' | 'warn' | 'over' }
export interface Unbudgeted { key: string; label: string; spent: number }

export function budgetUsage(budgets: BudgetRow[], expenses: { merchant_name: string | null; amount: number | string }[]) {
  const spent = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const e of expenses) {
    const key = normCat(e.merchant_name) || 'tanpa kategori';
    spent.set(key, (spent.get(key) || 0) + num(e.amount));
    if (!labels.has(key)) labels.set(key, catLabel(e.merchant_name));
  }
  const rows: BudgetUsage[] = budgets.map((b) => {
    const limit = num(b.monthly_limit);
    const used = spent.get(normCat(b.category)) || 0;
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    return { id: b.id, category: b.category, limit, spent: used, remaining: limit - used, pct, status: pct > 100 ? 'over' : pct >= 80 ? 'warn' : 'ok' };
  });
  const budgeted = new Set(budgets.map((b) => normCat(b.category)));
  const unbudgeted: Unbudgeted[] = [...spent.entries()]
    .filter(([k]) => !budgeted.has(k))
    .map(([k, v]) => ({ key: k, label: labels.get(k) || k, spent: v }))
    .sort((a, b) => b.spent - a.spent);
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  return { rows, unbudgeted, totalLimit, totalSpent };
}

// ---------- Dana Darurat ----------
/** Rata-rata pengeluaran per siklus dari siklus-siklus yang ada pengeluarannya. */
export function avgMonthlyExpense(txs: { amount: number | string; transaction_date: string }[], cycles: { start: string; end: string }[]) {
  const sums = cycles.map((c) => txs.filter((t) => t.transaction_date >= c.start && t.transaction_date <= c.end).reduce((s, t) => s + num(t.amount), 0));
  const used = sums.filter((v) => v > 0);
  return { avg: used.length > 0 ? Math.round(used.reduce((a, b) => a + b, 0) / used.length) : 0, monthsUsed: used.length };
}

export function emergencyStatus(avg: number, months: number, saved: number) {
  const target = Math.round(avg * months);
  return {
    target,
    gap: Math.max(0, target - saved),
    pct: target > 0 ? Math.min(100, (saved / target) * 100) : 0,
    covered: avg > 0 ? saved / avg : 0,
  };
}

export function savingPlans(gap: number, horizons: number[] = [6, 12, 24]) {
  return horizons.map((m) => ({ months: m, perMonth: Math.ceil(gap / m), perWeek: Math.ceil(gap / (m * 4.345)) }));
}

// ---------- Kekayaan Bersih ----------
export interface NetItem { id: string; name: string; kind: 'asset' | 'debt'; amount: number | string; note?: string | null }
export interface NwAuto { saldo: number; darurat: number; impian: number }
export type NwInclude = { saldo: boolean; darurat: boolean; impian: boolean };
export const NW_INCLUDE_DEFAULT: NwInclude = { saldo: true, darurat: true, impian: true };
export const parseNwInclude = (raw: unknown): NwInclude => {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { saldo: o.saldo !== false, darurat: o.darurat !== false, impian: o.impian !== false };
};

export function netWorthTotals(auto: NwAuto, include: NwInclude, items: NetItem[]) {
  const autoAssets = (include.saldo ? auto.saldo : 0) + (include.darurat ? auto.darurat : 0) + (include.impian ? auto.impian : 0);
  const manualAssets = items.filter((i) => i.kind === 'asset').reduce((s, i) => s + num(i.amount), 0);
  const debts = items.filter((i) => i.kind === 'debt').reduce((s, i) => s + num(i.amount), 0);
  const assets = autoAssets + manualAssets;
  return { autoAssets, manualAssets, assets, debts, net: assets - debts };
}

export const monthKey = (ymd: string): string => ymd.slice(0, 7);

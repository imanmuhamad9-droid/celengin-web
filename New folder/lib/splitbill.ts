// Perhitungan Split Bill (murni, tanpa Supabase).

export interface ExpenseShare { user_id: string; share_amount: number | string }
export interface SharedExpense {
  id: string;
  title: string;
  total_amount: number | string;
  paid_by: string;
  created_by: string;
  expense_date: string;
  split_type: 'equal' | 'custom';
  created_at: string;
  shared_expense_shares?: ExpenseShare[];
}
export interface Settlement {
  id: string;
  from_user: string;
  to_user: string;
  amount: number | string;
  created_at: string;
}
export interface DebtLine { from: string; to: string; amount: number }

/** Bagi rata. Sisa rupiah dibagikan 1 per orang mulai dari yang pertama. */
export function splitEqual(total: number, userIds: string[]): Record<string, number> {
  const n = userIds.length;
  const result: Record<string, number> = {};
  if (n === 0) return result;
  const base = Math.floor(total / n);
  let remainder = total - base * n;
  userIds.forEach((id) => {
    result[id] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  });
  return result;
}

/**
 * Saldo bersih tiap anggota. Positif = akan menerima uang, negatif = masih berutang.
 * net = (yang dia talangi) - (bagian dia) + (pelunasan yang dia bayar) - (pelunasan yang dia terima)
 */
export function computeNet(
  memberIds: string[],
  expenses: SharedExpense[],
  settlements: Settlement[],
): Record<string, number> {
  const net: Record<string, number> = {};
  memberIds.forEach((id) => { net[id] = 0; });
  const add = (id: string, v: number) => { net[id] = (net[id] || 0) + v; };

  expenses.forEach((e) => {
    add(e.paid_by, Number(e.total_amount));
    (e.shared_expense_shares || []).forEach((s) => add(s.user_id, -Number(s.share_amount)));
  });
  settlements.forEach((s) => {
    add(s.from_user, Number(s.amount));
    add(s.to_user, -Number(s.amount));
  });
  return net;
}

/** Sederhanakan utang: paling sedikit jumlah transfer (greedy). */
export function simplifyDebts(net: Record<string, number>): DebtLine[] {
  const creditors = Object.entries(net).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const debtors = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const lines: DebtLine[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].v, creditors[j].v);
    if (pay > 0) lines.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].v -= pay;
    creditors[j].v -= pay;
    if (debtors[i].v <= 0) i += 1;
    if (creditors[j].v <= 0) j += 1;
  }
  return lines;
}

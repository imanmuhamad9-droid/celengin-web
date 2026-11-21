// Pengambil data (hanya membaca) untuk Simulasi dan Kalkulator: transaksi rutin, tagihan, dan cicilan.
import { supabase } from '@/lib/supabaseClient';
import { groupMonthTotal, type InstGroup, type InstItem, type InstPayment } from '@/lib/installments';
import { amountIn } from '@/lib/simulasi';
import type { Bill, RecurringRule } from '@/lib/types';

export async function loadRules(userId: string, type: 'income' | 'expense'): Promise<RecurringRule[]> {
  const { data, error } = await supabase.from('recurring_rules').select('*').eq('user_id', userId).eq('type', type).eq('is_active', true);
  if (error) throw error;
  return (data || []) as RecurringRule[];
}

export async function loadBills(userId: string): Promise<Bill[]> {
  const { data, error } = await supabase.from('bills').select('*').eq('user_id', userId).eq('is_active', true);
  if (error) throw error;
  return (data || []) as Bill[];
}

export interface InstData { groups: InstGroup[]; items: InstItem[]; pays: InstPayment[] }

export async function loadInstallments(userId: string): Promise<InstData> {
  const g = await supabase.from('installment_groups').select('*').eq('user_id', userId);
  if (g.error) throw g.error;
  const groups = (g.data || []) as InstGroup[];
  if (groups.length === 0) return { groups, items: [], pays: [] };
  const [it, pm] = await Promise.all([
    supabase.from('installments').select('*').eq('user_id', userId),
    supabase.from('installment_payments').select('*').eq('user_id', userId),
  ]);
  return { groups, items: (it.data || []) as InstItem[], pays: (pm.data || []) as InstPayment[] };
}

/** Total tagihan semua bucket cicilan di bulan ym, dilihat dari bulan kalender `calendarMonth`. */
export const installmentTotal = (d: InstData, calendarMonth: string, ym: string): number =>
  d.groups.reduce((s, g) => s + groupMonthTotal(g, d.items.filter((x) => x.group_id === g.id), d.pays.filter((x) => x.group_id === g.id), calendarMonth, ym), 0);

export const ruleAmount = (r: RecurringRule, ym: string): number => amountIn({ amount: Number(r.amount), frequency: r.frequency, date: r.start_date }, ym);
export const billAmount = (b: Bill, ym: string): number => amountIn({ amount: Number(b.amount), frequency: b.frequency, date: b.due_date }, ym);

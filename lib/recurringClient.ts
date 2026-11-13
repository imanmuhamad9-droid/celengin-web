import { supabase } from '@/lib/supabaseClient';
import { Frequency, firstRunAfter, dayOfMonth } from '@/lib/recurring';
import { toLocalDateStr } from '@/lib/utils';

export interface NewRuleInput {
  userId: string;
  merchantName: string;
  amount: number;
  type: 'income' | 'expense';
  frequency: Frequency;
  startDate: string; // tanggal transaksi pertama yang dicatat user
  walletId?: string | null;
}

/**
 * Membuat aturan transaksi berulang. Mengembalikan id aturan,
 * atau null kalau tabel belum ada / gagal (transaksi tetap boleh disimpan biasa).
 * Dipanggil dari event handler, jadi aman memakai new Date().
 */
export async function createRecurringRule(input: NewRuleInput): Promise<string | null> {
  const today = toLocalDateStr(new Date());
  const anchor = dayOfMonth(input.startDate);
  const { data, error } = await supabase
    .from('recurring_rules')
    .insert({
      user_id: input.userId,
      merchant_name: input.merchantName,
      amount: input.amount,
      type: input.type,
      frequency: input.frequency,
      start_date: input.startDate,
      anchor_day: anchor,
      next_run_date: firstRunAfter(input.startDate, input.frequency, anchor, today),
      ...(input.walletId ? { wallet_id: input.walletId } : {}),
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id as string;
}

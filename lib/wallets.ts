import { supabase } from '@/lib/supabaseClient';

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  type: 'cash' | 'bank' | 'ewallet' | 'other';
  emoji: string;
  initial_balance: number;
  is_default: boolean;
}

export const WALLET_TYPE_LABEL: Record<Wallet['type'], string> = {
  cash: 'Tunai',
  bank: 'Rekening Bank',
  ewallet: 'E-Wallet',
  other: 'Lainnya',
};

/**
 * Ambil dompet milik user. Kalau user belum punya satupun, buat "Dompet Utama".
 * Kalau tabel `wallets` belum ada (02_dompet.sql belum dijalankan) -> mengembalikan [] dan aplikasi
 * berjalan seperti biasa tanpa fitur dompet.
 */
export async function listWallets(userId: string, autoCreate = true): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) return [];
  if ((!data || data.length === 0) && autoCreate) {
    const { data: created, error: err2 } = await supabase
      .from('wallets')
      .insert({ user_id: userId, name: 'Dompet Utama', type: 'cash', emoji: '💼', is_default: true })
      .select('*')
      .single();
    if (err2 || !created) return [];
    return [created as Wallet];
  }
  return (data || []) as Wallet[];
}

export interface WalletTransfer {
  id: string;
  from_wallet_id: string;
  to_wallet_id: string;
  amount: number;
  note: string | null;
  transfer_date: string;
  created_at: string;
}

/** Saldo tiap dompet = saldo awal + pemasukan - pengeluaran + transfer masuk - transfer keluar. */
export function computeWalletBalances(
  wallets: Wallet[],
  transactions: { wallet_id?: string | null; type: string; amount: number | string }[],
  transfers: { from_wallet_id: string; to_wallet_id: string; amount: number | string }[],
) {
  const balances: Record<string, number> = {};
  wallets.forEach((w) => { balances[w.id] = Number(w.initial_balance) || 0; });
  let unassigned = 0;

  transactions.forEach((t) => {
    const delta = (t.type === 'income' ? 1 : -1) * Number(t.amount);
    if (t.wallet_id && balances[t.wallet_id] !== undefined) balances[t.wallet_id] += delta;
    else unassigned += delta;
  });
  transfers.forEach((tr) => {
    const a = Number(tr.amount);
    if (balances[tr.from_wallet_id] !== undefined) balances[tr.from_wallet_id] -= a;
    if (balances[tr.to_wallet_id] !== undefined) balances[tr.to_wallet_id] += a;
  });

  const initialTotal = wallets.reduce((s, w) => s + (Number(w.initial_balance) || 0), 0);
  return { balances, unassigned, initialTotal };
}

// Unduh semua data milik pengguna sebagai satu file JSON (hak akses data pribadi).
// Hanya membaca lewat klien biasa, jadi RLS tetap berlaku: yang terunduh pasti data milik sendiri.
// Panggil dari event handler (klik tombol).
import { supabase } from '@/lib/supabaseClient';

/** Tabel milik user dan kolom pemiliknya. push_subscriptions sengaja tidak disertakan (berisi kunci perangkat). */
export const EXPORT_TABLES: { table: string; ownerColumn: string }[] = [
  { table: 'profiles', ownerColumn: 'id' },
  { table: 'transactions', ownerColumn: 'user_id' },
  { table: 'wallets', ownerColumn: 'user_id' },
  { table: 'wallet_transfers', ownerColumn: 'user_id' },
  { table: 'bills', ownerColumn: 'user_id' },
  { table: 'recurring_rules', ownerColumn: 'user_id' },
  { table: 'budgets', ownerColumn: 'user_id' },
  { table: 'targets', ownerColumn: 'user_id' },
  { table: 'presets', ownerColumn: 'user_id' },
  { table: 'dream_goals', ownerColumn: 'user_id' },
  { table: 'goal_transactions', ownerColumn: 'user_id' },
  { table: 'emergency_entries', ownerColumn: 'user_id' },
  { table: 'net_worth_items', ownerColumn: 'user_id' },
  { table: 'net_worth_snapshots', ownerColumn: 'user_id' },
  { table: 'user_badges', ownerColumn: 'user_id' },
  { table: 'couple_goals', ownerColumn: 'created_by' },
  { table: 'couple_transactions', ownerColumn: 'user_id' },
  { table: 'split_groups', ownerColumn: 'user_id' },
  { table: 'simulations', ownerColumn: 'user_id' },
];

const PAGE = 1000;

async function fetchAllRows(table: string, ownerColumn: string, userId: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').eq(ownerColumn, userId).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data || []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

export interface ExportBundle {
  diekspor_pada: string;
  user_id: string;
  email: string | undefined;
  data: Record<string, Record<string, unknown>[]>;
  /** Tabel yang tidak bisa dibaca (mis. fitur belum diaktifkan di database), beserta alasannya. */
  gagal: Record<string, string>;
}

export async function collectUserData(): Promise<ExportBundle> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Belum login.');
  const userId = session.user.id;
  const data: ExportBundle['data'] = {};
  const gagal: ExportBundle['gagal'] = {};
  for (const { table, ownerColumn } of EXPORT_TABLES) {
    try { data[table] = await fetchAllRows(table, ownerColumn, userId); }
    catch (e) { gagal[table] = e instanceof Error ? e.message : String(e); }
  }
  return { diekspor_pada: new Date().toISOString(), user_id: userId, email: session.user.email, data, gagal };
}

export async function downloadAllData(): Promise<{ tables: number; rows: number; failed: number }> {
  const bundle = await collectUserData();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `celengin-data-${bundle.diekspor_pada.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  const tables = Object.keys(bundle.data);
  return { tables: tables.length, rows: tables.reduce((s, t) => s + bundle.data[t].length, 0), failed: Object.keys(bundle.gagal).length };
}

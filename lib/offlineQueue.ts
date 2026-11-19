// Antrean transaksi saat tidak ada sinyal. Dipakai layar Catat: bila simpan gagal karena jaringan,
// transaksi disimpan di perangkat lalu dikirim otomatis begitu online lagi.
//
// Aman diulang: tiap transaksi diberi id dari sisi klien, dan pengiriman memakai upsert yang mengabaikan
// duplikat, jadi kirim ulang setelah koneksi putus di tengah jalan tidak membuat transaksi ganda.
//
// Catatan privasi: antrean disimpan di localStorage perangkat sampai terkirim (biasanya hitungan menit).
// Service worker sengaja tidak menyimpan halaman/data keuangan, jadi antrean ini hanya melindungi
// transaksi yang dicatat saat aplikasi SUDAH terbuka lalu sinyal hilang.
import { supabase } from '@/lib/supabaseClient';

const KEY = 'celengin:tx-queue:v1';
export const TX_SYNCED_EVENT = 'celengin:tx-saved'; // sudah didengarkan Dashboard dan Riwayat
export const QUEUE_CHANGED_EVENT = 'celengin:tx-queue-changed';

export interface NewTransaction {
  user_id: string;
  merchant_name: string;
  amount: number;
  type: 'income' | 'expense';
  transaction_date: string;
  is_routine?: boolean;
  is_ai_scanned?: boolean;
  notes?: string;
  recurring_rule_id?: string;
  wallet_id?: string;
}

type QueuedTx = NewTransaction & { id: string };

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

function read(): QueuedTx[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(rows: QueuedTx[]): boolean {
  try {
    if (rows.length) localStorage.setItem(KEY, JSON.stringify(rows));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
    return true;
  } catch {
    return false; // penyimpanan penuh atau dinonaktifkan
  }
}

export const pendingCount = (userId?: string): number =>
  read().filter((r) => !userId || r.user_id === userId).length;

/** Kegagalan karena jaringan (boleh dicoba lagi), bukan karena data ditolak server. */
export function isNetworkError(err: { message?: string } | null | undefined): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return !!err?.message && /failed to fetch|fetch failed|network|load failed|timeout|timed out/i.test(err.message);
}

export type SaveResult = { ok: true; queued: boolean } | { ok: false; error: { message: string } };

/** Simpan transaksi. Bila gagal karena jaringan, masuk antrean dan dikirim nanti. */
export async function saveTransactions(rows: NewTransaction[]): Promise<SaveResult> {
  const withIds: QueuedTx[] = rows.map((r) => ({ ...r, id: newId() }));
  const { error } = await supabase.from('transactions').upsert(withIds, { onConflict: 'id', ignoreDuplicates: true });
  if (!error) return { ok: true, queued: false };
  if (!isNetworkError(error)) return { ok: false, error };
  if (!write([...read(), ...withIds])) return { ok: false, error: { message: 'Tidak ada sinyal dan memori perangkat penuh. Coba lagi saat online.' } };
  return { ok: true, queued: true };
}

let flushing = false;

/** Kirim antrean milik user ini. Mengembalikan jumlah transaksi yang berhasil terkirim. */
export async function flushQueue(userId: string): Promise<number> {
  if (flushing) return 0;
  const all = read();
  const mine = all.filter((r) => r.user_id === userId);
  if (mine.length === 0) return 0;
  flushing = true;
  try {
    const others = all.filter((r) => r.user_id !== userId);
    const { error } = await supabase.from('transactions').upsert(mine, { onConflict: 'id', ignoreDuplicates: true });
    if (!error) { write(others); return mine.length; }
    if (isNetworkError(error)) return 0; // masih offline: biarkan, coba lagi nanti

    // Ada baris yang ditolak server (mis. dompet sudah dihapus): kirim satu per satu supaya yang valid tetap masuk.
    let sent = 0;
    const stillPending: QueuedTx[] = [];
    for (const row of mine) {
      const { error: e1 } = await supabase.from('transactions').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
      if (!e1) sent += 1;
      else if (isNetworkError(e1)) stillPending.push(row);
      else console.error('Transaksi antrean ditolak server dan dibuang:', e1.message);
    }
    write([...others, ...stillPending]);
    return sent;
  } finally {
    flushing = false;
  }
}

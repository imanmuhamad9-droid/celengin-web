import { beforeEach, describe, expect, it, vi } from 'vitest';

// supabase palsu: tiap panggilan upsert dijawab oleh `respond`, yang bisa diatur per tes
type Row = { id: string; user_id: string; merchant_name: string };
let respond: (rows: Row | Row[]) => { message: string } | null = () => null;
const upsert = vi.fn(async (rows: Row | Row[]) => ({ error: respond(rows) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: () => ({ upsert }) } }));

import { flushQueue, pendingCount, saveTransactions, type NewTransaction } from '@/lib/offlineQueue';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  upsert.mockClear();
  respond = () => null;
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
  vi.stubGlobal('window', { dispatchEvent: () => true });
  vi.stubGlobal('navigator', { onLine: true });
});

const tx = (user_id: string, merchant_name: string): NewTransaction => ({
  user_id, merchant_name, amount: 1000, type: 'expense', transaction_date: '2026-11-19',
});
const NETWORK = { message: 'TypeError: Failed to fetch' };
const REJECTED = { message: 'insert or update on table "transactions" violates foreign key constraint' };

describe('saveTransactions', () => {
  it('online dan berhasil: langsung terkirim, antrean kosong, tiap baris punya id', async () => {
    const r = await saveTransactions([tx('u1', 'Makan')]);
    expect(r).toEqual({ ok: true, queued: false });
    expect(pendingCount()).toBe(0);
    const sent = upsert.mock.calls[0][0] as Row[];
    expect(sent[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('gagal karena jaringan: masuk antrean, bukan error', async () => {
    respond = () => NETWORK;
    const r = await saveTransactions([tx('u1', 'Makan'), tx('u1', 'Kopi')]);
    expect(r).toEqual({ ok: true, queued: true });
    expect(pendingCount('u1')).toBe(2);
  });

  it('ditolak server (bukan jaringan): error dikembalikan dan TIDAK diantrekan', async () => {
    respond = () => REJECTED;
    const r = await saveTransactions([tx('u1', 'Makan')]);
    expect(r.ok).toBe(false);
    expect(pendingCount()).toBe(0);
  });

  it('browser melapor offline: dianggap masalah jaringan walau pesan errornya lain', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    respond = () => ({ message: 'apa saja' });
    expect(await saveTransactions([tx('u1', 'Makan')])).toEqual({ ok: true, queued: true });
  });
});

describe('flushQueue', () => {
  it('mengirim hanya milik user ini dan menyisakan milik user lain', async () => {
    respond = () => NETWORK;
    await saveTransactions([tx('u1', 'A')]);
    await saveTransactions([tx('u2', 'B')]);
    respond = () => null;
    expect(await flushQueue('u1')).toBe(1);
    expect(pendingCount('u1')).toBe(0);
    expect(pendingCount('u2')).toBe(1);
  });

  it('masih offline: antrean tidak berkurang', async () => {
    respond = () => NETWORK;
    await saveTransactions([tx('u1', 'A')]);
    expect(await flushQueue('u1')).toBe(0);
    expect(pendingCount('u1')).toBe(1);
  });

  it('satu baris ditolak server: baris lain tetap terkirim, yang ditolak dibuang', async () => {
    respond = () => NETWORK;
    await saveTransactions([tx('u1', 'Baik'), tx('u1', 'Buruk')]);
    respond = (rows) => {
      const list = Array.isArray(rows) ? rows : [rows];
      return list.some((r) => r.merchant_name === 'Buruk') ? REJECTED : null;
    };
    expect(await flushQueue('u1')).toBe(1);
    expect(pendingCount()).toBe(0);
  });

  it('tanpa antrean tidak memanggil server', async () => {
    expect(await flushQueue('u1')).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});

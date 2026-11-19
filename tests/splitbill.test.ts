import { describe, expect, it } from 'vitest';
import { computeNet, simplifyDebts, splitEqual, type SharedExpense, type Settlement } from '@/lib/splitbill';

const exp = (paid_by: string, total: number, shares: Record<string, number>): SharedExpense => ({
  id: 'e', title: '', total_amount: total, paid_by, created_by: paid_by, expense_date: '2026-11-19',
  split_type: 'custom', created_at: '',
  shared_expense_shares: Object.entries(shares).map(([user_id, share_amount]) => ({ user_id, share_amount })),
});
const settle = (from_user: string, to_user: string, amount: number): Settlement => ({ id: 's', from_user, to_user, amount, created_at: '' });

describe('splitEqual', () => {
  it('membagi sisa rupiah 1 per orang dari yang pertama', () => {
    expect(splitEqual(100, ['a', 'b', 'c'])).toEqual({ a: 34, b: 33, c: 33 });
  });
  it('total tidak pernah berubah untuk berbagai kombinasi', () => {
    for (const total of [0, 1, 99, 100_000, 100_001]) {
      for (const n of [1, 2, 3, 7]) {
        const ids = Array.from({ length: n }, (_, i) => `u${i}`);
        const sum = Object.values(splitEqual(total, ids)).reduce((s, v) => s + v, 0);
        expect(sum).toBe(total);
      }
    }
  });
  it('tanpa anggota menghasilkan objek kosong, bukan error', () => {
    expect(splitEqual(100, [])).toEqual({});
  });
});

describe('computeNet', () => {
  it('yang menalangi menerima, yang lain berutang', () => {
    const net = computeNet(['A', 'B', 'C'], [exp('A', 90, { A: 30, B: 30, C: 30 })], []);
    expect(net).toEqual({ A: 60, B: -30, C: -30 });
  });
  it('pelunasan mengurangi utang pembayar dan piutang penerima', () => {
    const net = computeNet(['A', 'B', 'C'], [exp('A', 90, { A: 30, B: 30, C: 30 })], [settle('B', 'A', 30)]);
    expect(net).toEqual({ A: 30, B: 0, C: -30 });
  });
  it('angka berbentuk string dari database dihitung sebagai angka', () => {
    const e: SharedExpense = {
      ...exp('A', 0, {}),
      total_amount: '100',
      shared_expense_shares: [{ user_id: 'A', share_amount: '50' }, { user_id: 'B', share_amount: '50' }],
    };
    expect(computeNet(['A', 'B'], [e], [])).toEqual({ A: 50, B: -50 });
  });
  it('jumlah semua saldo nol bila bagian = total', () => {
    const net = computeNet(['A', 'B', 'C'], [exp('B', 100_001, { A: 33_334, B: 33_334, C: 33_333 })], [settle('C', 'B', 10_000)]);
    expect(Object.values(net).reduce((s, v) => s + v, 0)).toBe(0);
  });
});

describe('simplifyDebts', () => {
  it('semua berutang ke satu orang', () => {
    expect(simplifyDebts({ A: 60, B: -30, C: -30 })).toEqual([
      { from: 'B', to: 'A', amount: 30 },
      { from: 'C', to: 'A', amount: 30 },
    ]);
  });
  it('satu pembayar ke dua penerima', () => {
    expect(simplifyDebts({ A: 50, B: 30, C: -80 })).toEqual([
      { from: 'C', to: 'A', amount: 50 },
      { from: 'C', to: 'B', amount: 30 },
    ]);
  });
  it('sudah impas atau kosong tidak menghasilkan transfer', () => {
    expect(simplifyDebts({ A: 0, B: 0 })).toEqual([]);
    expect(simplifyDebts({})).toEqual([]);
  });
  it('menjalankan semua transfer membuat semua saldo nol, dengan paling banyak n-1 transfer', () => {
    const net = { A: 70, B: -20, C: -45, D: 15, E: -20 };
    const lines = simplifyDebts(net);
    const after: Record<string, number> = { ...net };
    lines.forEach((l) => { after[l.from] += l.amount; after[l.to] -= l.amount; });
    Object.values(after).forEach((v) => expect(v).toBe(0));
    expect(lines.length).toBeLessThanOrEqual(Object.keys(net).length - 1);
  });
});

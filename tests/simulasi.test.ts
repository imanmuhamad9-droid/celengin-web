import { describe, expect, it } from 'vitest';
import { amountIn, byMonths, daysInMonth, levelOf, mergeAutoRows, parseSimData, perDay, rowAmount, totalsFor, type SimRow } from '@/lib/simulasi';

const row = (o: Partial<SimRow>): SimRow => ({ id: 'r', group: 'duty', label: 'x', amount: 0, on: true, ...o });

describe('hitungan simulasi', () => {
  it('sisa = pemasukan - kewajiban - rencana', () => {
    const rows = [row({ group: 'income', amount: 8_000_000 }), row({ amount: 600_000 }), row({ amount: 450_000 }), row({ group: 'plan', amount: 1_000_000 })];
    expect(totalsFor(rows, '2026-12')).toEqual({ income: 8_000_000, duty: 1_050_000, plan: 1_000_000, left: 5_950_000 });
  });
  it('nilai khusus bulan menimpa jumlah bawaan', () => {
    const r = row({ group: 'income', amount: 8_000_000, by: { '2027-01': 9_000_000 } });
    expect(rowAmount(r, '2026-12')).toBe(8_000_000);
    expect(rowAmount(r, '2027-01')).toBe(9_000_000);
    expect(rowAmount(row({ amount: 5, by: { '2027-01': 0 } }), '2027-01')).toBe(0);
  });
  it('baris yang dimatikan tidak dihitung', () => {
    const rows = [row({ group: 'income', amount: 100 }), row({ amount: 40, on: false })];
    expect(totalsFor(rows, '2026-12').left).toBe(100);
  });
  it('sisa per hari mengikuti jumlah hari bulan itu', () => {
    expect(daysInMonth('2027-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(perDay(2_800_000, '2027-02')).toBe(100_000);
    expect(perDay(-5, '2027-02')).toBe(0);
  });
  it('tingkat peringatan', () => {
    expect(levelOf({ income: 100, duty: 120, plan: 0, left: -20 })).toBe('negative');
    expect(levelOf({ income: 100, duty: 95, plan: 0, left: 5 })).toBe('thin');
    expect(levelOf({ income: 100, duty: 50, plan: 0, left: 50 })).toBe('ok');
    expect(levelOf({ income: 0, duty: 0, plan: 0, left: 0 })).toBe('ok');
  });
});

describe('mengambil angka dari tagihan / transaksi rutin', () => {
  it('bulanan sama tiap bulan, tahunan hanya di bulannya, sekali hanya di bulannya', () => {
    expect(amountIn({ amount: 100, frequency: 'monthly', date: '2026-03-05' }, '2026-12')).toBe(100);
    expect(amountIn({ amount: 1200, frequency: 'yearly', date: '2026-12-15' }, '2027-12')).toBe(1200);
    expect(amountIn({ amount: 1200, frequency: 'yearly', date: '2026-12-15' }, '2027-01')).toBe(0);
    expect(amountIn({ amount: 50, frequency: 'once', date: '2026-12-20' }, '2026-12')).toBe(50);
    expect(amountIn({ amount: 50, frequency: 'once', date: '2026-12-20' }, '2027-01')).toBe(0);
  });
  it('mingguan = jumlah hari yang sama di bulan itu; harian = jumlah hari', () => {
    // 7 Des 2026 hari Senin; Senin di Des 2026: 7, 14, 21, 28 = 4
    expect(amountIn({ amount: 10, frequency: 'weekly', date: '2026-12-07' }, '2026-12')).toBe(40);
    // Senin di Mar 2027: 1, 8, 15, 22, 29 = 5
    expect(amountIn({ amount: 10, frequency: 'weekly', date: '2026-12-07' }, '2027-03')).toBe(50);
    expect(amountIn({ amount: 10, frequency: 'daily', date: '2026-12-07' }, '2027-02')).toBe(280);
  });
  it('byMonths mengisi tiap bulan', () => {
    expect(byMonths(['2026-12', '2027-01'], (m) => m.length)).toEqual({ '2026-12': 7, '2027-01': 7 });
  });
  it('mengambil ulang menimpa baris otomatis yang sama, baris lain dibiarkan', () => {
    const rows = [row({ id: 'a', auto: 'cicilan', amount: 1 }), row({ id: 'b', amount: 2 })];
    const out = mergeAutoRows(rows, [row({ id: 'c', auto: 'cicilan', amount: 9 })]);
    expect(out.map((r) => r.id)).toEqual(['b', 'c']);
  });
});

describe('membaca data dari database', () => {
  it('data rusak dibersihkan', () => {
    const d = parseSimData({ month: 'salah', rows: [{ group: 'income', label: 'Gaji', amount: '5', on: false, by: { '2026-12': 1, x: 'bukan' } }, { group: 'aneh' }, null] }, '2026-11');
    expect(d.month).toBe('2026-11');
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0]).toMatchObject({ group: 'income', amount: 5, on: false, by: { '2026-12': 1 } });
  });
  it('kosong menghasilkan data kosong yang aman', () => {
    expect(parseSimData(null, '2026-11')).toEqual({ month: '2026-11', rows: [] });
  });
});

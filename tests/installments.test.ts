import { describe, expect, it } from 'vitest';
import { BANK_PRESETS, activeMonth, addMonthKey, calcMonthly, dueDateOf, forecast, groupStatus, installmentNo, lastMonth, monthPlan, projectNext, totalRemaining, type InstGroup, type InstItem, type InstPayment } from '@/lib/installments';

const item = (o: Partial<InstItem> = {}): InstItem => ({
  id: 'i', group_id: 'g', name: 'Barang', principal: 0, rate_pct: 0, tenor: 3,
  monthly_amount: 100_000, start_month: '2026-10', note: null, ...o,
});
const pay = (month: string, amount: number): InstPayment => ({ id: month + amount, group_id: 'g', month, amount, paid_on: `${month}-05` });

describe('hitungan dasar', () => {
  it('bulan lintas tahun', () => {
    expect(addMonthKey('2026-11', 2)).toBe('2027-01');
    expect(addMonthKey('2026-01', -1)).toBe('2025-12');
  });
  it('cicilan per bulan: 0% dan berbunga', () => {
    expect(calcMonthly(400_000, 3, 0)).toBe(133_333);
    expect(calcMonthly(1_200_000, 12, 1.5)).toBe(118_000);
    expect(calcMonthly(0, 3, 0)).toBe(0);
  });
  it('cicilan ke-berapa', () => {
    const i = item();
    expect(installmentNo(i, '2026-09')).toBe(0);
    expect(installmentNo(i, '2026-10')).toBe(1);
    expect(installmentNo(i, '2026-12')).toBe(3);
    expect(installmentNo(i, '2027-01')).toBe(0);
  });
  it('tanggal jatuh tempo dipotong di akhir bulan', () => {
    expect(dueDateOf({ due_day: 31 }, '2026-02')).toBe('2026-02-28');
    expect(dueDateOf({ due_day: 7 }, '2026-12')).toBe('2026-12-07');
  });
});

// A: 100rb x 3 (Okt-Des). B: 50rb x 2 (Nov-Des). Total 400rb.
describe('cicilan yang sudah berjalan (track_from)', () => {
  // 24x, mulai 2025-09, dilacak sejak 2026-12: cicilan ke-16 s/d 24 = 9 kali tersisa
  const i = item({ tenor: 24, start_month: '2025-09', track_from: '2026-12', monthly_amount: 47_000 });
  it('yang lewat sebelum track_from dianggap lunas', () => {
    expect(monthPlan([i], [], '2026-11').payable).toBe(0);
    expect(monthPlan([i], [], '2026-12')).toMatchObject({ due: 47_000, carry: 0, payable: 47_000 });
    expect(monthPlan([i], [], '2027-01').payable).toBe(94_000);
  });
  it('total sisa hanya yang belum lewat, dan berhenti di tenor', () => {
    expect(totalRemaining([i], [])).toBe(9 * 47_000);
    expect(monthPlan([i], [], '2030-01').payable).toBe(9 * 47_000);
  });
});

describe('rencana bulanan', () => {
  const items = [item(), item({ id: 'j', monthly_amount: 50_000, start_month: '2026-11', tenor: 2 })];

  it('tanpa pembayaran, sisa ikut terbawa ke bulan berikutnya', () => {
    expect(monthPlan(items, [], '2026-10')).toMatchObject({ due: 100_000, carry: 0, payable: 100_000 });
    expect(monthPlan(items, [], '2026-11')).toMatchObject({ due: 150_000, carry: 100_000, payable: 250_000 });
  });
  it('bayar setengah: sisanya + cicilan bulan depan', () => {
    const p = [pay('2026-10', 50_000)];
    expect(monthPlan(items, p, '2026-10').payable).toBe(50_000);
    expect(monthPlan(items, p, '2026-11')).toMatchObject({ due: 150_000, carry: 50_000, payable: 200_000 });
  });
  it('bayar lebih mengurangi bulan depan, tidak pernah negatif', () => {
    const p = [pay('2026-10', 130_000)];
    expect(monthPlan(items, p, '2026-10').payable).toBe(0);
    expect(monthPlan(items, p, '2026-11').payable).toBe(120_000);
    expect(monthPlan([item()], [pay('2026-10', 500_000)], '2026-11').payable).toBe(0);
  });
  it('setelah tenor habis tidak ada cicilan baru, sisa tetap terbawa', () => {
    expect(monthPlan(items, [], '2027-03')).toMatchObject({ due: 0, carry: 400_000, payable: 400_000 });
  });
  it('proyeksi dan total sisa', () => {
    const p = [pay('2026-10', 100_000)];
    expect(forecast(items, p, '2026-10', 3).map((m) => m.payable)).toEqual([0, 150_000, 300_000]);
    expect(totalRemaining(items, p)).toBe(300_000);
    expect(lastMonth(items)).toBe('2026-12');
    expect(lastMonth([])).toBeNull();
  });
});

describe('prediksi bulan depan per bank', () => {
  const g = (o: Partial<InstGroup> = {}): InstGroup => ({ id: 'g', name: 'X', kind: 'cc', due_day: 7, ...o });

  it('CIMB: tagihan 847.163,84, bayar 500rb', () => {
    const cimb = g({ ...BANK_PRESETS.cimb.rules, statement_month: '2026-12', statement_total: 847_163.84, min_payment: 50_000 });
    const items = [item({ monthly_amount: 41_750, tenor: 12, start_month: '2026-08', track_from: '2026-12' }), item({ id: 'z', monthly_amount: 133_333.34, tenor: 3, start_month: '2026-10', track_from: '2026-12' })];
    const p = [pay('2026-12', 500_000)];
    const r = projectNext(cimb, items, p, '2026-12');
    expect(r.remaining).toBeCloseTo(347_163.84, 2);
    expect(r.interest).toBe(Math.round(347_163.84 * 0.0175));
    expect(r.lateFee).toBe(0);
    expect(r.newInstallments).toBe(41_750); // yang 3x sudah selesai
    expect(r.total).toBeCloseTo(347_163.84 + r.interest + 41_750, 0);
  });
  it('belum ada pembayaran: bulan depan murni cicilan baru, tanpa sisa, bunga, atau denda', () => {
    const cimb = g({ ...BANK_PRESETS.cimb.rules, statement_month: '2026-12', statement_total: 847_163.84, min_payment: 50_000 });
    const items = [item({ monthly_amount: 41_750, tenor: 12, start_month: '2026-08', track_from: '2026-12' })];
    expect(projectNext(cimb, items, [], '2026-12')).toMatchObject({ remaining: 0, interest: 0, lateFee: 0, total: 41_750, hasPayment: false });
  });
  it('bayar di bawah minimum: sisa ikut dan kena denda (batas bawah dan atas CIMB)', () => {
    const cimb = g({ ...BANK_PRESETS.cimb.rules, statement_month: '2026-12', statement_total: 847_163.84, min_payment: 50_000 });
    const p = [pay('2026-12', 10_000)];
    expect(projectNext(cimb, [], p, '2026-12').lateFee).toBe(75_000); // 1% = 8.472, naik ke batas bawah
    expect(projectNext({ ...cimb, statement_total: 9_000_000 }, [], p, '2026-12').lateFee).toBe(90_000); // 1% murni
    expect(projectNext({ ...cimb, statement_total: 20_000_000 }, [], p, '2026-12').lateFee).toBe(100_000); // dibatasi atas
    expect(projectNext(cimb, [], [pay('2026-12', 50_000)], '2026-12').lateFee).toBe(0); // minimum terpenuhi
  });
  it('bulan aktif: lembar tagihan yang jatuh tempo bulan depan dipakai sekarang', () => {
    const cimb = g({ statement_month: '2026-12', statement_total: 847_163.84 });
    expect(activeMonth(cimb, '2026-11')).toBe('2026-12');
    expect(activeMonth(cimb, '2026-12')).toBe('2026-12');
    expect(activeMonth(cimb, '2027-01')).toBe('2027-01'); // lembar sudah lewat
    expect(activeMonth(g(), '2026-11')).toBe('2026-11');
  });
  it('BCA: minimum = cicilan + 5% sisanya (cocok dengan lembar: 317.132)', () => {
    const bca = g({ ...BANK_PRESETS.bca.rules, due_day: 28, statement_month: '2026-11', statement_total: 482_456 });
    const items = [item({ monthly_amount: 85_517, tenor: 12, start_month: '2026-09', track_from: '2026-11' }), item({ id: 'b', monthly_amount: 135_632, tenor: 9, start_month: '2026-09', track_from: '2026-11' }), item({ id: 'c', monthly_amount: 87_282, tenor: 9, start_month: '2026-08', track_from: '2026-11' })];
    const st = groupStatus(bca, items, [], '2026-11');
    expect(st.bill).toBe(482_456);
    expect(st.minDue).toBe(317_132);
  });
  it('bayar penuh: tidak ada bunga dan denda, hanya cicilan baru', () => {
    const cimb = g({ ...BANK_PRESETS.cimb.rules, statement_month: '2026-12', statement_total: 500_000 });
    const items = [item({ monthly_amount: 41_750, tenor: 12, start_month: '2026-08', track_from: '2026-12' })];
    expect(projectNext(cimb, items, [pay('2026-12', 500_000)], '2026-12')).toMatchObject({ remaining: 0, interest: 0, lateFee: 0, total: 41_750 });
  });
  it('simulasi bayar tambahan (extraPay) dan tanpa lembar tagihan jatuh ke hitungan cicilan', () => {
    const items = [item({ monthly_amount: 100_000, tenor: 3, start_month: '2026-12', track_from: '2026-12' })];
    const r = projectNext(g({ interest_pct: 2 }), items, [], '2026-12', 40_000);
    expect(r).toMatchObject({ remaining: 60_000, interest: 1_200, newInstallments: 100_000, total: 161_200 });
  });
});

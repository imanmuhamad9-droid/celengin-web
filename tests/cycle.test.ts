import { describe, expect, it } from 'vitest';
import { cycleFor, normalizePayday, shiftCycle } from '@/lib/cycle';

describe('normalizePayday', () => {
  it('nilai tidak valid dianggap 1', () => {
    for (const v of [0, 32, -5, 'abc', null, undefined, NaN]) expect(normalizePayday(v)).toBe(1);
  });
  it('nilai valid dibulatkan', () => {
    expect(normalizePayday(25)).toBe(25);
    expect(normalizePayday('15')).toBe(15);
    expect(normalizePayday(15.4)).toBe(15);
  });
});

describe('cycleFor', () => {
  it('tanggal 1 = bulan kalender', () => {
    expect(cycleFor('2026-02-10', 1)).toEqual({ start: '2026-02-01', end: '2026-02-28', label: 'Februari 2026', totalDays: 28 });
  });
  it('gajian tanggal 25: sebelum dan tepat pada tanggal gajian', () => {
    expect(cycleFor('2026-11-13', 25)).toEqual({ start: '2026-10-25', end: '2026-11-24', label: '25 Okt - 24 Nov 2026', totalDays: 31 });
    expect(cycleFor('2026-11-25', 25)).toMatchObject({ start: '2026-11-25', end: '2026-12-24' });
  });
  it('gajian tanggal 31 di bulan Februari mulai pada hari terakhir bulan', () => {
    expect(cycleFor('2027-02-15', 31)).toMatchObject({ start: '2027-01-31', end: '2027-02-27' });
    expect(cycleFor('2027-02-28', 31)).toMatchObject({ start: '2027-02-28', end: '2027-03-30' });
  });
  it('siklus yang melewati pergantian tahun', () => {
    expect(cycleFor('2027-01-05', 25)).toMatchObject({ start: '2026-12-25', end: '2027-01-24' });
  });
  it('setiap tanggal masuk siklusnya, dan siklus berikutnya mulai setelah siklus ini berakhir', () => {
    for (const payday of [1, 15, 25, 29, 30, 31]) {
      const d = new Date(Date.UTC(2026, 0, 1));
      for (let i = 0; i < 400; i++) {
        const date = d.toISOString().slice(0, 10);
        const c = cycleFor(date, payday);
        expect(c.start <= date && date <= c.end).toBe(true);
        expect(shiftCycle(date, 1, payday).start > c.end).toBe(true);
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
  });
});

describe('shiftCycle', () => {
  it('mundur dan maju satu siklus', () => {
    expect(shiftCycle('2026-11-13', -1, 25)).toMatchObject({ start: '2026-09-25', end: '2026-10-24' });
    expect(shiftCycle('2026-11-13', 1, 25)).toMatchObject({ start: '2026-11-25', end: '2026-12-24' });
  });
});

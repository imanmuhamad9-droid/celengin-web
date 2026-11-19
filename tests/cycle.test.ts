import { describe, expect, it } from 'vitest';
import { adjustToWorkday, cycleFor, normalizePayday, paydayRuleFrom, shiftCycle, upcomingPaydays } from '@/lib/cycle';

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

// Fakta kalender 2026: 25 Okt = Minggu, 25 Nov = Rabu, 25 Agu = Selasa (Maulid Nabi), 25 Des = Jumat (Natal; 24 Des cuti bersama).
describe('penggeseran gajian ke hari kerja', () => {
  it('adjustToWorkday: akhir pekan maju ke Jumat atau mundur ke Senin', () => {
    expect(adjustToWorkday('2026-10-25', 'before')).toBe('2026-10-23');
    expect(adjustToWorkday('2026-10-25', 'after')).toBe('2026-10-26');
    expect(adjustToWorkday('2026-10-25', 'none')).toBe('2026-10-25');
  });
  it('hari kerja biasa tidak berubah', () => {
    expect(adjustToWorkday('2026-11-25', 'before')).toBe('2026-11-25');
    expect(adjustToWorkday('2026-11-25', 'after')).toBe('2026-11-25');
  });
  it('libur nasional di hari kerja ikut digeser', () => {
    expect(adjustToWorkday('2026-08-25', 'before')).toBe('2026-08-24');
    expect(adjustToWorkday('2026-08-25', 'after')).toBe('2026-08-26');
  });
  it('libur beruntun (cuti bersama + Natal + akhir pekan) dilewati semuanya', () => {
    expect(adjustToWorkday('2026-12-25', 'before')).toBe('2026-12-23');
    expect(adjustToWorkday('2026-12-25', 'after')).toBe('2026-12-28');
  });

  it('maju: siklus baru mulai Jumat 23 Okt, jadi Sabtu 24 Okt sudah masuk siklus baru', () => {
    const rule = { day: 25, shift: 'before' as const };
    expect(cycleFor('2026-10-24', rule)).toEqual({ start: '2026-10-23', end: '2026-11-24', label: '23 Okt - 24 Nov 2026', totalDays: 33 });
    expect(cycleFor('2026-10-22', rule)).toMatchObject({ start: '2026-09-25', end: '2026-10-22' });
  });
  it('mundur: siklus baru mulai Senin 26 Okt, jadi Minggu 25 Okt masih siklus lama', () => {
    const rule = { day: 25, shift: 'after' as const };
    expect(cycleFor('2026-10-25', rule)).toMatchObject({ start: '2026-09-25', end: '2026-10-25' });
    expect(cycleFor('2026-10-26', rule)).toMatchObject({ start: '2026-10-26', end: '2026-11-24' });
  });
  it('tanpa penggeseran hasilnya sama persis dengan sebelumnya', () => {
    expect(cycleFor('2026-10-25', { day: 25, shift: 'none' })).toEqual(cycleFor('2026-10-25', 25));
  });
  it('tanggal 1 (bulan kalender) tidak pernah digeser', () => {
    expect(cycleFor('2026-11-10', { day: 1, shift: 'before' })).toEqual(cycleFor('2026-11-10', 1));
  });
  it('siklus selalu menyambung tanpa celah atau tumpang tindih, untuk semua arah dan tanggal', () => {
    for (const shift of ['none', 'before', 'after'] as const) {
      for (const day of [2, 15, 25, 28, 31]) {
        const rule = { day, shift };
        const d = new Date(Date.UTC(2026, 0, 1));
        for (let i = 0; i < 800; i++) {
          const date = d.toISOString().slice(0, 10);
          const c = cycleFor(date, rule);
          expect(c.start <= date && date <= c.end).toBe(true);
          // Rangkaian libur Maret 2027 (Nyepi, Idulfitri, cuti bersama) menggeser gajian tgl 15 ke 5 Maret: siklus 18 dan 41 hari itu wajar.
          expect(c.totalDays).toBeGreaterThanOrEqual(15);
          expect(c.totalDays).toBeLessThanOrEqual(45);
          expect(cycleFor(addDaysStr(c.end, 1), rule).start).toBe(addDaysStr(c.end, 1));
          d.setUTCDate(d.getUTCDate() + 1);
        }
      }
    }
  });
  it('upcomingPaydays: tiga gajian berikutnya sudah digeser', () => {
    expect(upcomingPaydays('2026-10-10', { day: 25, shift: 'before' }, 3)).toEqual(['2026-10-23', '2026-11-25', '2026-12-23']);
    expect(upcomingPaydays('2026-10-26', { day: 25, shift: 'after' }, 1)).toEqual(['2026-10-26']);
  });
  it('paydayRuleFrom membaca profil dan mengabaikan nilai aneh', () => {
    expect(paydayRuleFrom({ payday: 25, payday_shift: 'after' })).toEqual({ day: 25, shift: 'after' });
    expect(paydayRuleFrom({ payday: '25', payday_shift: 'sembarang' })).toEqual({ day: 25, shift: 'none' });
    expect(paydayRuleFrom(null)).toEqual({ day: 1, shift: 'none' });
  });
});

function addDaysStr(d: string, n: number): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
}

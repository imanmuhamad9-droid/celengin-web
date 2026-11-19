import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, addMonths, dayOfWeek, diffDays, firstRunAfter, nextOccurrence, todayInJakarta } from '@/lib/recurring';

describe('nextOccurrence', () => {
  it('bulanan anchor 31: Februari memakai hari terakhir, Maret kembali ke 31', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    expect(nextOccurrence('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
    expect(nextOccurrence('2026-03-31', 'monthly', 31)).toBe('2026-04-30');
  });
  it('tahun kabisat', () => {
    expect(nextOccurrence('2028-01-31', 'monthly', 31)).toBe('2028-02-29');
    expect(nextOccurrence('2028-02-29', 'yearly', 29)).toBe('2029-02-28');
    expect(nextOccurrence('2029-02-28', 'yearly', 29)).toBe('2030-02-28');
  });
  it('pergantian tahun', () => {
    expect(nextOccurrence('2026-12-31', 'daily', 31)).toBe('2027-01-01');
    expect(nextOccurrence('2026-12-28', 'weekly', 28)).toBe('2027-01-04');
    expect(nextOccurrence('2026-12-15', 'monthly', 15)).toBe('2027-01-15');
  });
  it('"once" tidak maju', () => {
    expect(nextOccurrence('2026-05-05', 'once', 5)).toBe('2026-05-05');
  });
});

describe('tanggal dasar', () => {
  it('addMonths memotong hari ke akhir bulan', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
  it('addDays dan diffDays lintas bulan dan tahun', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-02-28', '2026-03-01')).toBe(1);
    expect(diffDays('2026-03-01', '2026-02-28')).toBe(-1);
  });
  it('dayOfWeek: 1 Januari 2000 adalah Sabtu', () => {
    expect(dayOfWeek('2000-01-01')).toBe(6);
  });
});

describe('firstRunAfter', () => {
  it('jadwal pertama yang belum lewat; kejadian lama tidak disusulkan', () => {
    expect(firstRunAfter('2026-10-25', 'monthly', 25, '2026-11-13')).toBe('2026-11-25');
  });
  it('jika hari ini tepat jadwalnya, yang diambil jadwal berikutnya', () => {
    expect(firstRunAfter('2026-10-25', 'monthly', 25, '2026-11-25')).toBe('2026-12-25');
  });
});

describe('todayInJakarta', () => {
  afterEach(() => vi.useRealTimers());
  it('memakai WIB (UTC+7), bukan UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T16:59:59Z'));
    expect(todayInJakarta()).toBe('2026-11-18');
    vi.setSystemTime(new Date('2026-11-18T17:00:00Z'));
    expect(todayInJakarta()).toBe('2026-11-19');
  });
});

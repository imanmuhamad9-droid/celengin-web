// Fungsi tanggal MURNI (tanpa Supabase) - dipakai di browser dan di server (cron).
// Semua tanggal berbentuk string "YYYY-MM-DD" dan dihitung dengan UTC supaya tidak
// terpengaruh zona waktu perangkat.

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const FREQ_LABEL: Record<Frequency, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
};

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Aplikasi ini untuk Indonesia: cron dihitung dengan WIB (UTC+7). */
export const TZ_OFFSET_HOURS = 7;

function parse(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
}

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12
}

export function addDays(dateStr: string, n: number): string {
  const { y, m, day } = parse(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, day + n));
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addMonths(dateStr: string, n: number): string {
  const { y, m, day } = parse(dateStr);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fmt(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

export function diffDays(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.day) - Date.UTC(a.y, a.m - 1, a.day)) / 86400000);
}

/** 0 = Minggu ... 6 = Sabtu */
export function dayOfWeek(dateStr: string): number {
  const { y, m, day } = parse(dateStr);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

export function dayOfMonth(dateStr: string): number {
  return parse(dateStr).day;
}

/** Tanggal "hari ini" menurut WIB (untuk server/cron). */
export function todayInJakarta(): string {
  const dt = new Date(Date.now() + TZ_OFFSET_HOURS * 3600 * 1000);
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Kejadian berikutnya setelah `current`. anchorDay menjaga tanggal 31 tidak "geser" setelah Februari. */
export function nextOccurrence(current: string, freq: Frequency | 'once', anchorDay: number): string {
  switch (freq) {
    case 'daily':
      return addDays(current, 1);
    case 'weekly':
      return addDays(current, 7);
    case 'monthly': {
      const { y, m } = parse(current);
      let ny = y;
      let nm = m + 1;
      if (nm > 12) { nm = 1; ny += 1; }
      return fmt(ny, nm, Math.min(anchorDay, daysInMonth(ny, nm)));
    }
    case 'yearly': {
      const { y, m } = parse(current);
      const ny = y + 1;
      return fmt(ny, m, Math.min(anchorDay, daysInMonth(ny, m)));
    }
    default:
      return current;
  }
}

/**
 * Jadwal pertama yang BELUM lewat: dipakai saat aturan dibuat.
 * Contoh: gaji bulanan dicatat tgl 25 Okt, hari ini 13 Nov -> jadwal pertama 25 Nov.
 * Kejadian yang sudah lewat tidak disusulkan, jadi tidak ada transaksi "susulan" yang mengejutkan.
 */
export function firstRunAfter(start: string, freq: Frequency, anchorDay: number, today: string): string {
  let next = nextOccurrence(start, freq, anchorDay);
  let guard = 0;
  while (next <= today && guard < 5000) {
    next = nextOccurrence(next, freq, anchorDay);
    guard += 1;
  }
  return next;
}

export function describeFrequency(rule: { frequency: Frequency; start_date: string; anchor_day: number }): string {
  switch (rule.frequency) {
    case 'daily':
      return 'Setiap hari';
    case 'weekly':
      return `Setiap hari ${DAY_NAMES[dayOfWeek(rule.start_date)]}`;
    case 'monthly':
      return `Setiap tanggal ${rule.anchor_day}`;
    case 'yearly': {
      const { m, day } = parse(rule.start_date);
      const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m - 1];
      return `Setiap tahun, ${day} ${bulan}`;
    }
  }
}

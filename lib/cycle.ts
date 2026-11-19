// Siklus gajian. Tanggal = string "YYYY-MM-DD". Tanggal gajian 1 = bulan kalender biasa.
// Bila tanggal gajian lebih besar dari jumlah hari di sebuah bulan (mis. 31 di bulan Februari),
// siklus di bulan itu dimulai pada hari terakhir bulan tersebut.
import { addDays, dayOfWeek, diffDays } from '@/lib/recurring';
import { holidayOn } from '@/lib/holidays';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const pad = (n: number) => String(n).padStart(2, '0');
const parts = (d: string) => { const [y, m, day] = d.split('-').map(Number); return { y, m, day }; };
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Bila tanggal gajian jatuh di akhir pekan / libur: 'before' = maju ke hari kerja sebelumnya (mis. Jumat), 'after' = mundur ke hari kerja berikutnya (mis. Senin). */
export type PayShift = 'none' | 'before' | 'after';
export interface PaydayRule { day: number; shift: PayShift }
/** Semua fungsi siklus menerima angka tanggal (tanpa geser) atau PaydayRule. */
export type PaydayInput = number | PaydayRule;

export const parsePayShift = (v: unknown): PayShift => (v === 'before' || v === 'after' ? v : 'none');

/** Nilai payday yang aman: bilangan bulat 1-31, selain itu dianggap 1. */
export function normalizePayday(p: unknown): number {
  const n = Math.round(Number(p));
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : 1;
}

/** Aturan gajian dari baris profil (kolom payday dan payday_shift). */
export function paydayRuleFrom(profile: { payday?: unknown; payday_shift?: unknown } | null | undefined): PaydayRule {
  return { day: normalizePayday(profile?.payday), shift: parsePayShift(profile?.payday_shift) };
}

/** Terima angka, PaydayRule, atau nilai apa saja; selalu menghasilkan PaydayRule yang valid. */
export function toPaydayRule(input: unknown): PaydayRule {
  if (typeof input === 'object' && input !== null && 'day' in input) {
    const o = input as { day: unknown; shift?: unknown };
    return { day: normalizePayday(o.day), shift: parsePayShift(o.shift) };
  }
  return { day: normalizePayday(input), shift: 'none' };
}

/** Hanya tanggalnya (1-31); 1 berarti bulan kalender biasa. */
export const paydayDay = (input: unknown): number => toPaydayRule(input).day;

/** Hari kerja = bukan Sabtu/Minggu dan bukan libur nasional/cuti bersama (data libur: lib/holidays.ts). */
export function isWorkday(date: string): boolean {
  const dow = dayOfWeek(date);
  return dow !== 0 && dow !== 6 && !holidayOn(date);
}

/** Geser ke hari kerja terdekat sesuai arah. Batas 14 langkah supaya tidak berputar selamanya. */
export function adjustToWorkday(date: string, shift: PayShift): string {
  if (shift === 'none') return date;
  const step = shift === 'before' ? -1 : 1;
  let d = date;
  for (let i = 0; i < 14 && !isWorkday(d); i++) d = addDays(d, step);
  return d;
}

/** Tanggal mulai siklus pada bulan (y, m); m boleh di luar 1-12 (dirapikan otomatis). */
function startInMonth(y: number, m: number, payday: number): string {
  const total = y * 12 + (m - 1);
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(payday, daysIn(ny, nm)))}`;
}

export interface Cycle {
  start: string;
  end: string;
  /** "November 2026" untuk bulan kalender, "25 Okt - 24 Nov 2026" untuk siklus gajian */
  label: string;
  totalDays: number;
}

/**
 * Tanggal mulai siklus untuk bulan ke-`idx` (idx = tahun*12 + bulan-1), sudah digeser ke hari kerja bila diminta.
 * Tanggal 1 selalu bulan kalender biasa dan tidak digeser.
 */
function effectiveStart(idx: number, rule: PaydayRule): string {
  const base = startInMonth(Math.floor(idx / 12), (idx % 12) + 1, rule.day);
  return rule.day > 1 ? adjustToWorkday(base, rule.shift) : base;
}

/** Siklus yang memuat tanggal `date`. */
export function cycleFor(date: string, paydayRaw: unknown): Cycle {
  const rule = toPaydayRule(paydayRaw);
  const { y, m } = parts(date);
  const idx = y * 12 + (m - 1);
  // Penggeseran bisa memindahkan awal siklus ke bulan sebelumnya (maju) atau sesudahnya (mundur; mis. tgl 31 yang
  // jatuh di akhir pekan pindah ke awal bulan berikutnya). Cari mundur mulai dari bulan depan sampai ketemu awal yang <= date.
  let startIdx = idx + 1;
  let start = effectiveStart(startIdx, rule);
  while (start > date && startIdx > idx - 4) { startIdx -= 1; start = effectiveStart(startIdx, rule); }
  const end = addDays(effectiveStart(startIdx + 1, rule), -1);
  const s = parts(start);
  const e = parts(end);
  const label = rule.day === 1
    ? `${BULAN[s.m - 1]} ${s.y}`
    : `${s.day} ${BULAN_PENDEK[s.m - 1]} - ${e.day} ${BULAN_PENDEK[e.m - 1]} ${e.y}`;
  return { start, end, label, totalDays: diffDays(start, end) + 1 };
}

/** Tanggal gajian berikutnya (termasuk hari ini bila tepat). `nominal` = tanggal sebelum digeser. Untuk pratinjau di Pengaturan. */
export function upcomingPaydayInfo(from: string, paydayRaw: unknown, count = 3): { date: string; nominal: string }[] {
  const rule = toPaydayRule(paydayRaw);
  const { y, m } = parts(from);
  const out: { date: string; nominal: string }[] = [];
  for (let idx = y * 12 + (m - 1) - 1; out.length < count && idx < y * 12 + 40; idx++) {
    const date = effectiveStart(idx, rule);
    if (date >= from) out.push({ date, nominal: startInMonth(Math.floor(idx / 12), (idx % 12) + 1, rule.day) });
  }
  return out;
}

export const upcomingPaydays = (from: string, paydayRaw: unknown, count = 3): string[] =>
  upcomingPaydayInfo(from, paydayRaw, count).map((x) => x.date);

/** Siklus sebelumnya (-1) atau berikutnya (+1) dari siklus yang memuat `date`. */
export function shiftCycle(date: string, dir: 1 | -1, paydayRaw: unknown): Cycle {
  const c = cycleFor(date, paydayRaw);
  return cycleFor(dir === 1 ? addDays(c.end, 1) : addDays(c.start, -1), paydayRaw);
}

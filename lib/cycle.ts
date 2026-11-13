// Siklus gajian. Tanggal = string "YYYY-MM-DD". Tanggal gajian 1 = bulan kalender biasa.
// Bila tanggal gajian lebih besar dari jumlah hari di sebuah bulan (mis. 31 di bulan Februari),
// siklus di bulan itu dimulai pada hari terakhir bulan tersebut.
import { addDays, diffDays } from '@/lib/recurring';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const pad = (n: number) => String(n).padStart(2, '0');
const parts = (d: string) => { const [y, m, day] = d.split('-').map(Number); return { y, m, day }; };
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Nilai payday yang aman: bilangan bulat 1-31, selain itu dianggap 1. */
export function normalizePayday(p: unknown): number {
  const n = Math.round(Number(p));
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : 1;
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

/** Siklus yang memuat tanggal `date`. */
export function cycleFor(date: string, paydayRaw: unknown): Cycle {
  const payday = normalizePayday(paydayRaw);
  const { y, m } = parts(date);
  let start = startInMonth(y, m, payday);
  if (start > date) start = startInMonth(y, m - 1, payday);
  const s = parts(start);
  const nextStart = startInMonth(s.y, s.m + 1, payday);
  const end = addDays(nextStart, -1);
  const e = parts(end);
  const label = payday === 1
    ? `${BULAN[s.m - 1]} ${s.y}`
    : `${s.day} ${BULAN_PENDEK[s.m - 1]} - ${e.day} ${BULAN_PENDEK[e.m - 1]} ${e.y}`;
  return { start, end, label, totalDays: diffDays(start, end) + 1 };
}

/** Siklus sebelumnya (-1) atau berikutnya (+1) dari siklus yang memuat `date`. */
export function shiftCycle(date: string, dir: 1 | -1, paydayRaw: unknown): Cycle {
  const c = cycleFor(date, paydayRaw);
  return cycleFor(dir === 1 ? addDays(c.end, 1) : addDays(c.start, -1), paydayRaw);
}

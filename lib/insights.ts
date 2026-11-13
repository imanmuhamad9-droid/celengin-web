// Perhitungan Laporan & Insight (murni). Tanggal = string "YYYY-MM-DD".
import { addDays, addMonths, dayOfWeek, diffDays, DAY_NAMES } from '@/lib/recurring';
import { cycleFor, shiftCycle } from '@/lib/cycle';

export type Period = 'week' | 'month' | 'year';

export interface Tx {
  id?: string;
  type: string;
  amount: number | string;
  transaction_date: string;
  merchant_name?: string | null;
  notes?: string | null;
  wallet_id?: string | null;
  is_routine?: boolean;
}

export interface RangeInfo { start: string; end: string; label: string; prevStart: string; prevEnd: string; totalDays: number }

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function ymd(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
}
function pad(n: number) { return String(n).padStart(2, '0'); }

export function getRange(period: Period, anchor: string, payday: number = 1): RangeInfo {
  const { y, m, day } = ymd(anchor);
  if (period === 'week') {
    const dow = (new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7; // 0 = Senin
    const start = addDays(anchor, -dow);
    const end = addDays(start, 6);
    const s = ymd(start);
    const e = ymd(end);
    return {
      start, end,
      label: `${s.day} ${BULAN_PENDEK[s.m - 1]} - ${e.day} ${BULAN_PENDEK[e.m - 1]} ${e.y}`,
      prevStart: addDays(start, -7), prevEnd: addDays(start, -1), totalDays: 7,
    };
  }
  if (period === 'month' && payday > 1) {
    // Siklus gajian: mis. 25 Okt - 24 Nov
    const c = cycleFor(anchor, payday);
    const p = shiftCycle(anchor, -1, payday);
    return { start: c.start, end: c.end, label: c.label, prevStart: p.start, prevEnd: p.end, totalDays: c.totalDays };
  }
  if (period === 'month') {
    const start = `${y}-${pad(m)}-01`;
    const nextStart = addMonths(start, 1);
    const end = addDays(nextStart, -1);
    return {
      start, end, label: `${BULAN[m - 1]} ${y}`,
      prevStart: addMonths(start, -1), prevEnd: addDays(start, -1), totalDays: diffDays(start, end) + 1,
    };
  }
  const start = `${y}-01-01`;
  const end = `${y}-12-31`;
  return { start, end, label: `Tahun ${y}`, prevStart: `${y - 1}-01-01`, prevEnd: `${y - 1}-12-31`, totalDays: diffDays(start, end) + 1 };
}

/** Geser anchor satu periode ke depan (+1) / belakang (-1). */
export function shiftAnchor(period: Period, anchor: string, dir: 1 | -1, payday: number = 1): string {
  if (period === 'week') return addDays(anchor, 7 * dir);
  if (period === 'month' && payday > 1) return shiftCycle(anchor, dir, payday).start;
  if (period === 'month') return addMonths(anchor, dir);
  return addMonths(anchor, 12 * dir);
}

const inRange = (t: Tx, a: string, b: string) => t.transaction_date >= a && t.transaction_date <= b;
const sum = (list: Tx[], type: string) => list.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

function groupByCategory(list: Tx[], type: string) {
  const map: Record<string, number> = {};
  list.filter((t) => t.type === type).forEach((t) => {
    const k = t.merchant_name || 'Tanpa kategori';
    map[k] = (map[k] || 0) + Number(t.amount);
  });
  return Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

export interface Summary {
  income: number; expense: number; net: number; savingRate: number; txCount: number;
  activeDays: number; elapsedDays: number; avgDailyExpense: number; projectedExpense: number | null;
  expenseCats: { name: string; amount: number }[];
  incomeCats: { name: string; amount: number }[];
  series: { key: string; label: string; income: number; expense: number }[];
  peakWeekday: { day: string; avg: number } | null;
  biggest: Tx | null;
}

export function summarize(all: Tx[], r: RangeInfo, period: Period, today: string): Summary {
  const list = all.filter((t) => inRange(t, r.start, r.end));
  const income = sum(list, 'income');
  const expense = sum(list, 'expense');
  const elapsedEnd = today < r.end ? (today < r.start ? r.start : today) : r.end;
  const elapsedDays = today < r.start ? 0 : diffDays(r.start, elapsedEnd) + 1;
  const activeDays = new Set(list.map((t) => t.transaction_date)).size;
  const avgDailyExpense = elapsedDays > 0 ? expense / elapsedDays : 0;
  const isOngoing = today >= r.start && today < r.end;

  // Seri grafik: harian (minggu/bulan) atau bulanan (tahun)
  const series: Summary['series'] = [];
  if (period === 'year') {
    for (let m = 1; m <= 12; m++) {
      const prefix = `${r.start.slice(0, 4)}-${pad(m)}`;
      const part = list.filter((t) => t.transaction_date.startsWith(prefix));
      series.push({ key: prefix, label: BULAN_PENDEK[m - 1], income: sum(part, 'income'), expense: sum(part, 'expense') });
    }
  } else {
    for (let i = 0; i < r.totalDays; i++) {
      const d = addDays(r.start, i);
      const part = list.filter((t) => t.transaction_date === d);
      const label = period === 'week' ? DAY_NAMES[dayOfWeek(d)].slice(0, 3) : String(ymd(d).day);
      series.push({ key: d, label, income: sum(part, 'income'), expense: sum(part, 'expense') });
    }
  }

  // Hari dalam seminggu paling boros (rata-rata per hari kejadian)
  const byDow: Record<number, { total: number; days: Set<string> }> = {};
  list.filter((t) => t.type === 'expense').forEach((t) => {
    const dw = dayOfWeek(t.transaction_date);
    byDow[dw] = byDow[dw] || { total: 0, days: new Set() };
    byDow[dw].total += Number(t.amount);
    byDow[dw].days.add(t.transaction_date);
  });
  let peakWeekday: Summary['peakWeekday'] = null;
  Object.entries(byDow).forEach(([k, v]) => {
    const avg = v.total / v.days.size;
    if (!peakWeekday || avg > peakWeekday.avg) peakWeekday = { day: DAY_NAMES[Number(k)], avg };
  });

  const expenses = list.filter((t) => t.type === 'expense');
  const biggest = expenses.length ? expenses.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a)) : null;

  return {
    income, expense, net: income - expense,
    savingRate: income > 0 ? (income - expense) / income : 0,
    txCount: list.length, activeDays, elapsedDays, avgDailyExpense,
    projectedExpense: isOngoing && period !== 'year' && elapsedDays >= 3 ? avgDailyExpense * r.totalDays : null,
    expenseCats: groupByCategory(list, 'expense'),
    incomeCats: groupByCategory(list, 'income'),
    series, peakWeekday, biggest,
  };
}

export function pctChange(now: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((now - prev) / prev) * 100;
}

export interface Health { score: number; label: string; emoji: string; parts: { name: string; got: number; max: number }[] }

/** Skor 0-100: tabungan (50) + tren pengeluaran (20) + konsistensi mencatat (30). */
export function healthScore(cur: Summary, prev: Summary): Health | null {
  if (cur.txCount === 0) return null;
  const savePart = Math.round(Math.max(0, Math.min(1, cur.savingRate / 0.2)) * 50);
  let trendPart = 10;
  if (prev.expense > 0) {
    const ch = (cur.expense - prev.expense) / prev.expense;
    trendPart = ch <= 0 ? 20 : ch <= 0.2 ? 10 : 0;
  }
  const consistency = cur.elapsedDays > 0 ? Math.min(1, cur.activeDays / cur.elapsedDays) : 0;
  const consPart = Math.round(consistency * 30);
  const score = savePart + trendPart + consPart;
  const [label, emoji] = score >= 80 ? ['Sehat', '💪'] : score >= 60 ? ['Cukup Baik', '🙂'] : score >= 40 ? ['Perlu Perhatian', '😅'] : ['Waspada', '🚨'];
  return {
    score, label, emoji,
    parts: [
      { name: 'Tabungan (sisa pemasukan)', got: savePart, max: 50 },
      { name: 'Tren pengeluaran', got: trendPart, max: 20 },
      { name: 'Rajin mencatat', got: consPart, max: 30 },
    ],
  };
}

export interface InsightLine { icon: string; text: string; tone: 'good' | 'warn' | 'info' }

export function buildInsights(cur: Summary, prev: Summary, period: Period, fmt: (n: number) => string): InsightLine[] {
  const out: InsightLine[] = [];
  const noun = period === 'week' ? 'minggu' : period === 'month' ? 'bulan' : 'tahun';
  const ch = pctChange(cur.expense, prev.expense);
  if (ch !== null && cur.expense > 0) {
    const abs = Math.abs(Math.round(ch));
    if (ch > 5) out.push({ icon: '📈', tone: 'warn', text: `Pengeluaran naik ${abs}% dibanding ${noun} lalu.` });
    else if (ch < -5) out.push({ icon: '📉', tone: 'good', text: `Pengeluaran turun ${abs}% dibanding ${noun} lalu. Mantap!` });
    else out.push({ icon: '⚖️', tone: 'info', text: `Pengeluaran stabil dibanding ${noun} lalu.` });
  }
  if (cur.expenseCats.length > 0 && cur.expense > 0) {
    const top = cur.expenseCats[0];
    out.push({ icon: '🏷️', tone: 'info', text: `Terbesar: ${top.name} (${Math.round((top.amount / cur.expense) * 100)}% dari pengeluaran).` });
  }
  if (cur.income > 0) {
    if (cur.net >= 0) {
      out.push({ icon: '💰', tone: cur.savingRate >= 0.2 ? 'good' : 'info', text: `Kamu menyisihkan ${Math.round(cur.savingRate * 100)}% dari pemasukan (${fmt(cur.net)}).` });
    } else {
      out.push({ icon: '⚠️', tone: 'warn', text: `Pengeluaran melebihi pemasukan sebesar ${fmt(-cur.net)}.` });
    }
  }
  if (cur.projectedExpense !== null) {
    out.push({ icon: '🔮', tone: 'info', text: `Dengan laju sekarang, total pengeluaran ${noun} ini sekitar ${fmt(Math.round(cur.projectedExpense))}.` });
  }
  if (cur.peakWeekday && period !== 'week') {
    out.push({ icon: '🗓️', tone: 'info', text: `Hari paling boros: ${cur.peakWeekday.day} (rata-rata ${fmt(Math.round(cur.peakWeekday.avg))}).` });
  }
  if (cur.biggest) {
    out.push({ icon: '🧾', tone: 'info', text: `Pengeluaran tunggal terbesar: ${cur.biggest.merchant_name || 'Tanpa kategori'} ${fmt(Number(cur.biggest.amount))}.` });
  }
  return out;
}

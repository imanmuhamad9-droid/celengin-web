// Hitungan Simulasi yang MURNI (tanpa Supabase). Bulan berbentuk "YYYY-MM", tanggal "YYYY-MM-DD".
// Satu rencana = daftar baris (pemasukan / kewajiban / rencana tabungan) yang jumlahnya bisa berbeda tiap bulan.

export type SimGroup = 'income' | 'duty' | 'plan';

export const GROUP_LABEL: Record<SimGroup, string> = {
  income: 'Pemasukan',
  duty: 'Kewajiban',
  plan: 'Rencana & tabungan',
};

export interface SimRow {
  id: string;
  group: SimGroup;
  label: string;
  /** Jumlah bawaan untuk semua bulan */
  amount: number;
  /** Jumlah khusus per bulan; menimpa `amount` */
  by?: Record<string, number>;
  /** false = tidak ikut dihitung (untuk coba "bagaimana kalau") */
  on: boolean;
  /** Penanda baris yang diisi otomatis dari data aplikasi, supaya mengambil ulang menimpa baris yang sama */
  auto?: string;
}

export interface SimData {
  /** Bulan pertama yang dihitung */
  month: string;
  rows: SimRow[];
}

export interface SimTotals { income: number; duty: number; plan: number; left: number }

export const newRowId = () => Math.random().toString(36).slice(2, 10);

export function addMonthKey(ym: string, n: number): string {
  const idx = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export function daysInMonth(ym: string): number {
  return new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
}

/** Jumlah sebuah baris di bulan ym: nilai khusus bulan itu bila ada, kalau tidak jumlah bawaan. */
export const rowAmount = (row: SimRow, ym: string): number => {
  const v = row.by?.[ym];
  return Math.round(typeof v === 'number' && Number.isFinite(v) ? v : row.amount);
};

export function totalsFor(rows: SimRow[], ym: string): SimTotals {
  const sum = (g: SimGroup) => rows.filter((r) => r.on && r.group === g).reduce((s, r) => s + rowAmount(r, ym), 0);
  const income = sum('income');
  const duty = sum('duty');
  const plan = sum('plan');
  return { income, duty, plan, left: income - duty - plan };
}

/** Sisa dibagi jumlah hari di bulan itu; 0 bila sisanya tidak positif. */
export const perDay = (left: number, ym: string): number => (left > 0 ? Math.floor(left / daysInMonth(ym)) : 0);

export type SimLevel = 'ok' | 'thin' | 'negative';
/** negative = kurang dari nol; thin = kurang dari 10% pemasukan; ok = lainnya. */
export function levelOf(t: SimTotals): SimLevel {
  if (t.left < 0) return 'negative';
  if (t.income > 0 && t.left < t.income * 0.1) return 'thin';
  return 'ok';
}

export function emptyData(month: string): SimData {
  return {
    month,
    rows: [
      { id: newRowId(), group: 'income', label: 'Gaji', amount: 0, on: true },
      { id: newRowId(), group: 'duty', label: 'Cicilan', amount: 0, on: true },
    ],
  };
}

/** Rapikan data mentah dari database: buang baris rusak, isi bawaan yang hilang. */
export function parseSimData(raw: unknown, fallbackMonth: string): SimData {
  const o = (raw && typeof raw === 'object' ? raw : {}) as { month?: unknown; rows?: unknown };
  const month = typeof o.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(o.month) ? o.month : fallbackMonth;
  const rows: SimRow[] = [];
  if (Array.isArray(o.rows)) {
    for (const r of o.rows as Record<string, unknown>[]) {
      if (!r || typeof r !== 'object') continue;
      const group = r.group === 'income' || r.group === 'duty' || r.group === 'plan' ? r.group : null;
      if (!group) continue;
      const by: Record<string, number> = {};
      if (r.by && typeof r.by === 'object') {
        for (const [k, v] of Object.entries(r.by as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) by[k] = v;
      }
      rows.push({
        id: typeof r.id === 'string' ? r.id : newRowId(),
        group,
        label: typeof r.label === 'string' ? r.label : '',
        amount: Number(r.amount) || 0,
        ...(Object.keys(by).length > 0 ? { by } : {}),
        on: r.on !== false,
        ...(typeof r.auto === 'string' ? { auto: r.auto } : {}),
      });
    }
  }
  return { month, rows };
}

// ---- Mengambil angka dari data yang sudah ada di aplikasi ----

const dateParts = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)), day: Number(d.slice(8, 10)) });

/** Berapa kali hari-dalam-minggu dari `anchorDate` muncul di bulan ym. */
function weekdayCountIn(anchorDate: string, ym: string): number {
  const a = dateParts(anchorDate);
  const dow = new Date(Date.UTC(a.y, a.m - 1, a.day)).getUTCDay();
  let n = 0;
  for (let d = 1; d <= daysInMonth(ym); d++) {
    if (new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, d)).getUTCDay() === dow) n++;
  }
  return n;
}

export interface Recurrence {
  amount: number;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** Tanggal acuan: jatuh tempo (tagihan) atau tanggal mulai (transaksi rutin) */
  date: string;
}

/** Berapa yang jatuh di bulan ym. Tahunan dan sekali hanya di bulannya; mingguan = jumlah hari yang sama di bulan itu. */
export function amountIn(r: Recurrence, ym: string): number {
  const amount = Number(r.amount) || 0;
  switch (r.frequency) {
    case 'monthly': return amount;
    case 'daily': return amount * daysInMonth(ym);
    case 'weekly': return amount * weekdayCountIn(r.date, ym);
    case 'yearly': return r.date.slice(5, 7) === ym.slice(5, 7) ? amount : 0;
    case 'once': return r.date.slice(0, 7) === ym ? amount : 0;
  }
}

/** Isi `by` untuk beberapa bulan sekaligus dari satu fungsi. */
export function byMonths(months: string[], fn: (ym: string) => number): Record<string, number> {
  const by: Record<string, number> = {};
  for (const ym of months) by[ym] = fn(ym);
  return by;
}

/** Tambah atau timpa baris otomatis: baris dengan `auto` yang sama diganti, sisanya dibiarkan. */
export function mergeAutoRows(rows: SimRow[], incoming: SimRow[]): SimRow[] {
  const keys = new Set(incoming.map((r) => r.auto).filter(Boolean));
  const kept = rows.filter((r) => !(r.auto && keys.has(r.auto)));
  return [...kept, ...incoming];
}

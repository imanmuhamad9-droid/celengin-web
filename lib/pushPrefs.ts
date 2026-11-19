// Preferensi notifikasi push per jenis. Disimpan di profiles.push_prefs (jsonb), mis. {"daily":false}.
// Kunci yang tidak ada dianggap AKTIF, jadi pengguna lama tetap menerima semuanya sampai mereka mematikannya.

export const PUSH_KINDS = [
  { key: 'bills', label: 'Pengingat tagihan', desc: 'Tagihan yang segera jatuh tempo atau terlambat' },
  { key: 'installments', label: 'Pengingat cicilan', desc: 'Cicilan bucket yang segera jatuh tempo atau terlambat' },
  { key: 'routine', label: 'Transaksi rutin', desc: 'Pemberitahuan saat transaksi rutin tercatat otomatis' },
  { key: 'daily', label: 'Ingatkan catat harian', desc: 'Jika hari ini belum ada transaksi yang dicatat' },
  { key: 'weekly', label: 'Ringkasan mingguan', desc: 'Setiap Senin: total masuk dan keluar minggu lalu' },
  { key: 'gantian', label: 'Hitung Gantian', desc: 'Akhir bulan, bila ada saldo Gantian yang belum impas' },
] as const;

export type PushKind = (typeof PUSH_KINDS)[number]['key'];
export type PushPrefs = Partial<Record<PushKind, boolean>>;

const KINDS = new Set<string>(PUSH_KINDS.map((k) => k.key));

/** Ambil hanya kunci yang dikenal dengan nilai boolean; selain itu diabaikan. */
export function parsePushPrefs(v: unknown): PushPrefs {
  const out: PushPrefs = {};
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v)) {
    if (KINDS.has(k) && typeof val === 'boolean') out[k as PushKind] = val;
  }
  return out;
}

export const wantsPush = (prefs: PushPrefs | undefined, kind: PushKind): boolean => prefs?.[kind] !== false;

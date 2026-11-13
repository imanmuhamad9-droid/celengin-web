export function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Tanggal LOKAL perangkat dalam format YYYY-MM-DD.
 * Jangan pakai toISOString() untuk tanggal: itu UTC, jadi jam 00:00-06:59 WIB
 * hasilnya masih "kemarin".
 * Panggil hanya di dalam useEffect / event handler (aman untuk Next.js 16).
 */
export function toLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Ubah input teks menjadi angka + tampilan berformat Rupiah (id-ID). */
export function parseRupiahInput(value: string): { raw: number; display: string } {
  const digits = value.replace(/\D/g, '');
  if (!digits) return { raw: 0, display: '' };
  const raw = Number(digits);
  return { raw, display: new Intl.NumberFormat('id-ID').format(raw) };
}

/** "2026-11-13" -> "13 Nov 2026" (tanpa efek zona waktu) */
export function formatDateID(dateStr: string, withYear = true): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

// Hari libur nasional dan cuti bersama Indonesia.
// Sumber: SKB 3 Menteri (Menteri Agama, Menteri Ketenagakerjaan, Menteri PANRB).
//   2026: SKB No. 1497/2025, 2/2025, 5/2025 (ditetapkan 19 September 2025)
//   2027: SKB No. 1205/2026, 3/2026, 2/2026 (ditetapkan 15 September 2026)
// PERLU DIPERBARUI SETIAP TAHUN: pemerintah menerbitkan SKB baru sekitar September untuk tahun berikutnya.
// Tahun yang belum tercatat di sini tampil tanpa tanda libur.
export type HolidayKind = 'libur' | 'cuti';
export interface Holiday { date: string; name: string; kind: HolidayKind }

const L = (date: string, name: string): Holiday => ({ date, name, kind: 'libur' });
const C = (date: string, name: string): Holiday => ({ date, name, kind: 'cuti' });

export const HOLIDAYS: Holiday[] = [
  // ---- 2026 ----
  L('2026-01-01', 'Tahun Baru 2026 Masehi'),
  L('2026-01-16', "Isra Mi'raj Nabi Muhammad SAW"),
  C('2026-02-16', 'Cuti Bersama Tahun Baru Imlek'),
  L('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili'),
  C('2026-03-18', 'Cuti Bersama Hari Suci Nyepi'),
  L('2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'),
  C('2026-03-20', 'Cuti Bersama Idulfitri'),
  L('2026-03-21', 'Idulfitri 1447 H'),
  L('2026-03-22', 'Idulfitri 1447 H'),
  C('2026-03-23', 'Cuti Bersama Idulfitri'),
  C('2026-03-24', 'Cuti Bersama Idulfitri'),
  L('2026-04-03', 'Wafat Yesus Kristus (Jumat Agung)'),
  L('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)'),
  L('2026-05-01', 'Hari Buruh Internasional'),
  L('2026-05-14', 'Kenaikan Yesus Kristus'),
  C('2026-05-15', 'Cuti Bersama Kenaikan Yesus Kristus'),
  L('2026-05-27', 'Iduladha 1447 H'),
  C('2026-05-28', 'Cuti Bersama Iduladha'),
  L('2026-05-31', 'Hari Raya Waisak 2570 BE'),
  L('2026-06-01', 'Hari Lahir Pancasila'),
  L('2026-06-16', 'Tahun Baru Islam 1448 H'),
  L('2026-08-17', 'Proklamasi Kemerdekaan RI'),
  L('2026-08-25', 'Maulid Nabi Muhammad SAW'),
  C('2026-12-24', 'Cuti Bersama Natal'),
  L('2026-12-25', 'Hari Raya Natal'),
  // ---- 2027 ----
  L('2027-01-01', 'Tahun Baru 2027 Masehi'),
  L('2027-01-05', 'Isra Mikraj Nabi Muhammad SAW 1448 H'),
  C('2027-02-05', 'Cuti Bersama Tahun Baru Imlek'),
  L('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili'),
  L('2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)'),
  C('2027-03-09', 'Cuti Bersama Idulfitri'),
  L('2027-03-10', 'Idulfitri 1448 H'),
  L('2027-03-11', 'Idulfitri 1448 H'),
  C('2027-03-12', 'Cuti Bersama Idulfitri'),
  C('2027-03-15', 'Cuti Bersama Idulfitri'),
  C('2027-03-25', 'Cuti Bersama Wafat Yesus Kristus'),
  L('2027-03-26', 'Wafat Yesus Kristus (Jumat Agung)'),
  L('2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)'),
  L('2027-05-01', 'Hari Buruh Internasional'),
  L('2027-05-06', 'Kenaikan Yesus Kristus'),
  L('2027-05-17', 'Iduladha 1448 H'),
  C('2027-05-18', 'Cuti Bersama Iduladha'),
  C('2027-05-19', 'Cuti Bersama Waisak'),
  L('2027-05-20', 'Hari Raya Waisak 2571 BE'),
  L('2027-06-01', 'Hari Lahir Pancasila'),
  L('2027-06-06', 'Tahun Baru Islam 1449 H'),
  L('2027-08-15', 'Maulid Nabi Muhammad SAW'),
  L('2027-08-17', 'Proklamasi Kemerdekaan RI'),
  C('2027-12-24', 'Cuti Bersama Natal'),
  L('2027-12-25', 'Hari Raya Natal'),
  L('2027-12-26', 'Isra Mikraj Nabi Muhammad SAW 1449 H'),
];

const BY_DATE: Record<string, Holiday> = {};
HOLIDAYS.forEach((h) => { BY_DATE[h.date] = h; });

export const holidayOn = (dateStr: string): Holiday | undefined => BY_DATE[dateStr];

/** Daftar libur dalam satu bulan (month = 1..12), urut tanggal. */
export const holidaysInMonth = (year: number, month: number): Holiday[] => {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return HOLIDAYS.filter((h) => h.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date));
};

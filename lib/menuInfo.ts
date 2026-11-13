// Penjelasan singkat "menu ini untuk apa?" yang tampil otomatis saat sebuah menu pertama kali dibuka.
// Kuncinya adalah judul di AppHeader. Home sengaja tidak punya. Bayarin / Patungan punya penjelasan sendiri di SplitBoard.
export type MenuInfo = { heading: string; body: string; points?: string[] };

export const MENU_INFO: Record<string, MenuInfo> = {
  Riwayat: {
    heading: 'Riwayat: untuk apa menu ini?',
    body: 'Semua uang masuk dan keluar yang pernah kamu catat ada di sini. Cari, saring, ubah, atau hapus kalau ada yang salah.',
    points: [
      'Tab Laporan: grafik dan ringkasan dari catatan yang sama.',
      'Tab Tagihan: pengingat tagihan dan transaksi rutin.',
    ],
  },
  Laporan: {
    heading: 'Laporan: untuk apa menu ini?',
    body: 'Ringkasan ke mana uangmu pergi, per minggu, bulan, atau siklus gajian. Bisa diunduh sebagai PDF atau Excel.',
  },
  Tagihan: {
    heading: 'Tagihan: untuk apa menu ini?',
    body: 'Pengingat supaya tidak ada tagihan yang telat. Catat tagihan atau langganan bulananmu sekali, lalu kamu diingatkan sebelum jatuh tempo (di Home dan lewat notifikasi).',
    points: [
      'Tekan Tandai Lunas: pembayarannya langsung masuk sebagai pengeluaran, dan jatuh tempo berikutnya otomatis dijadwalkan.',
      'Transaksi Rutin (gaji, langganan, cicilan) yang tercatat otomatis juga diatur dari sini.',
    ],
  },
  Tantangan: {
    heading: 'Tantangan: untuk apa menu ini?',
    body: 'Untuk menahan pengeluaran. Pasang batas uang masuk dan keluar dalam periode tertentu, lalu pantau apakah kamu masih aman. Beda dengan Impian yang untuk mengumpulkan uang membeli sesuatu.',
  },
  Impian: {
    heading: 'Impian: untuk apa menu ini?',
    body: 'Untuk menabung membeli sesuatu: HP baru, liburan, dana darurat. Buat satu impian, isi tabunganmu bertahap, dan lihat progresnya. Ketuk kartu untuk melihat riwayat isinya.',
  },
  Bareng: {
    heading: 'Bareng: untuk apa menu ini?',
    body: 'Untuk urusan uang bersama orang lain. Ada dua tab: Nabung Bareng (target tabungan bersama pasangan, teman, atau grup) dan Patungan & Bayarin (membagi tagihan dan mencatat utang-piutang).',
  },
  Pencapaian: {
    heading: 'Pencapaian: untuk apa menu ini?',
    body: 'Badge bonus karena kamu rajin mencatat dan menabung. Tidak wajib, hanya untuk seru-seruan.',
  },
  Pengaturan: {
    heading: 'Pengaturan: untuk apa menu ini?',
    body: 'Tempat mengatur akunmu: profil dan foto, password, tanggal gajian, tampilan, notifikasi, dan transaksi rutin.',
  },
};

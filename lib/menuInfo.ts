// Penjelasan singkat "menu ini untuk apa?" yang tampil otomatis saat sebuah menu pertama kali dibuka.
// Kuncinya adalah judul di AppHeader. Home sengaja tidak punya. Bayarin / Patungan punya penjelasan sendiri di SplitBoard.
export type MenuInfo = { heading: string; body: string; points?: string[] };

export const MENU_INFO: Record<string, MenuInfo> = {
  Riwayat: {
    heading: 'Riwayat: untuk apa menu ini?',
    body: 'Semua uang masuk dan keluar yang pernah kamu catat ada di sini. Cari, saring, ubah, atau hapus kalau ada yang salah.',
    points: [
      'Menu Laporan punya tiga tab: Tagihan, Riwayat, dan Laporan.',
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
      'Transaksi Rutin (gaji, langganan, cicilan) yang tercatat otomatis diatur di Pengaturan.',
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
  Kolektif: {
    heading: 'Kolektif: untuk apa menu ini?',
    body: 'Untuk urusan uang bersama orang lain. Ada tiga pilihan di bagian atas: Nabung Bareng, Patungan, dan Bayarin.',
  },
  'Nabung Bareng': {
    heading: 'Nabung Bareng: untuk apa menu ini?',
    body: 'Target tabungan bersama. Pilih Pasangan (hanya kamu dan satu orang) atau Teman (boleh banyak orang). Catat uang masuk atau keluar, dan lihat kurang berapa lagi sampai target. Tekan ⓘ di kartu untuk perkiraan berapa yang perlu disisihkan.',
  },
  Patungan: {
    heading: 'Patungan: untuk apa menu ini?',
    body: 'Patungan tanpa ribet. Isi tiap pesanan, pajak, dan diskon dari struk, lalu pilih siapa memakai apa. Celengin menghitung bagian tiap orang dan siapa harus transfer ke siapa. Teman bisa ditulis namanya saja, atau diundang lewat email agar melihat grup yang sama dari akunnya.',
  },
  Bayarin: {
    heading: 'Bayarin: untuk apa menu ini?',
    body: 'Untuk adik, teman, atau pasangan yang sering saling membayarkan dan baru hitung-hitungan belakangan. Catat siapa yang bayar dan untuk siapa. Saldonya otomatis saling mengurangi, jadi tinggal satu angka: siapa bayar ke siapa.',
    points: [
      'Catat satu barang, atau banyak barang dari satu struk (bisa scan struk).',
      'Sudah bayar? Tekan Lunas, atau Bayar sebagian. Semuanya tercatat di riwayat lengkap dengan tanggalnya.',
      'Berdiri sendiri: tidak mengubah transaksi atau saldo.',
    ],
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

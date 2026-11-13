// Membuat ikon PWA dengan ukuran yang benar dari public/icon.png.
// Jalankan SEKALI dari folder proyek:  node scripts/generate-icons.mjs
// Memakai `sharp` (sudah ikut terpasang bersama Next.js).
import sharp from 'sharp';
import { existsSync } from 'node:fs';

const SRC = 'public/icon.png';
if (!existsSync(SRC)) {
  console.error('public/icon.png tidak ditemukan. Jalankan perintah ini dari folder utama proyek.');
  process.exit(1);
}

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

for (const size of [192, 512]) {
  await sharp(SRC).resize(size, size, { fit: 'contain', background: transparent }).png().toFile(`public/icon-${size}.png`);
  console.log(`public/icon-${size}.png dibuat`);
}

// Ikon maskable: latar tosca + logo di zona aman (70%)
const inner = await sharp(SRC).resize(358, 358, { fit: 'contain', background: transparent }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0f766e' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile('public/icon-maskable-512.png');
console.log('public/icon-maskable-512.png dibuat');

import type { MetadataRoute } from 'next';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Kalau ikon hasil `node scripts/generate-icons.mjs` sudah ada, pakai itu (ukuran benar + maskable).
// Kalau belum, tetap jalan dengan /icon.png seperti sebelumnya.
export default function manifest(): MetadataRoute.Manifest {
  const pub = join(process.cwd(), 'public');
  const hasGenerated = existsSync(join(pub, 'icon-192.png')) && existsSync(join(pub, 'icon-512.png'));
  const hasMaskable = existsSync(join(pub, 'icon-maskable-512.png'));

  const icons: MetadataRoute.Manifest['icons'] = hasGenerated
    ? [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ...(hasMaskable ? [{ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' as const }] : []),
      ]
    : [
        { src: '/icon.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon.png', sizes: '512x512', type: 'image/png' },
      ];

  return {
    id: '/dashboard',
    name: 'Celengin - Financial Tracker',
    short_name: 'Celengin',
    description: 'Aplikasi pencatat keuangan Gen Z.',
    lang: 'id',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#faf8ff',
    theme_color: '#0f766e',
    categories: ['finance', 'productivity'],
    icons,
    shortcuts: [
      { name: 'Tagihan', url: '/bills', icons: [{ src: hasGenerated ? '/icon-192.png' : '/icon.png', sizes: '192x192' }] },
      { name: 'Laporan', url: '/reports', icons: [{ src: hasGenerated ? '/icon-192.png' : '/icon.png', sizes: '192x192' }] },
    ],
  };
}

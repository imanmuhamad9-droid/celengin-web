import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Celengin - Financial Tracker',
    short_name: 'Celengin',
    description: 'Aplikasi pencatat keuangan Gen Z.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#faf8ff',
    theme_color: '#0f766e',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
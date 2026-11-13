'use client';
import { useEffect } from 'react';

// Mendaftarkan service worker (sekali, di layout). Tidak menampilkan apa pun.
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}

'use client';
import { useEffect } from 'react';

// Saat app (PWA di layar utama) kembali dibuka setelah ditinggal di latar belakang cukup lama,
// muat ulang halaman supaya datanya terbaru. Ditunda bila kamu sedang mengetik di kolom isian.
const MIN_HIDDEN_MS = 30 * 1000;

export default function AutoRefresh() {
  useEffect(() => {
    let hiddenAt: number | null = null;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt === null) return;
      const away = Date.now() - hiddenAt;
      hiddenAt = null;
      if (away < MIN_HIDDEN_MS) return;
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
      if (typing) return;
      window.location.reload();
    };

    // Halaman yang dipulihkan dari cache (bfcache) saat app dibuka lagi.
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
  return null;
}

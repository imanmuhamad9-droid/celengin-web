'use client';
import { useEffect } from 'react';
import BgArt from '@/components/BgArt';
import { BgSettings, useBgSettings, useCustomBg, useIsDark } from '@/lib/appBackground';

/** Satu lapisan latar (gambar + kecerahan + lapisan gelap). Dipakai di layar penuh dan pratinjau Pengaturan. */
export function BgLayer({ settings, customUrl, dark, className = 'absolute inset-0' }: { settings: BgSettings; customUrl: string; dark: boolean; className?: string }) {
  const { theme, brightness, darkness } = settings;
  if (theme === 'none' || (theme === 'custom' && !customUrl)) return null;
  return (
    <div className={`${className} overflow-hidden pointer-events-none`} aria-hidden="true">
      <div className="absolute inset-0" style={{ filter: brightness !== 100 ? `brightness(${brightness}%)` : undefined }}>
        {theme === 'custom'
          ? <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${customUrl}")` }} />
          : <BgArt theme={theme} dark={dark} />}
      </div>
      {darkness > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: darkness / 100 }} />}
    </div>
  );
}

// Latar penuh di belakang semua halaman. Ditaruh di layout root, selebar kolom aplikasi (max-w-md).
export default function AppBackground() {
  const settings = useBgSettings();
  const customUrl = useCustomBg();
  const dark = useIsDark();
  const active = settings.theme !== 'none' && !(settings.theme === 'custom' && !customUrl);

  // Atribut data-bg membuat latar polos halaman menjadi transparan (globals.css)
  useEffect(() => {
    const el = document.documentElement;
    if (active) el.setAttribute('data-bg', settings.theme);
    else el.removeAttribute('data-bg');
  }, [active, settings.theme]);

  if (!active) return null;
  return <BgLayer settings={settings} customUrl={customUrl} dark={dark} className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md -z-10" />;
}

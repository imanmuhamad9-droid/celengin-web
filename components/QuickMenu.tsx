'use client';
import { useRouter } from 'next/navigation';
import { EXTRA_MENUS, useExtraMenus, type ExtraMenuKey } from '@/lib/menuSettings';

// Tiap menu = kotak sendiri dengan ikon berwarna; deretan kotak bisa digeser ke samping.
const TONES: Record<ExtraMenuKey, { bg: string; fg: string }> = {
  riwayat: { bg: 'rgba(14,165,233,0.16)', fg: '#0284c7' },
  laporan: { bg: 'rgba(168,85,247,0.16)', fg: '#9333ea' },
  tagihan: { bg: 'rgba(244,63,94,0.16)', fg: '#e11d48' },
  tantangan: { bg: 'rgba(249,115,22,0.18)', fg: '#ea580c' },
  pencapaian: { bg: 'rgba(234,179,8,0.20)', fg: '#ca8a04' },
  darurat: { bg: 'rgba(239,68,68,0.16)', fg: '#dc2626' },
  anggaran: { bg: 'rgba(34,197,94,0.16)', fg: '#16a34a' },
  kekayaan: { bg: 'rgba(20,184,166,0.18)', fg: '#0d9488' },
  kolektif: { bg: 'rgba(99,102,241,0.16)', fg: '#4f46e5' },
};

export default function QuickMenu() {
  const router = useRouter();
  const extras = useExtraMenus();
  const items = EXTRA_MENUS.filter((m) => extras.includes(m.key));
  if (items.length === 0) return null;

  return (
    <nav aria-label="Menu cepat" className="-mx-5">
      <div className="flex gap-2.5 overflow-x-auto px-5 py-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((m) => {
          const t = TONES[m.key];
          return (
            <button
              key={m.key}
              onClick={() => router.push(m.href)}
              className="glass glass-pressable snap-start shrink-0 w-[84px] flex flex-col items-center gap-2 pt-3.5 pb-3 rounded-3xl"
            >
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: t.bg, color: t.fg }}>
                <m.Icon className="w-6 h-6" />
              </span>
              <span className="text-[11px] font-bold leading-tight text-center px-1 line-clamp-2" style={{ color: 'var(--text-main)' }}>{m.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

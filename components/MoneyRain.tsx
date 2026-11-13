'use client';
import { useEffect, useState } from 'react';

interface Particle { id: number; emoji: string; left: number; size: number; delay: number; duration: number; spin: number; drift: number }

const POOL_IN = ['💰', '💵', '🪙', '💵', '💰'];
const POOL_OUT = ['💸', '💸', '🪙', '💸'];
export const MONEY_RAIN_EVENT = 'celengin:money-rain';

/** Panggil dari mana saja (event handler) untuk memicu hujan uang. */
export function triggerMoneyRain(kind: 'income' | 'expense' | 'mixed' = 'income') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MONEY_RAIN_EVENT, { detail: { kind } }));
}

/**
 * Animasi uang turun saat transaksi berhasil dicatat.
 * Dipasang sekali di app/layout.tsx, mendengarkan event global.
 */
export default function MoneyRain() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    let counter = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onRain = (e: Event) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const kind = (e as CustomEvent).detail?.kind as 'income' | 'expense' | 'mixed' | undefined;
      const pool = kind === 'expense' ? POOL_OUT : kind === 'mixed' ? [...POOL_IN, ...POOL_OUT] : POOL_IN;
      const batch: Particle[] = Array.from({ length: 28 }, () => ({
        id: ++counter,
        emoji: pool[Math.floor(Math.random() * pool.length)],
        left: Math.random() * 100,
        size: 20 + Math.random() * 18,
        delay: Math.random() * 0.9,
        duration: 1.8 + Math.random() * 1.2,
        spin: (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 360),
        drift: (Math.random() - 0.5) * 80,
      }));
      setParticles(batch);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setParticles([]), 3600);
    };

    window.addEventListener(MONEY_RAIN_EVENT, onRain);
    return () => { window.removeEventListener(MONEY_RAIN_EVENT, onRain); if (timer) clearTimeout(timer); };
  }, []);

  if (particles.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <style>{`
        @keyframes celengin-fall {
          0%   { transform: translate3d(0, -12vh, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(var(--drift), 110vh, 0) rotate(var(--spin)); opacity: 1; }
        }
      `}</style>
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            fontSize: p.size,
            lineHeight: 1,
            opacity: 0,
            ['--spin' as string]: `${p.spin}deg`,
            ['--drift' as string]: `${p.drift}px`,
            animation: `celengin-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

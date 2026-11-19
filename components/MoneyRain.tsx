'use client';
import { useEffect, useState } from 'react';
import { formatRupiah } from '@/lib/utils';

type Kind = 'income' | 'expense' | 'mixed';
interface Particle { id: number; emoji: string; anim: 'burst' | 'fly' | 'tear'; left: number; top: number; size: number; delay: number; duration: number; spin: number; dx: number; peak: number }
interface Show { key: number; kind: Kind; amount?: number; particles: Particle[]; still: boolean }

export const MONEY_RAIN_EVENT = 'celengin:money-rain';

/**
 * Panggil dari event handler setelah transaksi tersimpan.
 * - income: kembang api uang, semburan koin ke atas lalu jatuh, kilau emas, lencana hijau "+Rp"
 * - expense: uang bersayap melayang pergi, air mata jatuh pelan, tepi layar memerah, lencana merah "-Rp"
 * - mixed: keduanya (tanpa lencana)
 * `amount` opsional, ditampilkan di lencana.
 */
export function triggerMoneyRain(kind: Kind = 'income', amount?: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MONEY_RAIN_EVENT, { detail: { kind, amount } }));
}

const IN_EMOJI = ['💰', '🪙', '💵', '🤑', '🎉', '✨', '🪙'];
const OUT_FLY = ['💸', '💸', '💸', '🪙'];
const OUT_TEAR = ['😢', '💧', '😭'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function makeParticles(kind: Kind, startId: number): Particle[] {
  let id = startId;
  const out: Particle[] = [];
  if (kind === 'income' || kind === 'mixed') {
    // Semburan dari bawah-tengah, menyebar seperti kipas
    for (let i = 0; i < 30; i++) {
      out.push({
        id: ++id, emoji: pick(IN_EMOJI), anim: 'burst', left: 50, top: 82,
        size: rand(22, 38), delay: rand(0, 0.35), duration: rand(1.9, 2.6),
        spin: (Math.random() > 0.5 ? 1 : -1) * rand(180, 540),
        dx: rand(-46, 46) * (typeof window !== 'undefined' ? window.innerWidth / 100 : 4), // px
        peak: rand(32, 62), // vh naik
      });
    }
  }
  if (kind === 'expense' || kind === 'mixed') {
    // Uang melayang pergi ke atas, dan beberapa air mata jatuh pelan
    for (let i = 0; i < 18; i++) {
      out.push({
        id: ++id, emoji: pick(OUT_FLY), anim: 'fly', left: rand(10, 90), top: rand(50, 80),
        size: rand(24, 40), delay: rand(0, 0.8), duration: rand(2.2, 3.2),
        spin: 0, dx: rand(-60, 90), peak: 0,
      });
    }
    for (let i = 0; i < 7; i++) {
      out.push({
        id: ++id, emoji: pick(OUT_TEAR), anim: 'tear', left: rand(8, 92), top: -6,
        size: rand(16, 24), delay: rand(0.2, 1.4), duration: rand(2.6, 3.6),
        spin: 0, dx: rand(-14, 14), peak: 0,
      });
    }
  }
  return out;
}

/**
 * Animasi saat transaksi berhasil dicatat. Dipasang sekali di app/layout.tsx.
 * Dengan "kurangi gerakan" aktif, hanya lencana statis yang tampil sebentar.
 */
export default function MoneyRain() {
  const [show, setShow] = useState<Show | null>(null);

  useEffect(() => {
    let counter = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onRain = (e: Event) => {
      const d = (e as CustomEvent).detail as { kind?: Kind; amount?: number } | undefined;
      const kind: Kind = d?.kind === 'expense' || d?.kind === 'mixed' ? d.kind : 'income';
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      counter += 100;
      setShow({ key: counter, kind, amount: d?.amount, particles: still ? [] : makeParticles(kind, counter), still });
      // Getar singkat di HP: dua ketukan ringan = senang, satu ketukan panjang = rugi
      if (!still && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(kind === 'expense' ? [70] : [18, 50, 18]); } catch { /* tidak didukung */ }
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShow(null), still ? 1800 : 4200);
    };

    window.addEventListener(MONEY_RAIN_EVENT, onRain);
    return () => { window.removeEventListener(MONEY_RAIN_EVENT, onRain); if (timer) clearTimeout(timer); };
  }, []);

  if (!show) return null;
  const { kind, amount, particles, still } = show;
  const hasIn = kind === 'income' || kind === 'mixed';
  const hasOut = kind === 'expense' || kind === 'mixed';
  const badgeKind = kind === 'mixed' ? null : kind;
  const showAmount = typeof amount === 'number' && amount > 0;

  return (
    <div aria-hidden={!badgeKind} className="pointer-events-none fixed inset-0 z-[110] overflow-hidden">
      <style>{`
        @keyframes cg-burst {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg) scale(.4); opacity: 0; animation-timing-function: ease-out; }
          12%  { opacity: 1; }
          42%  { transform: translate3d(calc(var(--dx) * .6), calc(var(--peak) * -1vh), 0) rotate(calc(var(--spin) * .5)) scale(1); animation-timing-function: ease-in; }
          100% { transform: translate3d(var(--dx), 26vh, 0) rotate(var(--spin)) scale(.9); opacity: 0; }
        }
        @keyframes cg-fly {
          0%   { transform: translate3d(0, 0, 0) rotate(-8deg) scale(1); opacity: 0; }
          15%  { opacity: 1; }
          50%  { transform: translate3d(calc(var(--dx) * .4), -22vh, 0) rotate(10deg) scale(.9); }
          100% { transform: translate3d(var(--dx), -58vh, 0) rotate(-16deg) scale(.45); opacity: 0; }
        }
        @keyframes cg-tear {
          0%   { transform: translate3d(0, 0, 0); opacity: 0; }
          12%  { opacity: .9; }
          50%  { transform: translate3d(var(--dx), 52vh, 0); }
          100% { transform: translate3d(calc(var(--dx) * -1), 112vh, 0); opacity: .9; }
        }
        @keyframes cg-glow-in {
          0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; }
        }
        @keyframes cg-vignette {
          0% { opacity: 0; } 18% { opacity: 1; } 45% { opacity: .55; } 62% { opacity: .95; } 100% { opacity: 0; }
        }
        @keyframes cg-pop {
          0%   { transform: translate(-50%, 24px) scale(.3); opacity: 0; }
          18%  { transform: translate(-50%, 0) scale(1.18); opacity: 1; }
          30%  { transform: translate(-50%, 0) scale(.96); }
          42%  { transform: translate(-50%, 0) scale(1.04); }
          55%  { transform: translate(-50%, 0) scale(1); }
          85%  { transform: translate(-50%, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -26px) scale(.95); opacity: 0; }
        }
        @keyframes cg-sink {
          0%   { transform: translate(-50%, -30px) scale(1.12); opacity: 0; }
          14%  { transform: translate(-50%, 0) scale(1); opacity: 1; }
          22%  { transform: translate(calc(-50% - 7px), 0) scale(1); }
          30%  { transform: translate(calc(-50% + 7px), 0) scale(1); }
          38%  { transform: translate(calc(-50% - 4px), 0) scale(1); }
          46%  { transform: translate(-50%, 0) scale(1); }
          82%  { transform: translate(-50%, 6px) scale(.98); opacity: 1; }
          100% { transform: translate(-50%, 34px) scale(.92); opacity: 0; }
        }
        @keyframes cg-still { 0% { opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>

      {/* Latar: kilau emas-hijau dari bawah (masuk) / tepi layar memerah (keluar) */}
      {hasIn && !still && (
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 100%, rgba(250,204,21,.42) 0%, rgba(34,197,94,.22) 38%, transparent 70%)',
          animation: 'cg-glow-in 1.8s ease-out forwards',
        }} />
      )}
      {hasOut && !still && (
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 45%, transparent 38%, rgba(220,38,38,.34) 100%)',
          animation: 'cg-vignette 2.6s ease-in-out forwards',
        }} />
      )}

      {particles.map((p) => {
        const common = { position: 'absolute' as const, left: `${p.left}%`, top: `${p.top}%`, fontSize: p.size, lineHeight: 1, opacity: 0 };
        const vars = { ['--spin' as string]: `${p.spin}deg`, ['--dx' as string]: `${p.dx}px`, ['--peak' as string]: `${p.peak}` };
        const name = p.anim === 'burst' ? 'cg-burst' : p.anim === 'fly' ? 'cg-fly' : 'cg-tear';
        const ease = p.anim === 'tear' ? 'ease-in-out' : 'linear';
        return (
          <span key={p.id} style={{ ...common, ...vars, animation: `${name} ${p.duration}s ${ease} ${p.delay}s forwards` }}>{p.emoji}</span>
        );
      })}

      {/* Lencana tengah: hijau ceria memantul (masuk) / merah yang bergetar lalu tenggelam (keluar) */}
      {badgeKind && (
        <div role="status" aria-live="polite" className="absolute left-1/2 top-[30%]" style={{
          animation: still ? 'cg-still 1.8s ease forwards' : `${badgeKind === 'income' ? 'cg-pop 3s' : 'cg-sink 3s'} ease-out forwards`,
          transform: 'translate(-50%, 0)',
        }}>
          <div className={`flex items-center gap-3 rounded-3xl px-5 py-3 shadow-2xl text-white ${badgeKind === 'income' ? 'bg-gradient-to-br from-emerald-400 to-green-600 ring-4 ring-yellow-300/70' : 'bg-gradient-to-br from-rose-500 to-red-700 ring-4 ring-red-900/30'}`}>
            <span className="text-4xl leading-none">{badgeKind === 'income' ? '🤑' : '😭'}</span>
            <span className="leading-tight">
              <span className="block text-[11px] font-bold uppercase tracking-wider opacity-90">{badgeKind === 'income' ? 'Uang masuk!' : 'Yah, uang keluar'}</span>
              {showAmount && <span className="block text-xl font-extrabold">{badgeKind === 'income' ? '+' : '−'}{formatRupiah(amount as number)}</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

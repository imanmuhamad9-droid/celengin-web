// Gambar untuk tema latar bawaan. Semua digambar dengan SVG (tanpa file gambar), punya versi terang dan gelap,
// dan memakai preserveAspectRatio="slice" supaya selalu menutup layar penuh di ukuran HP mana pun.
import { useId } from 'react';
import type { BgThemeKey } from '@/lib/appBackground';

const W = 400, H = 860;

// Acak yang selalu sama (posisi bintang/konfeti tidak berubah tiap render)
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Sky({ id, stops }: { id: string; stops: string[] }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
          {stops.map((c, i) => <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />)}
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
    </>
  );
}

function Stars({ seed, n, color, max = 2.2 }: { seed: number; n: number; color: string; max?: number }) {
  const r = rng(seed);
  return (
    <g fill={color}>
      {Array.from({ length: n }, (_, i) => <circle key={i} cx={r() * W} cy={r() * H} r={0.5 + r() * max} opacity={0.35 + r() * 0.65} />)}
    </g>
  );
}

function Sparkle({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return <path d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`} fill={color} />;
}

function Cloud({ x, y, s, fill, shade }: { x: number; y: number; s: number; fill: string; shade?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {shade && <ellipse cx="0" cy="18" rx="62" ry="10" fill={shade} />}
      <g fill={fill}>
        <circle cx="-34" cy="0" r="22" />
        <circle cx="-6" cy="-16" r="30" />
        <circle cx="26" cy="-6" r="24" />
        <circle cx="46" cy="6" r="16" />
        <rect x="-56" y="0" width="118" height="22" rx="11" />
      </g>
    </g>
  );
}

function Leaf({ x, y, s, rot, fill, vein }: { x: number; y: number; s: number; rot: number; fill: string; vein: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0 0C30-40 90-50 140-20C110 20 50 40 0 0Z" fill={fill} />
      <path d="M0 0C45-12 95-18 140-20" stroke={vein} strokeWidth="3" fill="none" strokeLinecap="round" />
      {[30, 60, 90].map((t) => <path key={t} d={`M${t} ${-t * 0.13}L${t + 18} ${-t * 0.13 - 22}M${t} ${-t * 0.13}L${t + 16} ${-t * 0.13 + 16}`} stroke={vein} strokeWidth="2" strokeLinecap="round" />)}
    </g>
  );
}

function Monstera({ x, y, s, rot, fill, vein }: { x: number; y: number; s: number; rot: number; fill: string; vein: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0 0C-70-10-110-80-90-150C-60-210 20-220 70-180C120-140 110-50 60-10C40 5 20 5 0 0Z" fill={fill} />
      <g stroke={vein} strokeWidth="9" strokeLinecap="round">
        <path d="M-78-60L-30-60" /><path d="M-86-120L-28-100" /><path d="M-40-188L-10-130" />
        <path d="M40-190L20-130" /><path d="M96-120L40-95" /><path d="M86-50L36-55" />
      </g>
      <path d="M0 0C5-60 0-120-5-170" stroke={vein} strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Piggy({ x, y, s, flip, body, dark, coin }: { x: number; y: number; s: number; flip?: boolean; body: string; dark: string; coin: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <circle cx="0" cy="-62" r="14" fill={coin} stroke={dark} strokeWidth="3" />
      <rect x="-4" y="-69" width="8" height="14" rx="2" fill={dark} opacity="0.35" />
      <rect x="-30" y="22" width="16" height="22" rx="7" fill={body} stroke={dark} strokeWidth="3" />
      <rect x="18" y="22" width="16" height="22" rx="7" fill={body} stroke={dark} strokeWidth="3" />
      <ellipse cx="0" cy="0" rx="58" ry="44" fill={body} stroke={dark} strokeWidth="3" />
      <path d="M-30-34L-22-56L-6-40Z" fill={body} stroke={dark} strokeWidth="3" strokeLinejoin="round" />
      <rect x="-14" y="-44" width="30" height="7" rx="3.5" fill={dark} />
      <ellipse cx="56" cy="4" rx="14" ry="12" fill={body} stroke={dark} strokeWidth="3" />
      <circle cx="52" cy="3" r="2.5" fill={dark} /><circle cx="60" cy="3" r="2.5" fill={dark} />
      <circle cx="30" cy="-14" r="4.5" fill={dark} />
      <ellipse cx="24" cy="8" rx="7" ry="4" fill="#fb7185" opacity="0.5" />
      <path d="M-58-4C-72-8-70-24-60-20C-52-16-64-6-74-12" stroke={dark} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Coin({ x, y, r, face, edge, label }: { x: number; y: number; r: number; face: string; edge: string; label: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={face} stroke={edge} strokeWidth={r * 0.14} />
      <circle r={r * 0.68} fill="none" stroke={edge} strokeWidth={r * 0.07} opacity="0.6" />
      <text y={r * 0.25} textAnchor="middle" fontSize={r * 0.7} fontWeight="800" fill={edge} fontFamily="system-ui, sans-serif">{label}</text>
    </g>
  );
}

function Planet({ x, y, r, fill, ring, band, tilt = -18 }: { x: number; y: number; r: number; fill: string; ring?: string; band?: string; tilt?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      {ring && <ellipse rx={r * 1.75} ry={r * 0.42} fill="none" stroke={ring} strokeWidth={r * 0.16} />}
      <circle r={r} fill={fill} />
      {band && <path d={`M${-r} ${-r * 0.15}Q0 ${r * 0.15} ${r} ${-r * 0.15}L${r * 0.95} ${r * 0.25}Q0 ${r * 0.55} ${-r * 0.95} ${r * 0.25}Z`} fill={band} />}
      {ring && <path d={`M${-r * 1.75} 0A${r * 1.75} ${r * 0.42} 0 0 0 ${r * 1.75} 0`} fill="none" stroke={ring} strokeWidth={r * 0.16} />}
      <circle cx={-r * 0.35} cy={-r * 0.4} r={r * 0.18} fill="#fff" opacity="0.35" />
    </g>
  );
}

function Rocket({ x, y, s, rot, body, accent, window: win }: { x: number; y: number; s: number; rot: number; body: string; accent: string; window: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M-10 40Q0 80 10 40Z" fill="#fbbf24" />
      <path d="M-6 40Q0 64 6 40Z" fill="#f97316" />
      <path d="M-18 20L-34 44L-14 38Z" fill={accent} />
      <path d="M18 20L34 44L14 38Z" fill={accent} />
      <path d="M0-50C22-30 22 10 16 40L-16 40C-22 10-22-30 0-50Z" fill={body} />
      <path d="M0-50C10-41 15-32 17-22L-17-22C-15-32-10-41 0-50Z" fill={accent} />
      <circle cy="-2" r="9" fill={win} stroke={accent} strokeWidth="4" />
    </g>
  );
}

export default function BgArt({ theme, dark }: { theme: BgThemeKey; dark: boolean }) {
  const uid = useId().replace(/:/g, '');
  const g = (n: string) => `${uid}-${n}`;

  let body: React.ReactNode = null;

  switch (theme) {
    case 'bintang': {
      body = (
        <>
          <Sky id={g('sky')} stops={dark ? ['#070b1f', '#151a46', '#2b2569'] : ['#c7d2fe', '#ddd6fe', '#fbcfe8']} />
          <Stars seed={7} n={140} color={dark ? '#ffffff' : '#ffffff'} />
          {[[70, 120, 10], [320, 210, 8], [200, 420, 7], [60, 560, 9], [340, 640, 11], [150, 780, 7]].map(([x, y, s], i) => (
            <Sparkle key={i} x={x} y={y} s={s} color={dark ? '#fde68a' : '#fef9c3'} />
          ))}
          <g transform="translate(305 105)">
            <circle r="44" fill={dark ? '#fef3c7' : '#fffbeb'} opacity="0.25" />
            <circle r="32" fill={dark ? '#fde68a' : '#fef3c7'} />
            <circle cx="14" cy="-8" r="28" fill={dark ? '#0a0f29' : '#c9d0fd'} />
          </g>
          <path d={`M0 ${H}L0 760Q100 720 200 760T400 740L400 ${H}Z`} fill={dark ? '#0b0f2a' : '#a5b4fc'} opacity="0.6" />
        </>
      );
      break;
    }
    case 'gelembung': {
      const r = rng(21);
      body = (
        <>
          <Sky id={g('sky')} stops={dark ? ['#06202e', '#0b2f45', '#0f172a'] : ['#e0f2fe', '#ecfeff', '#f0fdfa']} />
          {Array.from({ length: 26 }, (_, i) => {
            const cx = r() * W, cy = r() * H, rad = 10 + r() * 48;
            const hue = ['#38bdf8', '#2dd4bf', '#a78bfa', '#f472b6'][i % 4];
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={rad} fill={hue} opacity={dark ? 0.12 : 0.14} stroke={hue} strokeOpacity={dark ? 0.55 : 0.5} strokeWidth="2" />
                <path d={`M${cx - rad * 0.55} ${cy - rad * 0.2}A${rad * 0.6} ${rad * 0.6} 0 0 1 ${cx - rad * 0.1} ${cy - rad * 0.6}`} stroke="#fff" strokeOpacity="0.8" strokeWidth={Math.max(2, rad * 0.1)} fill="none" strokeLinecap="round" />
              </g>
            );
          })}
        </>
      );
      break;
    }
    case 'aurora': {
      const blobs = dark
        ? [['#10b981', 80, 160, 190, 0.55], ['#06b6d4', 330, 300, 170, 0.45], ['#8b5cf6', 120, 520, 210, 0.45], ['#ec4899', 340, 700, 160, 0.35], ['#22d3ee', 60, 800, 150, 0.3]]
        : [['#6ee7b7', 80, 160, 190, 0.6], ['#67e8f9', 330, 300, 170, 0.55], ['#c4b5fd', 120, 520, 210, 0.6], ['#f9a8d4', 340, 700, 160, 0.5], ['#a5f3fc', 60, 800, 150, 0.45]];
      body = (
        <>
          <defs><filter id={g('blur')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="55" /></filter></defs>
          <rect width={W} height={H} fill={dark ? '#030712' : '#f8fafc'} />
          <g filter={`url(#${g('blur')})`}>
            {blobs.map(([c, x, y, rad, o], i) => <ellipse key={i} cx={x as number} cy={y as number} rx={rad as number} ry={(rad as number) * 0.7} fill={c as string} opacity={o as number} transform={`rotate(${i * 25 - 20} ${x} ${y})`} />)}
            <path d="M-40 360C80 300 160 420 260 340S420 300 460 330L460 400C400 380 340 440 240 420S60 360-40 430Z" fill={dark ? '#34d399' : '#99f6e4'} opacity={dark ? 0.5 : 0.7} />
          </g>
          {dark && <Stars seed={3} n={60} color="#fff" max={1.2} />}
        </>
      );
      break;
    }
    case 'gelombang': {
      const c = dark ? ['#042f2e', '#134e4a', '#115e59', '#0f766e', '#0d9488'] : ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf'];
      body = (
        <>
          <rect width={W} height={H} fill={c[0]} />
          <path d="M0 0L400 0L400 120C320 170 240 90 150 130S30 170 0 150Z" fill={c[2]} opacity="0.7" />
          <path d="M0 0L400 0L400 60C310 110 250 40 160 80S40 110 0 90Z" fill={c[3]} opacity="0.6" />
          <path d={`M0 560C80 520 150 600 240 570S360 520 400 540L400 ${H}L0 ${H}Z`} fill={c[1]} />
          <path d={`M0 640C90 600 170 680 260 650S370 610 400 625L400 ${H}L0 ${H}Z`} fill={c[2]} />
          <path d={`M0 720C100 690 170 760 270 730S370 700 400 710L400 ${H}L0 ${H}Z`} fill={c[3]} />
          <path d={`M0 790C110 770 190 820 290 800S380 780 400 790L400 ${H}L0 ${H}Z`} fill={c[4]} />
          <g fill="none" stroke={dark ? '#5eead4' : '#14b8a6'} strokeOpacity="0.25" strokeWidth="2">
            {[260, 300, 340, 380].map((y) => <path key={y} d={`M-20 ${y}C80 ${y - 40} 160 ${y + 40} 240 ${y}S380 ${y - 30} 420 ${y}`} />)}
          </g>
        </>
      );
      break;
    }
    case 'awan': {
      const cf = dark ? '#334155' : '#ffffff';
      const cs = dark ? '#1e293b' : '#dbeafe';
      body = (
        <>
          <Sky id={g('sky')} stops={dark ? ['#0f1d3a', '#1e3a5f', '#27466e'] : ['#7dd3fc', '#bae6fd', '#e0f2fe']} />
          {dark ? (
            <><Stars seed={11} n={50} color="#fff" max={1.4} /><circle cx="320" cy="110" r="34" fill="#fde68a" /><circle cx="306" cy="100" r="6" fill="#fcd34d" /><circle cx="330" cy="124" r="4" fill="#fcd34d" /></>
          ) : (
            <g transform="translate(320 110)">
              {Array.from({ length: 12 }, (_, i) => <rect key={i} x="-4" y="-66" width="8" height="18" rx="4" fill="#fcd34d" transform={`rotate(${i * 30})`} />)}
              <circle r="40" fill="#fde047" /><circle cx="-12" cy="-6" r="4" fill="#78350f" /><circle cx="12" cy="-6" r="4" fill="#78350f" />
              <path d="M-14 10Q0 22 14 10" stroke="#78350f" strokeWidth="4" fill="none" strokeLinecap="round" />
            </g>
          )}
          <Cloud x={90} y={200} s={1} fill={cf} shade={cs} />
          <Cloud x={300} y={340} s={0.8} fill={cf} shade={cs} />
          <Cloud x={110} y={480} s={1.2} fill={cf} shade={cs} />
          <Cloud x={310} y={620} s={0.9} fill={cf} shade={cs} />
          <Cloud x={80} y={760} s={1} fill={cf} shade={cs} />
          <Cloud x={330} y={820} s={1.3} fill={cf} shade={cs} />
        </>
      );
      break;
    }
    case 'pelangi': {
      const bands = dark ? ['#be123c', '#c2410c', '#a16207', '#15803d', '#1d4ed8', '#6d28d9'] : ['#fda4af', '#fdba74', '#fde047', '#86efac', '#93c5fd', '#c4b5fd'];
      const cf = dark ? '#475569' : '#ffffff';
      body = (
        <>
          <Sky id={g('sky')} stops={dark ? ['#1e1b3a', '#2a2350', '#1f2b4a'] : ['#fff1f2', '#fef9c3', '#ecfeff']} />
          <g fill="none" strokeWidth="22" opacity={dark ? 0.55 : 0.85}>
            {bands.map((c, i) => <path key={i} d={`M${-40 + i * 22} 460A${240 - i * 22} ${240 - i * 22} 0 0 1 ${440 - i * 22} 460`} stroke={c} />)}
          </g>
          <Cloud x={0} y={470} s={1.1} fill={cf} />
          <Cloud x={400} y={470} s={1.1} fill={cf} />
          {[[60, 90, '#f472b6'], [340, 140, '#facc15'], [200, 640, '#60a5fa'], [80, 740, '#4ade80'], [330, 780, '#fb923c']].map(([x, y, c], i) => (
            <path key={i} transform={`translate(${x} ${y}) scale(1.4)`} d="M0-12C4-4 4-4 12 0C4 4 4 4 0 12C-4 4-4 4-12 0C-4-4-4-4 0-12Z" fill={c as string} opacity={dark ? 0.6 : 0.9} />
          ))}
          <Stars seed={5} n={40} color={dark ? '#fde68a' : '#f9a8d4'} max={2} />
        </>
      );
      break;
    }
    case 'angkasa': {
      body = (
        <>
          <Sky id={g('sky')} stops={dark ? ['#0b0820', '#1b1442', '#0e1b3d'] : ['#e0e7ff', '#ede9fe', '#e0f2fe']} />
          <Stars seed={13} n={110} color={dark ? '#ffffff' : '#a5b4fc'} max={2} />
          {[[50, 70], [360, 300], [40, 470], [250, 820]].map(([x, y], i) => <Sparkle key={i} x={x} y={y} s={9} color={dark ? '#fde68a' : '#c4b5fd'} />)}
          <Planet x={300} y={130} r={42} fill={dark ? '#f59e0b' : '#fcd34d'} ring={dark ? '#fb7185' : '#f9a8d4'} band={dark ? '#d97706' : '#fbbf24'} />
          <Planet x={70} y={330} r={26} fill={dark ? '#06b6d4' : '#67e8f9'} band={dark ? '#0891b2' : '#22d3ee'} />
          <Planet x={330} y={560} r={30} fill={dark ? '#8b5cf6' : '#c4b5fd'} ring={dark ? '#38bdf8' : '#7dd3fc'} tilt={15} />
          <Planet x={120} y={730} r={52} fill={dark ? '#ef4444' : '#fca5a5'} band={dark ? '#dc2626' : '#f87171'} />
          <Rocket x={200} y={470} s={1.1} rot={30} body={dark ? '#e2e8f0' : '#ffffff'} accent={dark ? '#f43f5e' : '#fb7185'} window={dark ? '#38bdf8' : '#7dd3fc'} />
          <g fill="none" stroke={dark ? '#ffffff' : '#a5b4fc'} strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10">
            <path d="M170 540C140 600 90 610 40 600" />
          </g>
        </>
      );
      break;
    }
    case 'tropis': {
      const leaves = dark ? ['#14532d', '#166534', '#15803d', '#065f46'] : ['#86efac', '#4ade80', '#34d399', '#6ee7b7'];
      const vein = dark ? '#052e16' : '#dcfce7';
      body = (
        <>
          <Sky id={g('sky')} stops={dark ? ['#03140c', '#052e1c', '#041f17'] : ['#f0fdf4', '#ecfdf5', '#fefce8']} />
          <Monstera x={-10} y={230} s={1.1} rot={60} fill={leaves[1]} vein={vein} />
          <Monstera x={420} y={70} s={0.9} rot={-120} fill={leaves[0]} vein={vein} />
          <Monstera x={410} y={620} s={1.2} rot={-70} fill={leaves[2]} vein={vein} />
          <Monstera x={-20} y={880} s={1} rot={40} fill={leaves[3]} vein={vein} />
          <Leaf x={-10} y={480} s={1.1} rot={-20} fill={leaves[2]} vein={vein} />
          <Leaf x={410} y={360} s={1} rot={200} fill={leaves[3]} vein={vein} />
          <Leaf x={150} y={870} s={0.9} rot={-60} fill={leaves[0]} vein={vein} />
          <Leaf x={230} y={-10} s={0.8} rot={110} fill={leaves[1]} vein={vein} />
          {[[300, 300, '#fb7185'], [60, 660, '#fbbf24']].map(([x, y, c], i) => (
            <g key={i} transform={`translate(${x} ${y})`} opacity={dark ? 0.6 : 0.85}>
              {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-12" rx="8" ry="13" fill={c as string} transform={`rotate(${a})`} />)}
              <circle r="5" fill="#fef08a" />
            </g>
          ))}
        </>
      );
      break;
    }
    case 'konfeti': {
      const r = rng(42);
      const cols = dark ? ['#f472b6', '#facc15', '#22d3ee', '#a78bfa', '#4ade80', '#fb923c'] : ['#f9a8d4', '#fde047', '#67e8f9', '#c4b5fd', '#86efac', '#fdba74'];
      body = (
        <>
          <rect width={W} height={H} fill={dark ? '#0f1220' : '#fffdf7'} />
          {Array.from({ length: 70 }, (_, i) => {
            const x = r() * W, y = r() * H, s = 6 + r() * 12, rot = r() * 360, c = cols[i % cols.length], k = i % 5;
            const o = dark ? 0.7 : 0.9;
            const t = `translate(${x} ${y}) rotate(${rot})`;
            if (k === 0) return <circle key={i} cx={x} cy={y} r={s * 0.6} fill={c} opacity={o} />;
            if (k === 1) return <rect key={i} transform={t} x={-s / 2} y={-s / 2} width={s} height={s} rx="2" fill={c} opacity={o} />;
            if (k === 2) return <path key={i} transform={t} d={`M0 ${-s * 0.7}L${s * 0.65} ${s * 0.5}L${-s * 0.65} ${s * 0.5}Z`} fill={c} opacity={o} />;
            if (k === 3) return <circle key={i} cx={x} cy={y} r={s * 0.6} fill="none" stroke={c} strokeWidth="3" opacity={o} />;
            return <path key={i} transform={t} d={`M${-s} 0q${s / 2} ${-s / 2} ${s} 0t${s} 0`} fill="none" stroke={c} strokeWidth="3.5" strokeLinecap="round" opacity={o} />;
          })}
        </>
      );
      break;
    }
    case 'celengin': {
      const r = rng(99);
      const pig = dark ? { body: '#9d4b6b', dark: '#3b1424', coin: '#d97706' } : { body: '#fbcfe8', dark: '#9d174d', coin: '#fcd34d' };
      const coin = dark ? { face: '#b45309', edge: '#fde68a' } : { face: '#fde68a', edge: '#b45309' };
      body = (
        <>
          <Sky id={g('sky')} stops={dark ? ['#1a1020', '#221628', '#14121f'] : ['#fff7ed', '#fdf2f8', '#f0fdfa']} />
          <g opacity={dark ? 0.55 : 0.85}>
            {Array.from({ length: 22 }, (_, i) => <Coin key={i} x={r() * W} y={r() * H} r={9 + r() * 14} face={coin.face} edge={coin.edge} label={i % 3 === 0 ? 'C' : 'Rp'} />)}
          </g>
          <Piggy x={290} y={170} s={0.9} {...pig} />
          <Piggy x={100} y={460} s={1.1} flip {...pig} />
          <Piggy x={300} y={740} s={0.95} {...pig} />
          {[[60, 120], [200, 300], [340, 470], [50, 680], [200, 820]].map(([x, y], i) => <Sparkle key={i} x={x} y={y} s={8} color={dark ? '#fde68a' : '#fbbf24'} />)}
        </>
      );
      break;
    }
    default:
      return null;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      {body}
    </svg>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Minus, Plus, RotateCcw, Move, Upload } from 'lucide-react';

// Pengaturan background Kartu Saldo. Pratinjau memakai CSS yang sama dengan kartu di Home
// (background-size = zoom x 100%, background-position dalam persen), jadi hasilnya sama persis.
export type BgSide = 'safe' | 'low';
export interface BgSlot { url: string; pos: string; zoom: number }

interface Props {
  safe: BgSlot;
  low: BgSlot;
  uploading: { safe: boolean; low: boolean };
  onChange: (side: BgSide, pos: string, zoom: number) => void;
  onPick: (side: BgSide) => void;
}

function parsePos(pos: string): [number, number] {
  const m = (pos || '').match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (m) return [Number(m[1]), Number(m[2])];
  return [50, 50];
}
const clamp = (v: number) => Math.min(100, Math.max(0, v));

export default function CardBgEditor({ safe, low, uploading, onChange, onPick }: Props) {
  const [side, setSide] = useState<BgSide>('safe');
  const slot = side === 'safe' ? safe : low;
  const boxRef = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    setNat(null);
    if (!slot.url) return;
    const im = new Image();
    im.onload = () => setNat({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = slot.url;
  }, [slot.url]);

  const [px, py] = parsePos(slot.pos);
  const zoom = slot.zoom || 1;
  const setZoom = (z: number) => onChange(side, `${px}% ${py}%`, Math.min(3, Math.max(1, Math.round(z * 100) / 100)));

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px, py };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; const el = boxRef.current;
    if (!d || !el || !nat) return;
    const r = el.getBoundingClientRect();
    const scaledW = r.width * zoom;
    const scaledH = scaledW * (nat.h / nat.w);
    const ovX = scaledW - r.width;
    const ovY = scaledH - r.height;
    const nx = ovX > 1 ? clamp(d.px - ((e.clientX - d.x) / ovX) * 100) : d.px;
    const ny = ovY > 1 ? clamp(d.py - ((e.clientY - d.y) / ovY) * 100) : d.py;
    onChange(side, `${Math.round(nx * 10) / 10}% ${Math.round(ny * 10) / 10}%`, zoom);
  };
  const onUp = () => { drag.current = null; };

  const tabCls = (on: boolean) => `flex-1 h-9 rounded-lg text-xs font-bold transition-all ${on ? 'bg-white dark:bg-gray-600 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-gray-500 dark:text-gray-300'}`;

  return (
    <div>
      <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-3">
        <button type="button" onClick={() => setSide('safe')} className={tabCls(side === 'safe')}>Saat saldo aman</button>
        <button type="button" onClick={() => setSide('low')} className={tabCls(side === 'low')}>Saat saldo menipis</button>
      </div>

      {!slot.url ? (
        <button type="button" onClick={() => onPick(side)} className="glass glass-teal w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-gray-500 dark:text-gray-300 transition-all text-xs font-semibold gap-1" style={{ aspectRatio: '1.9 / 1' }}>
          {uploading[side] ? 'Mengunggah...' : <><Upload className="w-5 h-5" /> Pilih foto</>}
        </button>
      ) : (
        <>
          <div
            ref={boxRef}
            className="relative w-full rounded-2xl overflow-hidden bg-teal-700 touch-none cursor-grab active:cursor-grabbing select-none"
            style={{ aspectRatio: '1.9 / 1' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          >
            <div className="absolute inset-0" style={{ backgroundImage: `url(${slot.url})`, backgroundSize: `${zoom * 100}%`, backgroundPosition: `${px}% ${py}%`, backgroundRepeat: 'no-repeat' }} />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute left-3 top-3 flex items-center gap-1 text-[10px] text-white bg-black/40 px-2.5 py-1 rounded-full pointer-events-none"><Move className="w-3 h-3" /> Geser untuk atur posisi</div>
            <div className="absolute left-4 bottom-4 text-white pointer-events-none">
              <p className="text-[11px] text-white/80">Total Saldo Kamu</p>
              <p className="text-2xl font-extrabold">{side === 'safe' ? 'Rp 1.250.000' : 'Rp 85.000'}</p>
            </div>
            <div className={`absolute right-3 top-3 px-3 py-1 rounded-full text-[10px] font-bold pointer-events-none glass ${side === 'safe' ? 'glass-teal' : 'glass-danger'}`}>{side === 'safe' ? 'Aman' : 'Krisis'}</div>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button type="button" onClick={() => setZoom(zoom - 0.2)} aria-label="Perkecil" className="glass w-9 h-9 shrink-0 rounded-xl text-gray-600 dark:text-gray-200 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-teal-600" aria-label="Zoom" />
            <button type="button" onClick={() => setZoom(zoom + 0.2)} aria-label="Perbesar" className="glass w-9 h-9 shrink-0 rounded-xl text-gray-600 dark:text-gray-200 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
          </div>

          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => onPick(side)} className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1.5">{uploading[side] ? 'Mengunggah...' : <><ImageIcon className="w-4 h-4" /> Ganti foto</>}</button>
            <button type="button" onClick={() => onChange(side, '50% 50%', 1)} className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1.5"><RotateCcw className="w-4 h-4" /> Reset posisi</button>
          </div>
        </>
      )}
      <p className="text-[10px] text-gray-400 mt-3">Perubahan langsung terlihat di pratinjau dan tersimpan saat kamu menekan Simpan Pengaturan.</p>
    </div>
  );
}

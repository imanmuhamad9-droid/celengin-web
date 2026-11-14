'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';

// Layar atur foto sebelum diunggah: geser, zoom (slider, tombol, atau cubit), lalu Simpan.
// Hasilnya berupa gambar JPEG yang sudah dipotong sesuai bingkai.
interface Props {
  file: File;
  shape: 'circle' | 'rect';
  aspect: number;        // lebar / tinggi bingkai (1 untuk foto profil)
  outWidth: number;      // lebar gambar hasil, dalam piksel
  title: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
}

const STAGE_W = 288;
const MAX_ZOOM = 4;

export default function PhotoCropper({ file, shape, aspect, outWidth, title, onCancel, onConfirm }: Props) {
  const stageH = Math.round(STAGE_W / aspect);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);

  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => {
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => setErr('Foto tidak bisa dibuka. Coba pilih foto lain.');
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const cover = img ? Math.max(STAGE_W / img.naturalWidth, stageH / img.naturalHeight) : 1;
  const dw = img ? img.naturalWidth * cover * zoom : 0;
  const dh = img ? img.naturalHeight * cover * zoom : 0;

  const clampOff = (x: number, y: number, z: number) => {
    if (!img) return { x: 0, y: 0 };
    const w = img.naturalWidth * cover * z;
    const h = img.naturalHeight * cover * z;
    const mx = Math.max(0, (w - STAGE_W) / 2);
    const my = Math.max(0, (h - stageH) / 2);
    return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  };
  const changeZoom = (z: number) => {
    const nz = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(nz);
    setOff((o) => clampOff(o.x, o.y, nz));
  };

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = Array.from(ptrs.current.values());
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoom };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(ptrs.current.values());
      changeZoom(pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d));
    } else if (ptrs.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setOff((o) => clampOff(o.x + dx, o.y + dy, zoom));
    }
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinch.current = null; };

  const save = async () => {
    if (!img || busy) return;
    setBusy(true); setErr('');
    try {
      const f = outWidth / STAGE_W;
      const canvas = document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = Math.round(stageH * f);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Kanvas tidak tersedia');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (STAGE_W / 2 - dw / 2 + off.x) * f, (stageH / 2 - dh / 2 + off.y) * f, dw * f, dh * f);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Gagal membuat gambar');
      await onConfirm(blob);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan foto');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-5 relative">
        <button onClick={onCancel} aria-label="Tutup" className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold text-center text-gray-800 dark:text-white mb-1">{title}</h2>
        <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 mb-4">Geser foto, lalu atur zoom sampai pas.</p>

        <div
          className="relative mx-auto overflow-hidden bg-gray-900 touch-none cursor-grab active:cursor-grabbing select-none rounded-2xl"
          style={{ width: STAGE_W, height: stageH }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" draggable={false} className="absolute max-w-none pointer-events-none" style={{ width: dw, height: dh, left: STAGE_W / 2 - dw / 2 + off.x, top: stageH / 2 - dh / 2 + off.y }} />
          )}
          {shape === 'circle' && <div className="absolute inset-0 rounded-full pointer-events-none border-2 border-white/80" style={{ boxShadow: '0 0 0 999px rgba(0,0,0,0.55)' }} />}
          {!img && !err && <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">Memuat foto...</div>}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button type="button" onClick={() => changeZoom(zoom - 0.25)} aria-label="Perkecil" className="w-9 h-9 shrink-0 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
          <input type="range" min={1} max={MAX_ZOOM} step={0.05} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} className="flex-1 accent-teal-600" aria-label="Zoom" />
          <button type="button" onClick={() => changeZoom(zoom + 0.25)} aria-label="Perbesar" className="w-9 h-9 shrink-0 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
        </div>

        {err && <p className="text-xs text-red-500 text-center mt-3">{err}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} disabled={busy} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-300">Batal</button>
          <button onClick={save} disabled={!img || busy} className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold">{busy ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}

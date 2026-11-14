// OCR struk di browser (gratis, tanpa API key, foto tidak dikirim ke server mana pun).
// Memakai Tesseract.js: paket dan data bahasa Indonesia diunduh sekali dari CDN saat pertama kali dipakai.
// Hanya boleh dipanggil dari sisi klien (event handler), bukan saat render.

export type OcrStage = 'prepare' | 'download' | 'read';
export type OcrProgress = (stage: OcrStage, percent: number) => void;

const MAX_SIDE = 1800; // sisi terpanjang gambar (px). Lebih besar = lebih akurat tapi lebih lambat.

/** Muat gambar dengan orientasi EXIF yang benar (foto HP sering tersimpan miring). */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); } catch (_) { /* pakai cara lama */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Gambar tidak bisa dibuka.'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

/** Perkecil, jadikan abu-abu, lalu regangkan kontras supaya tulisan struk thermal yang pudar lebih jelas. */
export async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  const src = await loadBitmap(file);
  const w0 = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const h0 = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  // Foto kecil diperbesar sedikit: Tesseract lebih akurat di tinggi huruf >= 20 px
  const up = Math.max(w0, h0) < 1000 ? 1.6 : 1;
  const w = Math.round(w0 * scale * up);
  const h = Math.round(h0 * scale * up);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  if ('close' in src) (src as ImageBitmap).close();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g] += 1;
  }
  // Regangkan antara persentil 2% dan 98%
  const total = w * h;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.02) { hi = v; break; } }
  if (hi - lo > 30) {
    const k = 255 / (hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, Math.round((d[i] - lo) * k)));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Baca teks dari foto struk. Mengembalikan teks mentah (baris per baris). */
export async function recognizeReceipt(file: File, onProgress?: OcrProgress): Promise<string> {
  onProgress?.('prepare', 0);
  const canvas = await prepareImage(file);
  onProgress?.('prepare', 100);

  // Dimuat saat dibutuhkan saja supaya halaman lain tidak ikut berat
  const { createWorker } = await import('tesseract.js');

  const logger = (m: { status: string; progress: number }) => {
    const pct = Math.round((m.progress || 0) * 100);
    if (m.status.includes('loading') || m.status.includes('initializ')) onProgress?.('download', pct);
    else if (m.status.includes('recogni')) onProgress?.('read', pct);
  };

  const worker = await createWorker('ind', 1, { logger });
  try {
    // 6 = satu blok teks seragam: cocok untuk struk. Spasi antar kata dipertahankan agar kolom harga tidak menempel.
    const params: Record<string, string> = { tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' };
    await worker.setParameters(params as never);
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

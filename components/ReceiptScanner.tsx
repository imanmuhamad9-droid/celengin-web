'use client';
import { useRef, useState } from 'react';
import { Camera, ImageIcon, ScanLine } from 'lucide-react';
import { recognizeReceipt, OcrStage } from '@/lib/receiptOcr';
import { parseReceiptText, ParsedReceipt } from '@/lib/receiptParser';

interface Props {
  onResult: (result: ParsedReceipt, rawText: string) => void;
  showDialog: (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;
  /** Boleh pilih beberapa foto sekaligus dari galeri; tiap foto dibaca bergiliran dan memanggil onResult sendiri-sendiri. */
  multiple?: boolean;
}

const STAGE_LABEL: Record<OcrStage, string> = {
  prepare: 'Menyiapkan gambar...',
  download: 'Menyiapkan pembaca teks...',
  read: 'Membaca struk...',
};
// Bagian bilah progres untuk tiap tahap (persen total)
const STAGE_RANGE: Record<OcrStage, [number, number]> = { prepare: [0, 8], download: [8, 40], read: [40, 100] };
const MAX_BYTES = 15 * 1024 * 1024;

export default function ReceiptScanner({ onResult, showDialog, multiple = false }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<OcrStage>('prepare');
  const [percent, setPercent] = useState(0);
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [queue, setQueue] = useState<{ i: number; n: number } | null>(null);

  // Membaca satu foto. Mengembalikan true bila berhasil, false bila gagal (dialog sudah ditampilkan).
  const processFile = async (file: File): Promise<boolean> => {
    if (!file.type.startsWith('image/')) { showDialog('File Tidak Cocok', 'Pilih foto struk (JPG atau PNG).', 'danger'); return false; }
    if (file.size > MAX_BYTES) { showDialog('Foto Terlalu Besar', 'Ukuran foto maksimal 15 MB. Coba foto ulang atau kecilkan ukurannya.', 'danger'); return false; }
    setShowRaw(false);
    setStage('prepare');
    setPercent(0);
    try {
      const text = await recognizeReceipt(file, (s, p) => {
        const [from, to] = STAGE_RANGE[s];
        setStage(s);
        setPercent(Math.round(from + ((to - from) * Math.min(100, p)) / 100));
      });
      setRawText(text);
      const parsed = parseReceiptText(text);
      onResult(parsed, text);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const network = /network|fetch|load|traineddata|wasm|worker/i.test(msg);
      showDialog(
        'Scan Gagal',
        network
          ? 'Pembaca teks gagal diunduh. Cek koneksi internet, lalu coba lagi. Kamu tetap bisa mengisi struk secara manual.'
          : `Struk tidak bisa dibaca (${msg}). Coba foto ulang dengan struk lurus dan cahaya terang, atau isi manual.`,
        'danger',
      );
      return false;
    }
  };

  // Beberapa foto diproses satu per satu (OCR berat bila paralel); berhenti di foto yang gagal.
  const handleFiles = async (files: File[]) => {
    if (busy || files.length === 0) return;
    setBusy(true);
    try {
      for (let k = 0; k < files.length; k++) {
        if (files.length > 1) setQueue({ i: k + 1, n: files.length });
        const ok = await processFile(files[k]);
        if (!ok) break;
      }
    } finally {
      setBusy(false);
      setQueue(null);
    }
  };

  const pick = (ref: React.RefObject<HTMLInputElement | null>) => () => { if (!busy) ref.current?.click(); };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // supaya foto yang sama bisa dipilih lagi
    handleFiles(multiple ? picked : picked.slice(0, 1));
  };

  return (
    <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/20 p-3">
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 shrink-0 rounded-xl glass text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-sm"><ScanLine className="w-5 h-5" /></div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Scan struk</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">{multiple ? 'Tiap foto jadi satu catatan baru, item dan harga terisi otomatis. Dari galeri bisa pilih beberapa foto sekaligus. Hasilnya bisa kamu perbaiki. Gratis, foto tidak dikirim ke mana-mana.' : 'Foto struknya, item dan harga terisi otomatis. Hasilnya bisa kamu perbaiki. Gratis, foto tidak dikirim ke mana-mana.'}</p>
        </div>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onChange} className="hidden" />
      <input ref={galleryRef} type="file" accept="image/*" multiple={multiple} onChange={onChange} className="hidden" />

      {busy ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-teal-700 dark:text-teal-300 mb-1.5">
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-teal-300 border-t-teal-700 animate-spin inline-block" /> {STAGE_LABEL[stage]}{queue ? ` (struk ${queue.i} dari ${queue.n})` : ''}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-white dark:bg-gray-700 overflow-hidden">
            <div className="h-full bg-teal-600 rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
          {stage === 'download' && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">Pertama kali butuh mengunduh data bahasa (beberapa MB). Berikutnya jauh lebih cepat.</p>}
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={pick(cameraRef)} className="glass glass-solid-teal flex-1 h-11 rounded-[9px] border text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><Camera className="w-4 h-4" /> Foto struk</button>
          <button type="button" onClick={pick(galleryRef)} className="glass glass-teal flex-1 h-11 rounded-[9px] border text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><ImageIcon className="w-4 h-4" /> Dari galeri</button>
        </div>
      )}

      {!busy && rawText && (
        <div className="mt-2.5">
          <button type="button" onClick={() => setShowRaw((v) => !v)} className="text-[10px] font-bold text-teal-700 dark:text-teal-300 underline underline-offset-2">{showRaw ? 'Sembunyikan teks yang terbaca' : 'Lihat teks yang terbaca'}</button>
          {showRaw && <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug glass glass-sheet text-gray-600 dark:text-gray-300 rounded-xl p-2.5 border border-gray-100 dark:border-gray-700">{rawText}</pre>}
        </div>
      )}
    </div>
  );
}

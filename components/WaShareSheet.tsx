'use client';
import { useEffect, useState } from 'react';
import { X, MessageCircle, Copy } from 'lucide-react';
import { normalizePhone, waLink } from '@/lib/whatsapp';

export interface WaOption {
  key: string;
  label: string;          // teks tombol pilihan, mis. "Rincian lengkap" atau nama orang
  hint?: string;          // keterangan kecil di bawah daftar pilihan
  text: string;           // isi pesan
  phone?: string | null;  // bila ada, WhatsApp langsung membuka chat orang itu
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  options: WaOption[];
  showDialog: (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;
}

export default function WaShareSheet({ isOpen, onClose, title = 'Kirim ke WhatsApp', options, showDialog }: Props) {
  const [selected, setSelected] = useState('');
  const [text, setText] = useState('');

  // Setiap dibuka: pilih opsi pertama
  useEffect(() => {
    if (!isOpen || options.length === 0) return;
    setSelected(options[0].key);
    setText(options[0].text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || options.length === 0) return null;
  const current = options.find((o) => o.key === selected) || options[0];
  const phone = normalizePhone(current.phone);

  const pick = (o: WaOption) => { setSelected(o.key); setText(o.text); };

  const openWa = () => {
    const url = waLink(text, current.phone);
    const w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url; // pop-up diblokir (mis. aplikasi terpasang di layar utama iPhone)
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); showDialog('Berhasil', 'Pesan disalin. Tinggal tempel di WhatsApp.', 'success'); }
    catch { showDialog('Salin Manual', 'Tekan lama pada kotak pesan, pilih semua, lalu salin.', 'info'); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200" />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-5 pb-7 max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300">
        <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto mb-4" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" /> {title}</h3>
          <button onClick={onClose} aria-label="Tutup" className="glass w-8 h-8 rounded-full text-gray-500 dark:text-gray-400 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        {options.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => pick(o)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border-2 max-w-full truncate ${o.key === current.key ? 'glass glass-teal' : 'border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {current.hint && <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">{current.hint}</p>}

        <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Isi pesan (boleh diubah)</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className="w-full text-[12px] leading-snug font-mono bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 focus:ring-2 focus:ring-teal-500"
        />

        <div className="flex gap-2 mt-3">
          <button onClick={openWa} className="glass glass-solid-teal flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <MessageCircle className="w-4 h-4" /> {phone ? `Kirim ke ${current.label}` : 'Buka WhatsApp'}
          </button>
          <button onClick={copy} aria-label="Salin pesan" className="glass h-12 px-4 rounded-xl border text-teal-700 dark:text-teal-300 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
            <Copy className="w-4 h-4" /> Salin
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">{phone ? 'Nomor WhatsApp tersimpan, jadi chat langsung terbuka.' : 'Kamu bisa memilih chat atau grup tujuan di WhatsApp. Simpan nomor WA anggota (tab Anggota) agar langsung terbuka ke orangnya.'}</p>
      </div>
    </div>
  );
}

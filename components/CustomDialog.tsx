'use client';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: 'info' | 'danger' | 'success';
}

// Popup peringatan/konfirmasi: hanya teks (tanpa ikon). Tombol memakai kaca dengan warna teks yang terbaca.
export default function CustomDialog({ isOpen, onClose, onConfirm, title, message, type = 'info' }: DialogProps) {
  if (!isOpen) return null;
  const confirmTone = type === 'danger' && onConfirm ? 'glass-danger' : 'glass-teal';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div role="alertdialog" aria-modal="true" className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 text-center">
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>{title}</h3>
        <p className="mb-6" style={{ color: 'var(--text-muted)' }}>{message}</p>

        <div className="flex gap-3">
          {onConfirm && (
            <button onClick={onClose} className="glass glass-pressable flex-1 py-3 rounded-full font-bold" style={{ color: 'var(--text-main)' }}>
              Batal
            </button>
          )}
          <button
            onClick={() => { if (onConfirm) onConfirm(); onClose(); }}
            className={`glass ${confirmTone} glass-pressable flex-1 py-3 rounded-full font-bold`}
          >
            {onConfirm ? 'Ya, Lanjutkan' : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  );
}

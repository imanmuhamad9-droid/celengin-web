'use client';
import { useEffect, useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';
import { formatRupiah, parseRupiahInput } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (amount: number, action: 'add' | 'subtract') => void | Promise<void>;
  goal: any;
}

export default function UpdateGoalModal({ isOpen, onClose, onSave, goal }: Props) {
  const [action, setAction] = useState<'add' | 'subtract'>('add');
  const [raw, setRaw] = useState(0);
  const [display, setDisplay] = useState('');
  const [saving, setSaving] = useState(false);

  // Bersihkan isian setiap kali dibuka
  useEffect(() => {
    if (isOpen) { setAction('add'); setRaw(0); setDisplay(''); setSaving(false); }
  }, [isOpen]);

  if (!isOpen || !goal) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (raw <= 0 || saving) return;
    setSaving(true);
    try { await onSave(raw, action); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 relative shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>

        <h3 className="text-xl font-extrabold text-center text-gray-900 dark:text-white">Update Tabungan</h3>
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1 mb-5">
          Untuk target: <span className="font-bold text-teal-700 dark:text-teal-400">{goal.title}</span>
        </p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button type="button" onClick={() => setAction('add')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border-2 transition-all ${action === 'add' ? 'glass glass-teal' : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'}`}>
            <ArrowDownCircle className="w-4 h-4" /> Nabung
          </button>
          <button type="button" onClick={() => setAction('subtract')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border-2 transition-all ${action === 'subtract' ? 'glass glass-danger' : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'}`}>
            <ArrowUpCircle className="w-4 h-4" /> Kepake
          </button>
        </div>

        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
          {action === 'add' ? 'Nominal Uang Masuk (Rp)' : 'Nominal Uang Terpakai (Rp)'}
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-900 dark:text-white">Rp</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            autoComplete="off"
            autoFocus
            value={display}
            onChange={(e) => { const p = parseRupiahInput(e.target.value); setRaw(p.raw); setDisplay(p.display); }}
            placeholder="500.000"
            className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-lg font-bold focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>
        <p className="text-[10px] text-right text-gray-400 dark:text-gray-500 mt-2 mb-5">Dana saat ini: {formatRupiah(Number(goal.current_amount) || 0)}</p>

        <button
          type="submit"
          disabled={raw <= 0 || saving}
          className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${action === 'add' ? 'glass glass-teal' : 'glass glass-danger'}`}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Perubahan
        </button>
      </form>
    </div>
  );
}
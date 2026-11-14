'use client';
import { useState, useEffect } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function ChallengeModal({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [amountRaw, setAmountRaw] = useState(0);
  const [isRoutine, setIsRoutine] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setType('expense');
      setAmountDisplay('');
      setAmountRaw(0);
      setIsRoutine(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) { setAmountDisplay(''); setAmountRaw(0); return; }
    setAmountRaw(Number(rawValue));
    setAmountDisplay(new Intl.NumberFormat('id-ID').format(Number(rawValue)));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Buat Target Baru</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nama Target</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Cth: Batas Jajan / Nabung Konser" className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500" />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setType('income')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border-2 transition-all ${type === 'income' ? 'glass glass-teal' : 'border-gray-100 text-gray-400'}`}>
              <ArrowDownCircle className="w-4 h-4" /> Uang Masuk
            </button>
            <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border-2 transition-all ${type === 'expense' ? 'glass glass-danger' : 'border-gray-100 text-gray-400'}`}>
              <ArrowUpCircle className="w-4 h-4" /> Uang Keluar
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nominal Target (Rp)</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-500 font-bold">Rp</span>
              <input type="text" value={amountDisplay} onChange={handleAmountChange} className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 font-bold text-lg" placeholder="0" />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
            <div>
              <p className="text-sm font-bold text-gray-800">Target Rutin?</p>
              <p className="text-[10px] text-gray-500">Reset otomatis tiap minggu</p>
            </div>
            <button 
              type="button" 
              onClick={() => setIsRoutine(!isRoutine)} 
              className={`w-12 h-6 rounded-full transition-colors relative ${isRoutine ? 'glass glass-teal' : 'glass'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isRoutine ? 'left-7' : 'left-1'}`}></div>
            </button>
          </div>

          <button 
            onClick={() => onSave({ title: title || (type === 'income' ? 'Target Masuk' : 'Batas Keluar'), type, target_amount: amountRaw, is_routine: isRoutine })}
            disabled={amountRaw <= 0}
            className="glass glass-solid-teal w-full font-bold py-3.5 rounded-xl transition-all mt-2 disabled:opacity-50"
          >
            Simpan Target
          </button>
        </div>
      </div>
    </div>
  );
}
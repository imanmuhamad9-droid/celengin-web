'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function EditChallengeModal({ isOpen, onClose, onSave, type, currentTarget, isRoutine }: { isOpen: boolean, onClose: () => void, onSave: (amount: number, routine: boolean) => void, type: 'income' | 'expense', currentTarget: number, isRoutine: boolean }) {
  const [amountDisplay, setAmountDisplay] = useState('');
  const [amountRaw, setAmountRaw] = useState(0);
  const [routine, setRoutine] = useState(isRoutine);

  useEffect(() => {
    if (isOpen) {
      setAmountRaw(currentTarget);
      setAmountDisplay(currentTarget > 0 ? new Intl.NumberFormat('id-ID').format(currentTarget) : '');
      setRoutine(isRoutine);
    }
  }, [isOpen, currentTarget, isRoutine]);

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) { setAmountDisplay(''); setAmountRaw(0); return; }
    setAmountRaw(Number(rawValue));
    setAmountDisplay(new Intl.NumberFormat('id-ID').format(Number(rawValue)));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">
          Atur Target {type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nominal Target (Rp)</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-500 font-bold">Rp</span>
              <input type="text" value={amountDisplay} onChange={handleAmountChange} className={`w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 font-bold text-lg ${type === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`} placeholder="0" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">*Biarkan 0 jika tidak ingin memasang target.</p>
          </div>

          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
            <div>
              <p className="text-sm font-bold text-gray-800">Berulang Mingguan?</p>
              <p className="text-[10px] text-gray-500">Target otomatis reset tiap minggu.</p>
            </div>
            <button type="button" onClick={() => setRoutine(!routine)} className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${routine ? 'bg-teal-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${routine ? 'left-7' : 'left-1'}`}></div>
            </button>
          </div>

          <button onClick={() => { onSave(amountRaw, routine); onClose(); }} className={`w-full text-white font-bold py-3.5 rounded-xl transition-all ${type === 'income' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
            Simpan Target
          </button>
        </div>
      </div>
    </div>
  );
}
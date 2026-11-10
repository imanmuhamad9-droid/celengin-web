'use client';
import { useState, useEffect } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function UpdateGoalModal({ isOpen, onClose, onSave, goal }: { isOpen: boolean, onClose: () => void, onSave: (amount: number, action: 'add' | 'subtract') => void, goal: any }) {
  const [action, setAction] = useState<'add' | 'subtract'>('add');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [amountRaw, setAmountRaw] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setAction('add');
      setAmountDisplay('');
      setAmountRaw(0);
    }
  }, [isOpen]);

  if (!isOpen || !goal) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      setAmountDisplay('');
      setAmountRaw(0);
      return;
    }
    setAmountRaw(Number(rawValue));
    setAmountDisplay(new Intl.NumberFormat('id-ID').format(Number(rawValue)));
  };

  const handleSave = () => {
    if (amountRaw <= 0) return;
    onSave(amountRaw, action);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Update Tabungan</h2>
        <p className="text-xs text-center text-gray-500 mb-5">Untuk target: <span className="font-bold text-teal-600">{goal.title}</span></p>

        {/* Toggle Tambah / Kurang */}
        <div className="flex gap-2 mb-5">
          <button 
            type="button"
            onClick={() => setAction('add')} 
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all ${action === 'add' ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-100 text-gray-400'}`}
          >
            <ArrowDownCircle className="w-4 h-4" /> Nabung
          </button>
          <button 
            type="button"
            onClick={() => setAction('subtract')} 
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all ${action === 'subtract' ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-100 text-gray-400'}`}
          >
            <ArrowUpCircle className="w-4 h-4" /> Kepake
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {action === 'add' ? 'Nominal Uang Masuk (Rp)' : 'Nominal Uang Keluar (Rp)'}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-gray-500 font-bold">Rp</span>
            <input 
              type="text" 
              value={amountDisplay} 
              onChange={handleAmountChange} 
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 font-bold text-lg" 
              placeholder="0"
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-right">
            Dana saat ini: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(goal.current_amount)}
          </p>
        </div>

        <button 
          onClick={handleSave}
          className={`w-full text-white font-bold py-3.5 rounded-xl flex items-center justify-center transition-all ${action === 'add' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
        >
          Simpan Perubahan
        </button>
      </div>
    </div>
  );
}
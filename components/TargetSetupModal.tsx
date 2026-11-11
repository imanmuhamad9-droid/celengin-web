'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function TargetSetupModal({ isOpen, onClose, onSuccess, showDialog, existingTarget }: any) {
  const [periodType, setPeriodType] = useState('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [incomeDisplay, setIncomeDisplay] = useState('');
  const [incomeRaw, setIncomeRaw] = useState(0);
  const [expenseDisplay, setExpenseDisplay] = useState('');
  const [expenseRaw, setExpenseRaw] = useState(0);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingTarget) {
        setPeriodType(existingTarget.period_type);
        setStartDate(existingTarget.start_date);
        setEndDate(existingTarget.end_date);
        setIncomeRaw(Number(existingTarget.target_income));
        setIncomeDisplay(new Intl.NumberFormat('id-ID').format(existingTarget.target_income));
        setExpenseRaw(Number(existingTarget.target_expense));
        setExpenseDisplay(new Intl.NumberFormat('id-ID').format(existingTarget.target_expense));
      } else {
        const today = new Date();
        const day = today.getDay() === 0 ? 7 : today.getDay();
        const start = new Date(today); start.setDate(today.getDate() - day + 1);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        
        setPeriodType('week');
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
        setIncomeDisplay(''); setIncomeRaw(0); setExpenseDisplay(''); setExpenseRaw(0);
      }
    }
  }, [isOpen, existingTarget]);

  const handlePeriodChange = (type: string) => {
    setPeriodType(type);
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (type === 'day') { start = today; end = today; } 
    else if (type === 'week') {
      const day = today.getDay() === 0 ? 7 : today.getDay();
      start.setDate(today.getDate() - day + 1);
      end.setDate(start.getDate() + 6);
    } 
    else if (type === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } 
    else if (type === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
    }
    
    if (type !== 'custom') {
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return showDialog('Gagal', 'Tanggal harus diisi.', 'danger');
    if (startDate > endDate) return showDialog('Gagal', 'Tanggal mulai tidak boleh lebih dari tanggal selesai.', 'danger');

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const payload = {
      user_id: session.user.id,
      period_type: periodType,
      start_date: startDate,
      end_date: endDate,
      target_income: incomeRaw,
      target_expense: expenseRaw
    };

    if (existingTarget) {
      await supabase.from('targets').update(payload).eq('id', existingTarget.id);
    } else {
      await supabase.from('targets').insert(payload);
    }
    
    onSuccess(); onClose(); setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-5 relative max-h-[90vh] overflow-y-auto transition-colors">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 text-center">Atur Target</h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Periode Target</label>
            <div className="grid grid-cols-5 gap-1">
              {['day', 'week', 'month', 'year', 'custom'].map(type => (
                <button 
                  key={type} type="button" onClick={() => handlePeriodChange(type)}
                  className={`py-1.5 rounded-lg text-[9px] font-bold capitalize transition-all border ${periodType === type ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
                >
                  {type === 'day' ? 'Harian' : type === 'week' ? 'Minggu' : type === 'month' ? 'Bulan' : type === 'year' ? 'Tahun' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {/* PERBAIKAN: INPUT TANGGAL DIPERKECIL (KIRI-KANAN) */}
          <div className="flex items-center justify-between gap-1">
            <div className="w-[48%]">
              <label className="block text-[9px] font-medium text-gray-700 dark:text-gray-300 mb-1">Mulai</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => { setStartDate(e.target.value); setPeriodType('custom'); }} 
                required 
                className="w-full px-1 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-[10px] focus:ring-2 focus:ring-teal-500 transition-colors" 
              />
            </div>
            <div className="w-[48%]">
              <label className="block text-[9px] font-medium text-gray-700 dark:text-gray-300 mb-1">Selesai</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => { setEndDate(e.target.value); setPeriodType('custom'); }} 
                required 
                className="w-full px-1 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-[10px] focus:ring-2 focus:ring-teal-500 transition-colors" 
              />
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-2.5 rounded-xl border border-green-100 dark:border-green-800">
            <label className="flex items-center gap-1 text-[11px] font-bold text-green-700 dark:text-green-400 mb-1.5"><ArrowDownCircle className="w-3.5 h-3.5" /> Target Pemasukan</label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-green-600 dark:text-green-400 font-bold text-xs">Rp</span>
              <input type="text" inputMode="numeric" value={incomeDisplay} onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setIncomeRaw(Number(val)); setIncomeDisplay(val ? new Intl.NumberFormat('id-ID').format(Number(val)) : '');
              }} className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-green-200 dark:border-green-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-green-500 transition-colors" placeholder="0" />
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 p-2.5 rounded-xl border border-red-100 dark:border-red-800">
            <label className="flex items-center gap-1 text-[11px] font-bold text-red-700 dark:text-red-400 mb-1.5"><ArrowUpCircle className="w-3.5 h-3.5" /> Batas Pengeluaran</label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-red-600 dark:text-red-400 font-bold text-xs">Rp</span>
              <input type="text" inputMode="numeric" value={expenseDisplay} onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setExpenseRaw(Number(val)); setExpenseDisplay(val ? new Intl.NumberFormat('id-ID').format(Number(val)) : '');
              }} className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-red-200 dark:border-red-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-red-500 transition-colors" placeholder="0" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-all mt-2 disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Simpan Target'}
          </button>
        </form>
      </div>
    </div>
  );
}
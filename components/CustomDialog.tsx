'use client';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: 'info' | 'danger' | 'success';
}

export default function CustomDialog({ isOpen, onClose, onConfirm, title, message, type = 'info' }: DialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 relative text-center shadow-2xl">
        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${type === 'danger' ? 'bg-red-100 text-red-500' : type === 'success' ? 'bg-green-100 text-green-500' : 'bg-teal-100 text-teal-500'}`}>
          <span className="text-2xl">{type === 'danger' ? '!' : type === 'success' ? '✓' : 'i'}</span>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-500 mb-6">{message}</p>
        
        <div className="flex gap-3">
          {onConfirm && (
            <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
              Batal
            </button>
          )}
          <button 
            onClick={() => { if (onConfirm) onConfirm(); onClose(); }} 
            className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-teal-600 hover:bg-teal-700'}`}
          >
            {onConfirm ? 'Ya, Lanjutkan' : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  );
}
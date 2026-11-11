'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import TransactionModal from './TransactionModal';
import CustomDialog from './CustomDialog';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info'|'success'|'danger', onConfirm: undefined as (()=>void)|undefined });
  const showDialog = (title: string, msg: string, type: 'info'|'success'|'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const handleSuccess = () => { router.refresh(); };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe transition-colors">
        <div className="max-w-md mx-auto flex justify-around items-end h-[72px] relative px-2">
          
          {/* Menu Home */}
          <button 
            onClick={() => router.push('/dashboard')} 
            className={`flex flex-col items-center justify-end w-full h-full pb-2 transition-transform active:scale-90 duration-150 ${pathname === '/dashboard' ? 'opacity-100' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}
          >
            <img src="/icon-home.png" alt="Home" className="w-7 h-7 object-contain mb-1" />
            <span className={`text-[10px] font-bold ${pathname === '/dashboard' ? 'text-teal-700 dark:text-teal-400' : 'text-gray-500'}`}>Home</span>
          </button>

          {/* Menu Target */}
          <button 
            onClick={() => router.push('/spending-challenge')} 
            className={`flex flex-col items-center justify-end w-full h-full pb-2 transition-transform active:scale-90 duration-150 ${pathname === '/spending-challenge' ? 'opacity-100' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}
          >
            <img src="/icon-target.png" alt="Target" className="w-7 h-7 object-contain mb-1" />
            <span className={`text-[10px] font-bold ${pathname === '/spending-challenge' ? 'text-teal-700 dark:text-teal-400' : 'text-gray-500'}`}>Target</span>
          </button>

          {/* Tombol Plus Melayang di Tengah */}
          <div className="relative w-full flex justify-center h-full">
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="absolute -top-6 w-14 h-14 bg-teal-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-teal-200 dark:shadow-none hover:scale-105 active:scale-95 transition-all border-4 border-white dark:border-gray-900"
            >
              <Plus className="w-7 h-7" />
            </button>
            <span className="text-[10px] text-gray-500 font-bold pb-2 mt-auto">Catat</span>
          </div>

          {/* Menu Impian */}
          <button 
            onClick={() => router.push('/dream-planner')} 
            className={`flex flex-col items-center justify-end w-full h-full pb-2 transition-transform active:scale-90 duration-150 ${pathname === '/dream-planner' ? 'opacity-100' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}
          >
            <img src="/icon-dream.png" alt="Impian" className="w-7 h-7 object-contain mb-1" />
            <span className={`text-[10px] font-bold ${pathname === '/dream-planner' ? 'text-teal-700 dark:text-teal-400' : 'text-gray-500'}`}>Impian</span>
          </button>

          {/* Menu Bareng */}
          <button 
            onClick={() => router.push('/couple')} 
            className={`flex flex-col items-center justify-end w-full h-full pb-2 transition-transform active:scale-90 duration-150 ${pathname === '/couple' ? 'opacity-100' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}
          >
            <img src="/icon-couple.png" alt="Bareng" className="w-7 h-7 object-contain mb-1" />
            <span className={`text-[10px] font-bold ${pathname === '/couple' ? 'text-pink-600 dark:text-pink-400' : 'text-gray-500'}`}>Bareng</span>
          </button>
        </div>
      </nav>

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} showDialog={showDialog} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </>
  );
}
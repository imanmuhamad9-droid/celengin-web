'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Target, Heart, Plus, Users } from 'lucide-react';
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 pb-safe transition-colors">
        <div className="max-w-md mx-auto flex justify-around items-center h-16 relative">
          
          <button onClick={() => router.push('/dashboard')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${pathname === '/dashboard' ? 'text-teal-700 dark:text-teal-400 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>
            <Home className="w-5 h-5 mb-0.5" /><span className="text-[10px]">Home</span>
          </button>

          <button onClick={() => router.push('/spending-challenge')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${pathname === '/spending-challenge' ? 'text-teal-700 dark:text-teal-400 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>
            <Target className="w-5 h-5 mb-0.5" /><span className="text-[10px]">Target</span>
          </button>

          <div className="relative w-full flex justify-center">
            <button onClick={() => setIsModalOpen(true)} className="absolute -top-6 w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-teal-200 dark:shadow-none hover:scale-105 transition-transform">
              <Plus className="w-6 h-6" />
            </button>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-7">Catat</span>
          </div>

          <button onClick={() => router.push('/dream-planner')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${pathname === '/dream-planner' ? 'text-teal-700 dark:text-teal-400 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>
            <Target className="w-5 h-5 mb-0.5" /><span className="text-[10px]">Impian</span>
          </button>

          <button onClick={() => router.push('/couple')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${pathname === '/couple' ? 'text-pink-600 dark:text-pink-400 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>
            <Users className="w-5 h-5 mb-0.5" /><span className="text-[10px]">Bareng</span>
          </button>
        </div>
      </nav>

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} showDialog={showDialog} />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </>
  );
}
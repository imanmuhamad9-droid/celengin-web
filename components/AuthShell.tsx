'use client';
import { ReactNode } from 'react';

// Gaya bersama untuk halaman Masuk, Daftar, dan Password Baru
export const authLabel = 'block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5';
export const authInput =
  'w-full h-12 pl-11 rounded-2xl border bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-gray-700 transition-all';
export const authBorder = 'border-gray-200 dark:border-gray-600';
export const authBorderOk = 'border-green-400 dark:border-green-500';
export const authBorderErr = 'border-red-400 dark:border-red-500';
export const authBtn =
  'w-full h-12 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-base shadow-lg shadow-teal-600/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:active:scale-100';
export const authBtnSoft =
  'w-full h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-300 font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-50';
export const authIcon = 'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none';
export const authEye = 'absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors';

export default function AuthShell({ title, subtitle, icon, children, footer }: { title: string; subtitle?: string; icon?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-teal-50 via-[#faf8ff] to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-950 transition-colors">
      <div className="w-full max-w-md">
        <div className="glass p-7 sm:p-8 rounded-[2rem] shadow-xl shadow-teal-900/5 border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex flex-col items-center text-center mb-7">
            {icon ?? <img src="/icon.png" alt="Celengin" className="w-16 h-16 mb-4 rounded-2xl shadow-md object-contain" />}
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{title}</h1>
            {subtitle && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">{footer}</div>}
      </div>
    </div>
  );
}

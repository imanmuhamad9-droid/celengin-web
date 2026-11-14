'use client';
import { Check, X } from 'lucide-react';

// Syarat password: merah/abu saat belum, hijau saat terpenuhi. Aturannya sama dengan validasi di halaman.
export default function PasswordRequirements({ password }: { password: string }) {
  const rules = [
    { ok: password.length >= 8, label: 'Minimal 8 karakter' },
    { ok: /[A-Z]/.test(password), label: 'Huruf besar (A-Z)' },
    { ok: /[0-9]/.test(password), label: 'Angka (0-9)' },
    { ok: /[^A-Za-z0-9]/.test(password), label: 'Simbol (!@#$...)' },
  ];
  const done = rules.filter((r) => r.ok).length;
  const barColor = done <= 1 ? 'bg-red-400' : done === 2 ? 'bg-orange-400' : done === 3 ? 'bg-amber-400' : 'bg-green-500';
  const word = done <= 1 ? 'Masih lemah' : done === 2 ? 'Lumayan' : done === 3 ? 'Hampir kuat' : 'Kuat, mantap!';

  return (
    <div className="mt-2.5 rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < done ? barColor : 'bg-gray-200 dark:bg-gray-600'}`} />
        ))}
        <span className={`ml-1 text-[11px] font-bold ${done === 4 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>{word}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {rules.map((r) => (
          <li key={r.label} className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${r.ok ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${r.ok ? 'bg-green-500 text-white' : 'bg-red-100 dark:bg-red-900/40 text-red-500'}`}>
              {r.ok ? <Check className="w-3 h-3" strokeWidth={3} /> : <X className="w-3 h-3" strokeWidth={3} />}
            </span>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

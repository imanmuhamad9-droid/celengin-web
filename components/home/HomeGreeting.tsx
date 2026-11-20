'use client';
import { Flame } from 'lucide-react';

// Sapaan, tanggal hari ini, dan lencana streak hemat (muncul hanya bila ada jatah harian).
export default function HomeGreeting({ name, todayStr, streak, showStreak, onStreakClick }: {
  name: string;
  todayStr: string;
  streak: number;
  showStreak: boolean;
  onStreakClick: () => void;
}) {
  return (
    <div className="flex justify-between items-center">
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">Selamat Datang 👋</p>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white truncate leading-tight">{name}</h2>
        {todayStr && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date(todayStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
      {showStreak && (
        <button onClick={onStreakClick} aria-label="Streak hemat" className="glass glass-teal shrink-0 flex items-center gap-1 border text-xs font-bold px-2.5 py-1.5 rounded-full active:scale-95 transition-transform">
          <Flame className="w-3.5 h-3.5" /> {streak}
        </button>
      )}
    </div>
  );
}

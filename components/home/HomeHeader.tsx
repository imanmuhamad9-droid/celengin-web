'use client';
import { Flame, User } from 'lucide-react';

const greetingByHour = (h: number) => (h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam');

// Header Home: foto profil, sapaan, nama, dan lonceng. Foto profil membuka profil/pengaturan.
export default function HomeHeader({ name, avatarUrl, onAvatarClick, bell, streak, showStreak, onStreakClick }: {
  name: string;
  avatarUrl?: string | null;
  onAvatarClick: () => void;
  bell: React.ReactNode;
  streak: number;
  showStreak: boolean;
  onStreakClick: () => void;
}) {
  const hour = new Date().getHours();
  return (
    <header className="px-5 pt-[calc(env(safe-area-inset-top,0px)+14px)]">
      <div className="flex items-center gap-3">
        <button onClick={onAvatarClick} aria-label="Profil dan pengaturan" className="glass-pressable shrink-0 w-14 h-14 rounded-full overflow-hidden bg-white/70 dark:bg-gray-700 border-2 border-white dark:border-gray-600 shadow-md flex items-center justify-center">
          {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <User className="w-7 h-7 text-gray-400" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[color:var(--text-muted)]">Halo 👋</p>
          <h1 className="text-xl font-extrabold leading-tight truncate" style={{ color: 'var(--text-main)' }}>{name || 'Sobat'}</h1>
          <p className="text-[11px] leading-snug text-[color:var(--text-muted)] line-clamp-2">{greetingByHour(hour)}! Yuk atur uangmu lebih rapi.</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {showStreak && (
            <button onClick={onStreakClick} aria-label="Streak hemat" className="glass glass-teal flex items-center gap-1 border text-xs font-bold px-2.5 h-9 rounded-full active:scale-95 transition-transform">
              <Flame className="w-3.5 h-3.5" /> {streak}
            </button>
          )}
          {bell}
        </div>
      </div>
    </header>
  );
}

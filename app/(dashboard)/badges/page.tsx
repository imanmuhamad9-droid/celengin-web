'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, User } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatDateID } from '@/lib/utils';
import { BADGES, levelFor, fetchBadgeContext, syncBadges, EarnedBadge } from '@/lib/badges';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SkeletonLoader from '@/components/SkeletonLoader';

export default function BadgesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [tableOk, setTableOk] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      const uid = session.user.id;

      // Foto profil + sampul untuk kartu level (kosong bila gagal dimuat -> kartu memakai tampilan polos)
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (prof) setProfile(prof);

      const { data: tx } = await supabase.from('transactions').select('type,amount,transaction_date');
      const { data: targets } = await supabase.from('targets').select('*').eq('user_id', uid);
      const ctx = await fetchBadgeContext(uid, tx || [], targets || []);
      const res = await syncBadges(uid, ctx);

      setProgress(res.progress);
      setEarned(res.earned);
      setTableOk(res.ok);
      setLoading(false);

      if (res.fresh.length > 0) {
        showDialog('Badge Baru! 🏅', res.fresh.map((b) => `${b.emoji} ${b.title}`).join('  ·  '), 'success');
      }
    };
    load();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-[var(--bg-main)]"><SkeletonLoader /></div>;

  const earnedMap: Record<string, string> = {};
  earned.forEach((e) => { earnedMap[e.badge_key] = e.earned_at; });
  const count = earned.length;
  const { current, next } = levelFor(count);
  const toNext = next ? next.min - count : 0;
  const levelPct = next ? ((count - current.min) / (next.min - current.min)) * 100 : 100;

  const sorted = [...BADGES].sort((a, b) => Number(!!earnedMap[b.key]) - Number(!!earnedMap[a.key]));

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-40 transition-colors">
      <AppHeader title="Pencapaian" />

      <main className="px-5 mt-4 space-y-5">
        {!tableOk && <div className="bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-xs p-3 rounded-xl border border-red-100 dark:border-red-800">Tabel user_badges belum ada. Jalankan 01_fitur_baru.sql di Supabase.</div>}

        {/* KARTU LEVEL: foto profil + sampul profil sebagai latar. Lapisan gelap tipis menjaga tulisan tetap terbaca di sampul apa pun. */}
        <div
          className="rounded-3xl p-6 text-white shadow-lg relative overflow-hidden bg-cover bg-center"
          style={{ backgroundColor: profile?.theme_color || '#0f766e', ...(profile?.cover_url ? { backgroundImage: `url(${profile.cover_url})` } : {}) }}
        >
          {profile?.cover_url && <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/45 to-black/60" />}
          <div className="relative z-10 [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/70 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Foto profil" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-white/90" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-white/85 text-xs font-medium">Levelmu</p>
                <h3 className="text-2xl font-extrabold truncate">{current.name}</h3>
                <p className="text-white/85 text-[11px] mt-0.5">{count} dari {BADGES.length} badge diraih</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-black/25 rounded-full h-2 overflow-hidden"><div className="h-2 rounded-full bg-white" style={{ width: `${levelPct}%` }}></div></div>
              <p className="text-white/85 text-[10px] mt-1.5">{next ? `${toNext} badge lagi menuju ${next.emoji} ${next.name}` : 'Level tertinggi tercapai! 🎉'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {sorted.map((b) => {
            const got = earnedMap[b.key];
            const val = Math.min(progress[b.key] || 0, b.target);
            const pct = (val / b.target) * 100;
            return (
              <div key={b.key} className={`glass p-4 rounded-3xl border shadow-sm transition-colors relative ${got ? 'border-teal-200 dark:border-teal-800' : 'border-gray-100 dark:border-gray-700'}`}>
                {got && <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
                <div className={`text-4xl mb-2 transition-all ${got ? '' : 'grayscale opacity-50'}`}>{b.emoji}</div>
                <p className={`font-bold text-sm ${got ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{b.title}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-snug min-h-[28px]">{b.desc}</p>
                {got ? (
                  <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 mt-2">Diraih {formatDateID(got.slice(0, 10))}</p>
                ) : (
                  <div className="mt-2">
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden"><div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${pct}%` }}></div></div>
                    <p className="text-[10px] text-gray-400 mt-1">{val}/{b.target} {b.unit}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}

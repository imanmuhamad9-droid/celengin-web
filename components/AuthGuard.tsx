'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import SkeletonLoader from '@/components/SkeletonLoader';

// Kerangka loading sebelum sesi terbaca mengikuti halaman yang dibuka
const skeletonFor = (path: string) =>
  path === '/dashboard' ? 'home'
  : ['/dream-planner', '/splitbill', '/gantian', '/couple'].includes(path) ? 'cards'
  : path === '/installments' ? 'summary'
  : ['/settings', '/simulasi'].includes(path) ? 'settings'
  : 'list';

// Satu pintu masuk untuk semua halaman dashboard: tanpa sesi, tidak ada halaman yang dirender
// (jadi tidak ada query data yang jalan), dan keluar dari akun di tab lain langsung memindahkan ke /login.
// Ini kenyamanan UX. Keamanan data tetap dijaga RLS di database, bukan oleh komponen ini.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      if (session) setOk(true);
      else router.replace('/login');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) { setOk(false); router.replace('/login'); }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [router]);

  return ok ? <>{children}</> : <SkeletonLoader variant={skeletonFor(pathname)} />;
}

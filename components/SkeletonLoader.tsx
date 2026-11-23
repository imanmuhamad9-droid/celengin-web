// Kerangka loading yang menyusun kotaknya sama dengan halaman aslinya (header di kiri/kanan yang sama,
// kartu setinggi aslinya), supaya tidak ada yang melompat saat data selesai dimuat.
type Variant = 'home' | 'cards' | 'summary' | 'list' | 'settings';

const bone = 'bg-black/[0.08] dark:bg-white/10';
const card = 'rounded-3xl bg-white/55 dark:bg-white/5 border border-white/60 dark:border-white/10';

function Bar({ w, h = 'h-3' }: { w: string; h?: string }) {
  return <div className={`${bone} ${h} ${w} rounded-md`} />;
}

// Sama dengan AppHeader: logo + nama di kiri, tiga tombol bulat di kanan, lalu judul halaman dan tombol ⓘ.
function PageHeader({ withAction = false }: { withAction?: boolean }) {
  return (
    <header className="px-4 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <img src="/icon.png" alt="" width={36} height={36} className="rounded-xl object-contain" />
          <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--text-main)' }}>Celengin</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`${bone} w-9 h-9 rounded-full`} />
          <div className={`${bone} w-9 h-9 rounded-full`} />
          <div className={`${bone} w-9 h-9 rounded-full`} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 min-h-[36px]">
        <div className={`${bone} h-7 w-36 rounded-lg`} />
        <div className="flex items-center gap-2">
          <div className={`${bone} w-9 h-9 rounded-full`} />
          {withAction && <div className={`${bone} h-9 w-24 rounded-full`} />}
        </div>
      </div>
    </header>
  );
}

// Sama dengan HomeHeader: foto profil di kiri, sapaan di tengah, lonceng di kanan.
function HomeHeaderSkeleton() {
  return (
    <header className="px-5 pt-[calc(env(safe-area-inset-top,0px)+14px)]">
      <div className="flex items-center gap-3">
        <div className={`${bone} shrink-0 w-14 h-14 rounded-full`} />
        <div className="flex-1 min-w-0 space-y-2">
          <Bar w="w-10" />
          <Bar w="w-36" h="h-5" />
          <Bar w="w-48" />
        </div>
        <div className={`${bone} shrink-0 w-9 h-9 rounded-full`} />
      </div>
    </header>
  );
}

function RowCard() {
  return (
    <div className={`${card} p-4 flex items-center gap-3`}>
      <div className={`${bone} w-16 h-16 rounded-2xl shrink-0`} />
      <div className="flex-1 space-y-2.5">
        <Bar w="w-1/2" h="h-4" />
        <Bar w="w-1/3" />
        <div className={`${bone} h-2 rounded-full w-full`} />
      </div>
    </div>
  );
}

export default function SkeletonLoader({ variant = 'list' }: { variant?: Variant }) {
  if (variant === 'home') {
    return (
      <div className="max-w-md mx-auto animate-pulse" aria-busy="true" aria-label="Memuat">
        <HomeHeaderSkeleton />
        <main className="px-5 mt-4 space-y-4">
          <div className={`${card} p-5 h-[300px] flex flex-col justify-between`}>
            <div className="space-y-3"><Bar w="w-20" /><Bar w="w-48" h="h-8" /></div>
            <div className="grid grid-cols-2 gap-2.5"><div className={`${bone} h-14 rounded-2xl`} /><div className={`${bone} h-14 rounded-2xl`} /></div>
            <div className={`${bone} h-20 rounded-2xl`} />
          </div>
          <div className={`${card} p-5 h-44 flex flex-col justify-between`}>
            <div className="flex justify-between"><Bar w="w-1/3" h="h-4" /><Bar w="w-1/4" h="h-4" /></div>
            <div className="flex items-end justify-between gap-2 h-24">
              {['h-1/2', 'h-3/4', 'h-1/3', 'h-2/3', 'h-full', 'h-1/2', 'h-1/4'].map((h, i) => <div key={i} className={`${bone} w-full rounded-t-md ${h}`} />)}
            </div>
          </div>
          <div className="flex gap-2.5">
            {[0, 1, 2, 3].map((i) => <div key={i} className={`${card} shrink-0 w-[84px] h-[100px]`} />)}
          </div>
          <div className="space-y-3">
            <Bar w="w-1/3" h="h-5" />
            {[0, 1, 2].map((i) => <div key={i} className={`${card} h-16`} />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto animate-pulse" aria-busy="true" aria-label="Memuat">
      <PageHeader withAction={variant === 'cards'} />
      <main className="px-5 mt-4 space-y-4">
        {variant === 'cards' && (
          <>
            <div className="rounded-3xl h-[140px] bg-sky-200/50 dark:bg-white/5" />
            <RowCard /><RowCard /><RowCard />
          </>
        )}
        {variant === 'summary' && (
          <>
            <div className="rounded-3xl h-[150px] bg-sky-300/50 dark:bg-white/10" />
            {[0, 1].map((i) => (
              <div key={i} className={`${card} p-5 space-y-4`}>
                <div className="flex justify-between"><div className="space-y-2"><Bar w="w-32" h="h-4" /><Bar w="w-44" /></div><div className={`${bone} h-6 w-20 rounded-full`} /></div>
                <div className="flex justify-between items-end"><div className="space-y-2"><Bar w="w-20" /><Bar w="w-32" h="h-6" /></div><Bar w="w-20" h="h-5" /></div>
              </div>
            ))}
          </>
        )}
        {variant === 'list' && (
          <>
            <div className="flex gap-2"><div className={`${bone} h-9 w-24 rounded-full`} /><div className={`${bone} h-9 w-32 rounded-full`} /></div>
            <div className={`${card} p-5 space-y-3`}><Bar w="w-24" /><Bar w="w-44" h="h-8" /></div>
            <div className={`${card} p-4 space-y-4`}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`${bone} w-11 h-11 rounded-2xl shrink-0`} />
                  <div className="flex-1 space-y-2"><Bar w="w-1/2" h="h-4" /><Bar w="w-1/3" /></div>
                  <Bar w="w-16" h="h-4" />
                </div>
              ))}
            </div>
          </>
        )}
        {variant === 'settings' && (
          <>
            <div className={`${card} p-5 flex items-center gap-4`}>
              <div className={`${bone} w-16 h-16 rounded-full shrink-0`} />
              <div className="flex-1 space-y-2"><Bar w="w-32" h="h-5" /><Bar w="w-20" /></div>
            </div>
            {[3, 4, 2].map((n, g) => (
              <div key={g} className="space-y-2">
                <Bar w="w-20" />
                <div className={`${card} divide-y divide-black/[0.06] dark:divide-white/10`}>
                  {Array.from({ length: n }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                      <div className={`${bone} w-10 h-10 rounded-2xl shrink-0`} />
                      <div className="flex-1 space-y-2"><Bar w="w-1/2" h="h-4" /><Bar w="w-2/3" /></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

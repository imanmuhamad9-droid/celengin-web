'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, toLocalDateStr } from '@/lib/utils';
import { useCatatAction } from '@/lib/catatAction';
import { emptyData, levelOf, parseSimData, totalsFor, type SimData } from '@/lib/simulasi';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import CustomDialog from '@/components/CustomDialog';
import GlassCard from '@/components/GlassCard';
import SkeletonLoader from '@/components/SkeletonLoader';
import { SqlNotice } from '@/components/FinUI';
import PlanEditor from '@/components/simulasi/PlanEditor';

interface SimRecord { id: string; name: string; data: unknown; updated_at: string | null }
interface Draft { id: string | null; name: string; data: SimData }

const monthName = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const snap = (d: Draft) => JSON.stringify([d.name, d.data]);

export default function SimulasiPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [tableOk, setTableOk] = useState(true);
  const [sims, setSims] = useState<SimRecord[]>([]);
  const [cur, setCur] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(''); // snapshot terakhir yang tersimpan, untuk tahu ada perubahan atau tidak
  const [saving, setSaving] = useState(false);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((p) => ({ ...p, isOpen: false }));

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    setUserId(session.user.id);
    setCur(toLocalDateStr(new Date()).slice(0, 7));
    const r = await supabase.from('simulations').select('id,name,data,updated_at').order('updated_at', { ascending: false });
    setTableOk(!r.error);
    if (!r.error) setSims((r.data || []) as SimRecord[]);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const startNew = () => {
    const d: Draft = { id: null, name: `Rencana ${monthName(cur)}`, data: emptyData(cur) };
    setDraft(d);
    setSaved('');
  };
  useCatatAction('Rencana', 'Buat rencana baru', startNew);

  const open = (s: SimRecord) => {
    const d: Draft = { id: s.id, name: s.name, data: parseSimData(s.data, cur) };
    setDraft(d);
    setSaved(snap(d));
  };

  const dirty = draft !== null && snap(draft) !== saved;

  const leave = () => {
    if (!draft) return;
    if (!dirty) { setDraft(null); return; }
    showDialog('Keluar tanpa menyimpan?', 'Perubahan di rencana ini belum disimpan.', 'danger', () => setDraft(null));
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    const row = { name: draft.name.trim() || 'Rencana tanpa nama', data: draft.data, updated_at: new Date().toISOString() };
    const res = draft.id
      ? await supabase.from('simulations').update(row).eq('id', draft.id).select('id').single()
      : await supabase.from('simulations').insert({ ...row, user_id: userId }).select('id').single();
    setSaving(false);
    if (res.error || !res.data) { showDialog('Gagal menyimpan', res.error?.message || 'Coba lagi.', 'danger'); return; }
    const next = { ...draft, id: res.data.id as string, name: row.name };
    setDraft(next);
    setSaved(snap(next));
    void load();
  };

  const duplicate = async (s: SimRecord) => {
    const { error } = await supabase.from('simulations').insert({ user_id: userId, name: `${s.name} (salinan)`, data: s.data });
    if (error) showDialog('Gagal menyalin', error.message, 'danger');
    else void load();
  };

  const remove = (s: SimRecord) =>
    showDialog('Hapus rencana?', `"${s.name}" akan dihapus permanen.`, 'danger', async () => {
      const { error } = await supabase.from('simulations').delete().eq('id', s.id);
      if (error) showDialog('Gagal menghapus', error.message, 'danger');
      else void load();
    });

  if (loading) return <div className="min-h-screen bg-[var(--page-bg)]"><SkeletonLoader /></div>;

  return (
    <div className="min-h-screen bg-[var(--page-bg)] pb-40 transition-colors">
      <AppHeader title="Simulasi" onBack={draft ? leave : undefined} />

      <main className="max-w-md mx-auto px-4 mt-3 space-y-4">
        {!tableOk && <SqlNotice file="sql/08_simulasi.sql" />}

        {tableOk && !draft && (
          <>
            <button type="button" onClick={startNew} className="glass glass-solid-teal w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" strokeWidth={2.6} /> Buat rencana baru
            </button>

            {sims.length === 0 && (
              <p className="text-xs px-1 text-[color:var(--text-muted)]">Belum ada rencana. Buat satu untuk menghitung gajimu dikurangi cicilan, tagihan, dan utang.</p>
            )}

            {sims.map((s) => {
              const d = parseSimData(s.data, cur);
              const t = totalsFor(d.rows, d.month);
              const lv = levelOf(t);
              return (
                <GlassCard key={s.id}>
                  <button type="button" onClick={() => open(s)} className="w-full text-left">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>{s.name}</p>
                    <p className="text-[11px] text-[color:var(--text-muted)]">Mulai {monthName(d.month)} · {d.rows.length} baris</p>
                    <p className="text-[11px] mt-2 text-[color:var(--text-muted)]">Sisa bulan pertama</p>
                    <p className="text-xl font-extrabold" style={{ color: lv === 'negative' ? '#ef4444' : lv === 'thin' ? '#f59e0b' : 'var(--text-main)' }}>{t.left < 0 ? '-' : ''}{formatRupiah(Math.abs(t.left))}</p>
                  </button>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/[0.07] dark:border-white/10">
                    <p className="text-[10px] text-[color:var(--text-muted)]">{s.updated_at ? `Diubah ${new Date(s.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => void duplicate(s)} aria-label="Salin rencana" className="text-[color:var(--text-muted)]"><Copy className="w-4 h-4" /></button>
                      <button type="button" onClick={() => remove(s)} aria-label="Hapus rencana" className="text-[color:var(--text-muted)]"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </>
        )}

        {tableOk && draft && (
          <>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Nama rencana"
              aria-label="Nama rencana"
              className="glass w-full h-11 px-4 rounded-2xl text-base font-extrabold outline-none focus:ring-2 focus:ring-[color:var(--teal-primary)] text-[color:var(--text-main)]"
            />
            <PlanEditor data={draft.data} onChange={(data) => setDraft({ ...draft, data })} userId={userId} showDialog={showDialog} />
            <div className="sticky z-[45] flex gap-2" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}>
              <button type="button" onClick={() => void save()} disabled={saving || !dirty} className="glass glass-solid-teal flex-1 h-12 rounded-2xl font-bold text-sm disabled:opacity-50">
                {saving ? 'Menyimpan...' : dirty ? 'Simpan rencana' : 'Tersimpan ✓'}
              </button>
            </div>
          </>
        )}
      </main>

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}

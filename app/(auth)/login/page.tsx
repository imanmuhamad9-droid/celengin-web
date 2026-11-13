'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, X, Mail, Lock } from 'lucide-react';
import AuthShell, { authLabel, authInput, authBorder, authBtn, authBtnSoft, authIcon, authEye } from '@/components/AuthShell';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [needVerify, setNeedVerify] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState({ text: '', type: 'success' });
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setNeedVerify(false);
    setResendMsg('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) setErrorMsg('Email atau Password salah.');
      else if (error.message.toLowerCase().includes('email not confirmed')) {
        setErrorMsg('Email kamu belum diverifikasi. Cek inbox (atau folder spam), lalu klik link verifikasi dari Celengin.');
        setNeedVerify(true);
      } else setErrorMsg(error.message);
    } else router.push('/dashboard');
    setLoading(false);
  };

  const handleResendVerify = async () => {
    setResendMsg('');
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResendMsg(error ? error.message : 'Email verifikasi dikirim ulang. Cek inbox kamu.');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true); setResetMsg({ text: '', type: 'success' });
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: `${window.location.origin}/update-password` });
    if (error) setResetMsg({ text: error.message, type: 'error' });
    else setResetMsg({ text: 'Link reset password telah dikirim ke email kamu!', type: 'success' });
    setResetLoading(false);
  };

  return (
    <>
      <AuthShell
        title="Selamat Datang Kembali"
        subtitle="Masuk ke Celengin."
        footer={<>Belum punya akun? <Link href="/register" className="text-teal-600 dark:text-teal-400 font-bold hover:underline">Daftar di sini</Link></>}
      >
        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs p-3 rounded-2xl mb-4 border border-red-100 dark:border-red-800/40">
            {errorMsg}
            {needVerify && (
              <button type="button" onClick={handleResendVerify} className="block mt-2 font-bold underline">Kirim ulang email verifikasi</button>
            )}
            {resendMsg && <p className="mt-1.5 font-semibold text-gray-700 dark:text-gray-300">{resendMsg}</p>}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className={authLabel}>Email</label>
            <div className="relative">
              <Mail className={authIcon} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${authInput} ${authBorder} pr-4`} placeholder="kamu@email.com" autoComplete="email" required />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Password</label>
              <button type="button" onClick={() => setIsResetModalOpen(true)} className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline">Lupa Password?</button>
            </div>
            <div className="relative">
              <Lock className={authIcon} />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className={`${authInput} ${authBorder} pr-12`} placeholder="Password kamu" autoComplete="current-password" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} className={authEye}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className={`${authBtn} mt-2`}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </AuthShell>

      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] w-full max-w-sm p-6 relative border border-gray-100 dark:border-gray-700 shadow-2xl">
            <button onClick={() => setIsResetModalOpen(false)} aria-label="Tutup" className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white text-center">Lupa Password?</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 mb-4">Masukkan email kamu, nanti kami kirim link untuk membuat password baru.</p>
            {resetMsg.text && <div className={`text-xs p-3 rounded-2xl mb-4 border ${resetMsg.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/40' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800/40'}`}>{resetMsg.text}</div>}
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="relative">
                <Mail className={authIcon} />
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required className={`${authInput} ${authBorder} pr-4`} placeholder="Email terdaftar" autoComplete="email" />
              </div>
              <button type="submit" disabled={resetLoading} className={authBtn}>
                {resetLoading ? 'Mengirim...' : 'Kirim Link Reset'}
              </button>
              <button type="button" onClick={() => setIsResetModalOpen(false)} className={authBtnSoft}>Batal</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

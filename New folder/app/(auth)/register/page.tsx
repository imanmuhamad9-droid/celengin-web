'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import PasswordRequirements from '@/components/PasswordRequirements';
import AuthShell, { authLabel, authInput, authBorder, authBorderOk, authBorderErr, authBtn, authBtnSoft, authIcon, authEye } from '@/components/AuthShell';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [isNicknameAvailable, setIsNicknameAvailable] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sent, setSent] = useState(false); // sudah daftar, menunggu verifikasi email (hanya bila verifikasi aktif di Supabase)
  const [created, setCreated] = useState(false); // sudah daftar dan langsung aktif (verifikasi email dimatikan)
  const [cooldown, setCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState('');
  const router = useRouter();

  const isPasswordValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);

  useEffect(() => {
    if (nickname.length < 3) { setIsNicknameAvailable(null); return; }
    const checkNickname = async () => {
      setIsCheckingNickname(true);
      const { data } = await supabase.from('profiles').select('nickname').eq('nickname', nickname).single();
      setIsNicknameAvailable(!data);
      setIsCheckingNickname(false);
    };
    const timer = setTimeout(checkNickname, 500);
    return () => clearTimeout(timer);
  }, [nickname]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!isNicknameAvailable) return setErrorMsg('Nickname sudah dipakai.');
    if (!isPasswordValid) return setErrorMsg('Password belum memenuhi syarat.');

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname: nickname }, emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) setErrorMsg(error.message);
    else if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      // Supabase tidak memberi error untuk email yang sudah terdaftar; ini cirinya.
      setErrorMsg('Email ini sudah terdaftar. Silakan masuk, atau pakai Lupa Password bila lupa.');
    } else if (data?.session) {
      // Verifikasi email dimatikan di Supabase: akun langsung aktif. Keluarkan sesi otomatis,
      // lalu minta pengguna masuk sendiri supaya alurnya jelas.
      await supabase.auth.signOut();
      setCreated(true);
    } else {
      setSent(true);
      setCooldown(60);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResendMsg('');
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResendMsg(error ? error.message : 'Email verifikasi dikirim ulang.');
    setCooldown(60);
  };

  if (created) {
    return (
      <AuthShell
        title="Akun berhasil dibuat"
        subtitle="Akunmu sudah terdaftar. Silakan masuk untuk mulai memakai Celengin."
        icon={<div className="w-16 h-16 mb-4 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" /></div>}
      >
        <button onClick={() => router.push('/login')} className={authBtn}>Masuk Sekarang</button>
      </AuthShell>
    );
  }

  if (sent) {
    return (
      <AuthShell
        title="Cek emailmu dulu ya"
        subtitle="Satu langkah lagi sebelum bisa masuk."
        icon={<div className="w-16 h-16 mb-4 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center"><Mail className="w-8 h-8 text-teal-600 dark:text-teal-400" /></div>}
        footer={<>Sudah verifikasi? <Link href="/login" className="text-teal-600 dark:text-teal-400 font-bold hover:underline">Masuk di sini</Link></>}
      >
        <div className="rounded-2xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 p-4 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
          Kami sudah mengirim link verifikasi ke <span className="font-bold text-gray-900 dark:text-white break-all">{email}</span>. Klik link di email itu untuk mengaktifkan akun. <span className="font-bold">Kamu belum bisa masuk sebelum email diverifikasi.</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">Tidak ketemu? Cek folder Spam atau Promosi.</p>
        {resendMsg && <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 mt-2 text-center">{resendMsg}</p>}
        <div className="space-y-3 mt-5">
          <button onClick={handleResend} disabled={cooldown > 0} className={authBtnSoft}>
            {cooldown > 0 ? `Kirim ulang email (${cooldown}d)` : 'Kirim ulang email'}
          </button>
          <button onClick={() => router.push('/login')} className={authBtn}>Ke Halaman Masuk</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Daftar Celengin"
      subtitle="Mulai atur uangmu dengan santai."
      footer={<>Sudah punya akun? <Link href="/login" className="text-teal-600 dark:text-teal-400 font-bold hover:underline">Masuk di sini</Link></>}
    >
      {errorMsg && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs p-3 rounded-2xl mb-4 border border-red-100 dark:border-red-800/40">{errorMsg}</div>}

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className={authLabel}>Nama Panggilan (Nickname)</label>
          <div className="relative">
            <User className={authIcon} />
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s/g, ''))} className={`${authInput} pr-11 ${isNicknameAvailable === false ? authBorderErr : isNicknameAvailable === true ? authBorderOk : authBorder}`} placeholder="cth: iman123" autoComplete="username" required />
            {nickname.length >= 3 && <div className="absolute right-3 top-1/2 -translate-y-1/2">{isCheckingNickname ? <span className="text-xs text-gray-400">Cek...</span> : isNicknameAvailable ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}</div>}
          </div>
          {nickname.length >= 3 && !isCheckingNickname && isNicknameAvailable === false && <p className="text-xs text-red-500 mt-1">Nickname sudah dipakai.</p>}
          {nickname.length >= 3 && !isCheckingNickname && isNicknameAvailable === true && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Nickname tersedia.</p>}
        </div>
        <div>
          <label className={authLabel}>Email</label>
          <div className="relative">
            <Mail className={authIcon} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${authInput} ${authBorder} pr-4`} placeholder="kamu@email.com" autoComplete="email" required />
          </div>
        </div>
        <div>
          <label className={authLabel}>Password</label>
          <div className="relative">
            <Lock className={authIcon} />
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className={`${authInput} ${authBorder} pr-12`} placeholder="Buat password kuat" autoComplete="new-password" required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} className={authEye}>{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
          </div>
          {password.length > 0 && <PasswordRequirements password={password} />}
        </div>
        <button type="submit" disabled={loading || !isPasswordValid || !isNicknameAvailable} className={`${authBtn}mt-2`}>
          {loading ? 'Memproses...' : 'Daftar Sekarang'}
        </button>
      </form>
    </AuthShell>
  );
}

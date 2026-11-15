'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { KeyRound, Eye, EyeOff, Lock } from 'lucide-react';
import PasswordRequirements from '@/components/PasswordRequirements';
import AuthShell, { authLabel, authInput, authBorder, authBorderOk, authBorderErr, authBtn, authIcon, authEye } from '@/components/AuthShell';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: 'error' });
  const router = useRouter();

  const isPasswordValid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) return setMsg({ text: 'Password belum memenuhi syarat.', type: 'error' });

    setLoading(true);
    setMsg({ text: '', type: 'error' });

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMsg({ text: error.message, type: 'error' });
    } else {
      setMsg({ text: 'Password berhasil diubah! Silakan login kembali.', type: 'success' });
      setTimeout(() => router.push('/login'), 2000);
    }
    setLoading(false);
  };

  return (
    <AuthShell
      title="Buat Password Baru"
      subtitle="Pilih password yang kuat dan mudah kamu ingat."
      icon={<div className="w-16 h-16 mb-4 rounded-2xl bg-teal-600 flex items-center justify-center shadow-md"><KeyRound className="w-8 h-8 text-white" /></div>}
    >
      {msg.text && (
        <div className={`text-xs p-3 rounded-2xl mb-4 border ${msg.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/40' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800/40'}`}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label className={authLabel}>Password Baru</label>
          <div className="relative">
            <Lock className={authIcon} />
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className={`${authInput} ${authBorder} pr-12`} placeholder="Buat password kuat" autoComplete="new-password" required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} className={authEye}>
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {password.length > 0 && <PasswordRequirements password={password} />}
        </div>

        <button type="submit" disabled={loading || !isPasswordValid} className={`${authBtn}mt-2`}>
          {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
        </button>
      </form>
    </AuthShell>
  );
}

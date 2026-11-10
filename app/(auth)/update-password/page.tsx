'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import PasswordRequirements from '@/components/PasswordRequirements';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: 'error' });
  const router = useRouter();

  const isPasswordValid = 
    password.length >= 8 && 
    /[A-Z]/.test(password) && 
    /[0-9]/.test(password) && 
    /[^A-Za-z0-9]/.test(password);
  const isMatch = password === confirmPassword && password !== '';

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) return setMsg({ text: 'Password belum memenuhi syarat.', type: 'error' });
    if (!isMatch) return setMsg({ text: 'Konfirmasi password tidak cocok.', type: 'error' });

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-teal-500 p-3 rounded-2xl mb-4">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Buat Password Baru</h1>
        </div>

        {msg.text && (
          <div className={`text-xs p-3 rounded-xl mb-4 border ${msg.type === 'error' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 text-gray-900" 
                placeholder="Buat password kuat" 
                required 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password.length > 0 && <PasswordRequirements password={password} />}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ulangi Password Baru</label>
            <input 
              type={showPassword ? "text" : "password"} 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-teal-500 text-gray-900 ${confirmPassword.length > 0 && !isMatch ? 'border-red-400' : 'border-gray-200'}`} 
              placeholder="Ketik ulang password" 
              required 
            />
            {confirmPassword.length > 0 && !isMatch && <p className="text-xs text-red-500 mt-1">Password tidak cocok.</p>}
          </div>

          <button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-all mt-4 disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
          </button>
        </form>
      </div>
    </div>
  );
}
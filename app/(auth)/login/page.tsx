'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wallet, Eye, EyeOff, X, Mail } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // State Lupa Password
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState({ text: '', type: 'success' });

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrorMsg('Email atau Password salah. Pastikan keduanya sudah benar.');
      } else {
        setErrorMsg(error.message);
      }
    } else {
      router.push('/dashboard');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMsg({ text: '', type: 'success' });

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/update-password`, // Arahkan ke halaman update password
    });

    if (error) {
      setResetMsg({ text: error.message, type: 'error' });
    } else {
      setResetMsg({ text: 'Link reset password telah dikirim ke email kamu!', type: 'success' });
    }
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-teal-500 p-3 rounded-2xl mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Selamat Datang Kembali</h1>
          <p className="text-gray-500 text-sm mt-1">Masuk ke Celengin.</p>
        </div>

        {errorMsg && <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl mb-4 border border-red-100">{errorMsg}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 text-gray-900" placeholder="kamu@email.com" required />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <button type="button" onClick={() => setIsResetModalOpen(true)} className="text-xs font-semibold text-teal-600 hover:underline">Lupa Password?</button>
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 text-gray-900" 
                placeholder="Password kamu" 
                required 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-all mt-4 disabled:opacity-50">
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Belum punya akun? <Link href="/register" className="text-teal-600 font-semibold hover:underline">Daftar di sini</Link>
        </p>
      </div>

      {/* MODAL LUPA PASSWORD */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 relative">
            <button onClick={() => setIsResetModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">Lupa Password?</h2>
            <p className="text-xs text-center text-gray-500 mb-4">Masukkan email kamu, kami akan mengirimkan link untuk mereset password.</p>
            
            {resetMsg.text && (
              <div className={`text-xs p-3 rounded-xl mb-4 border ${resetMsg.type === 'error' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                {resetMsg.text}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500" placeholder="Email terdaftar" />
              </div>
              <button type="submit" disabled={resetLoading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all mt-2 disabled:opacity-50">
                {resetLoading ? 'Mengirim...' : 'Kirim Link Reset'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
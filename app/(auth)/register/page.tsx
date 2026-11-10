'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wallet, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import PasswordRequirements from '@/components/PasswordRequirements';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // State Cek Nickname
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [isNicknameAvailable, setIsNicknameAvailable] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const isPasswordValid = 
    password.length >= 8 && 
    /[A-Z]/.test(password) && 
    /[0-9]/.test(password) && 
    /[^A-Za-z0-9]/.test(password);
    
  const isMatch = password === confirmPassword && password !== '';

  // Efek untuk cek nickname ke database (debounce)
  useEffect(() => {
    if (nickname.length < 3) {
      setIsNicknameAvailable(null);
      return;
    }

    const checkNickname = async () => {
      setIsCheckingNickname(true);
      const { data } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('nickname', nickname)
        .single();
      
      setIsNicknameAvailable(!data);
      setIsCheckingNickname(false);
    };

    const timer = setTimeout(checkNickname, 500);
    return () => clearTimeout(timer);
  }, [nickname]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isNicknameAvailable) return setErrorMsg('Nickname sudah dipakai atau belum valid.');
    if (!isPasswordValid) return setErrorMsg('Password belum memenuhi syarat.');
    if (!isMatch) return setErrorMsg('Konfirmasi password tidak cocok.');

    setLoading(true);
    
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: { nickname: nickname }
      }
    });
    
    if (error) {
      setErrorMsg(error.message);
    } else {
      setTimeout(() => {
        alert('Registrasi berhasil! Silakan login.');
        router.push('/login');
      }, 1000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-teal-500 p-3 rounded-2xl mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Celengin</h1>
        </div>

        {errorMsg && <div className="bg-red-50 text-red-500 text-xs p-3 rounded-xl mb-4 border border-red-100">{errorMsg}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* Input Nickname */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Panggilan (Nickname)</label>
            <div className="relative">
              <input 
                type="text" 
                value={nickname} 
                onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s/g, ''))} 
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-teal-500 text-gray-900 ${isNicknameAvailable === false ? 'border-red-400' : isNicknameAvailable === true ? 'border-green-400' : 'border-gray-200'}`} 
                placeholder="cth: abc123" 
                required 
              />
              {nickname.length >= 3 && (
                <div className="absolute right-3 top-3">
                  {isCheckingNickname ? (
                    <span className="text-xs text-gray-400">Cek...</span>
                  ) : isNicknameAvailable ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              )}
            </div>
            {isNicknameAvailable === false && <p className="text-[10px] text-red-500 mt-1">Nickname sudah dipakai, cari yang lain.</p>}
            {isNicknameAvailable === true && <p className="text-[10px] text-green-500 mt-1">Nickname tersedia!</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 text-gray-900" placeholder="kamu@email.com" required />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Ulangi Password</label>
            <div className="relative">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className={`w-full pl-4 pr-12 py-3 rounded-xl border focus:ring-2 focus:ring-teal-500 text-gray-900 ${confirmPassword.length > 0 && !isMatch ? 'border-red-400' : 'border-gray-200'}`} 
                placeholder="Ketik ulang password" 
                required 
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !isMatch && <p className="text-xs text-red-500 mt-1">Password tidak cocok.</p>}
          </div>

          <button type="submit" disabled={loading || !isPasswordValid || !isMatch || !isNicknameAvailable} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-all mt-4 disabled:opacity-50">
            {loading ? 'Memproses...' : 'Daftar Sekarang'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Sudah punya akun? <Link href="/login" className="text-teal-600 font-semibold hover:underline">Masuk di sini</Link>
        </p>
      </div>
    </div>
  );
}
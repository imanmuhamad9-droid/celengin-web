import Link from 'next/link';
import { Wallet, Sparkles, TrendingUp } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex flex-col items-center justify-center p-6 text-center">
      
      {/* Icon */}
      <div className="bg-teal-500 p-4 rounded-3xl mb-6 shadow-lg shadow-teal-200">
        <Wallet className="w-12 h-12 text-white" />
      </div>

      {/* Brand & Tagline */}
      <h1 className="text-5xl font-extrabold text-teal-900 tracking-tight mb-4">
        Celengin<span className="text-teal-500">.</span>
      </h1>
      <p className="text-gray-500 text-lg max-w-md mb-10">
        Cara paling aesthetic buat nyatet pengeluaran, nabung buat konser, dan pantau keuanganmu tanpa ribet.
      </p>

      {/* Fitur Singkat */}
      <div className="flex flex-col sm:flex-row gap-4 mb-12 max-w-2xl w-full justify-center">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center flex-1">
          <Sparkles className="w-8 h-8 text-teal-500 mb-3" />
          <h3 className="font-bold text-gray-800 mb-1">AI Scanner</h3>
          <p className="text-sm text-gray-500 text-center">Foto struk belanja, langsung auto-catat.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center flex-1">
          <TrendingUp className="w-8 h-8 text-teal-500 mb-3" />
          <h3 className="font-bold text-gray-800 mb-1">Dream Planner</h3>
          <p className="text-sm text-gray-500 text-center">Nabung buat target impian pakai progress bar.</p>
        </div>
      </div>

      {/* Tombol Mulai */}
      <div className="flex gap-4">
        <Link 
          href="/register" 
          className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-lg shadow-teal-200"
        >
          Mulai Nabung
        </Link>
        <Link 
          href="/login" 
          className="bg-white hover:bg-gray-50 text-teal-700 border-2 border-teal-100 px-8 py-3 rounded-full font-semibold transition-all"
        >
          Masuk
        </Link>
      </div>
    </div>
  );
}
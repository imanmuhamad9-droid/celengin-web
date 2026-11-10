'use client';
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Upload, Loader2 } from 'lucide-react';

export default function ReceiptScannerModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({ merchant: '', amount: 0, category: '', date: '' });
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
      const base64 = (reader.result as string).split(',')[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!imageBase64) return;
    setLoading(true);
    try {
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg' })
      });
      const json = await res.json();
      if (json.success) {
        setFormData(json.data);
        alert('Struk berhasil dipindai! Silakan cek kembali datanya.');
      } else {
        alert('Gagal membaca struk. Coba foto yang lebih terang.');
      }
    } catch (error) {
      alert('Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Simpan ke tabel transaksi
      const { error } = await supabase.from('transactions').insert({
        user_id: session.user.id,
        merchant_name: formData.merchant,
        amount: formData.amount,
        type: 'expense', // Default pengeluaran
        transaction_date: formData.date || new Date().toISOString().split('T')[0],
        is_ai_scanned: true
      });

      if (error) throw error;
      
      alert('Transaksi berhasil disimpan!');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert('Gagal menyimpan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Scan Struk AI</h2>

        {!preview ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-teal-200 bg-teal-50 rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-teal-100 transition-colors"
          >
            <Upload className="w-8 h-8 text-teal-500 mb-2" />
            <p className="text-sm text-teal-700 font-semibold">Upload Foto Struk</p>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          </div>
        ) : (
          <div className="space-y-4">
            <img src={preview} alt="Preview" className="w-full h-40 object-cover rounded-xl border" />
            
            {formData.merchant ? (
              <div className="space-y-3">
                <input type="text" value={formData.merchant} onChange={(e) => setFormData({...formData, merchant: e.target.value})} className="w-full p-3 border rounded-xl" placeholder="Nama Toko" />
                <input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} className="w-full p-3 border rounded-xl" placeholder="Nominal" />
                <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-3 border rounded-xl" />
                <button onClick={handleSave} disabled={loading} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold">
                  {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            ) : (
              <button onClick={handleScan} disabled={loading} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Mulai Scan AI'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
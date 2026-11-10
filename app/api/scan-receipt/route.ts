import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Gambar tidak ditemukan' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    // Menggunakan model Gemini 2.0 Flash (lebih stabil untuk free tier saat ini)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const promptText = `Analisis gambar struk/screenshot pembayaran ini. 
Ekstrak data dalam format JSON murni tanpa markdown/backticks:
{
  "merchant": "nama merchant/toko",
  "amount": total_nominal_angka_tanpa_rp_atau_titik,
  "category": "tebak satu dari: Makanan, Transportasi, Belanja, Hiburan, Tagihan, Lainnya",
  "date": "YYYY-MM-DD"
}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } }
          ]
        }]
      })
    });

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    const cleanedJson = JSON.parse(rawText.replace(/```json|```/g, '').trim());

    return NextResponse.json({ success: true, data: cleanedJson });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal memproses OCR Struk' }, { status: 500 });
  }
}
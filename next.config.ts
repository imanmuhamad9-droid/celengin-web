import type { NextConfig } from "next";

// CSP penuh dipasang dulu sebagai Report-Only: pelanggaran muncul di Console browser tanpa memblokir apa pun.
// Setelah dipakai beberapa hari tanpa pelanggaran, pindahkan isinya ke header Content-Security-Policy.
// Sumber di luar situs: Supabase (data, auth, storage) dan jsDelivr (mesin OCR Tesseract).
const reportOnlyCsp = [
  "default-src 'self'",
  // 'unsafe-inline' dibutuhkan skrip tema di app/layout.tsx dan skrip internal Next.js (belum memakai nonce).
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://tessdata.projectnaptha.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Bagian CSP yang aman dipaksa sekarang (tidak memengaruhi skrip/gambar): anti-clickjacking dan anti-injeksi tag.
const enforcedCsp = "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const securityHeaders = [
  { key: "Content-Security-Policy", value: enforcedCsp },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kamera dipakai untuk foto struk (input capture); mikrofon dan lokasi tidak dipakai.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

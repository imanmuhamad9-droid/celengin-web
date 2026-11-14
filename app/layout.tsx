import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";
import MoneyRain from "@/components/MoneyRain";
import AutoRefresh from "@/components/AutoRefresh";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Celengin - Financial Tracker",
  description: "Aplikasi pencatat keuangan Gen Z.",
  manifest: "/manifest.webmanifest",
  applicationName: "Celengin",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Celengin",
  },
  icons: {
    apple: "/icon.png", // Pastikan file icon.png ada di folder public
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // cegah Safari iPhone zoom otomatis saat mengetuk kolom input
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                let size = localStorage.getItem('ui-size');
                if (size === 'kecil' || size === 'besar') document.documentElement.setAttribute('data-size', size);
                let accent = localStorage.getItem('ui-accent');
                if (accent === 'silver' || accent === 'abu' || accent === 'biru') document.documentElement.setAttribute('data-accent', accent);
                let btn = localStorage.getItem('ui-btn');
                if (btn === 'soft') document.documentElement.setAttribute('data-btn', 'soft');
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={`${jakarta.className} bg-[#faf8ff] dark:bg-gray-950 text-gray-800 dark:text-gray-100 antialiased transition-colors duration-300`}>
        <PwaRegister />
        <AutoRefresh />
        <MoneyRain />
        <div className="mx-auto max-w-md min-h-screen shadow-2xl relative transition-colors duration-300 bg-[#faf8ff] dark:bg-gray-950">
          {children}
        </div>
      </body>
    </html>
  );
}

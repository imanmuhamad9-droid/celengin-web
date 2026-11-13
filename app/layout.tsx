import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";
import MoneyRain from "@/components/MoneyRain";

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
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={`${jakarta.className} bg-[#faf8ff] dark:bg-gray-950 text-gray-800 dark:text-gray-100 antialiased transition-colors duration-300`}>
        <PwaRegister />
        <MoneyRain />
        <div className="mx-auto max-w-md min-h-screen shadow-2xl relative transition-colors duration-300 bg-[#faf8ff] dark:bg-gray-950">
          {children}
        </div>
      </body>
    </html>
  );
}

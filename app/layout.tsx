import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Celengin - Financial Tracker",
  description: "Aplikasi pencatat keuangan Gen Z.",
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
      <body className={`${jakarta.className} bg-[#faf8ff] dark:bg-[#0f172a] text-gray-800 dark:text-gray-100 antialiased transition-colors duration-300`}>
        <div className="mx-auto max-w-md min-h-screen shadow-2xl relative transition-colors duration-300 bg-[#faf8ff] dark:bg-[#0f172a]">
          {children}
        </div>
      </body>
    </html>
  );
}
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"], 
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "우리동네 양심치과",
  description: "과잉진료 없는 양심치과를 찾아드립니다",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} min-h-screen bg-[#F8FAFF]`}>
        <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-100/50 dark:border-slate-700/50 sticky top-0 z-10" style={{boxShadow: '0 2px 20px rgba(99,102,241,0.06)'}}>
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
            <a href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                <span className="text-lg">🦷</span>
              </div>
              <span className="font-extrabold text-slate-900 dark:text-white tracking-tight">우리동네 양심치과</span>
            </a>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

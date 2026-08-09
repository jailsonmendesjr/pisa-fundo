import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { FlagTriangleRight } from "lucide-react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Pisa Fundo – Campeonato de Kart",
  description: "Acompanhe os rankings, resultados e classificação do campeonato de kart amador Pisa Fundo.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className={`${inter.className} min-h-screen bg-slate-50 text-slate-950 flex flex-col`}>
        {/* Header/Navbar */}
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950 text-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex min-w-0 items-center gap-2 font-bold tracking-wide text-white">
              <span className="truncate text-base sm:text-lg">PISA FUNDO KART</span>
              <FlagTriangleRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
            </Link>
            <nav className="flex items-center gap-4 sm:gap-6">
              <Link href="/" className="text-sm font-medium text-slate-200 transition-colors hover:text-white">
                Temporadas
              </Link>
              <Link href="/admin" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
                Admin
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-slate-950 text-center py-6 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Pisa Fundo. Todos os direitos reservados.</p>
        </footer>
      </body>
    </html>
  );
}

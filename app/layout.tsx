import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="pt-BR">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex flex-col`}>
        {/* Header/Navbar */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black tracking-wider text-amber-500 italic">
                PISA FUNDO
              </span>
              <span className="text-[10px] tracking-widest bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-bold border border-amber-500/20 uppercase">
                Kart
              </span>
            </div>
            <nav className="flex items-center gap-6">
              <a href="/" className="text-sm font-semibold text-slate-300 hover:text-amber-500 transition-colors">
                Temporadas
              </a>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950 text-center py-6 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Pisa Fundo. Todos os direitos reservados.</p>
        </footer>
      </body>
    </html>
  );
}

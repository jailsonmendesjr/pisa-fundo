import Link from "next/link";

interface Season {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
}

export const revalidate = 0;

async function getSeasons(): Promise<Season[]> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${appUrl}/api/seasons`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Erro HTTP: Status ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Erro ao buscar temporadas:", error);
    return [];
  }
}

export default async function HomePage() {
  const seasons = await getSeasons();

  return (
    <div className="space-y-8">
      {/* Hero Header Section */}
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl uppercase italic">
          Temporadas
        </h1>
        <p className="text-slate-400 max-w-2xl text-sm sm:text-base">
          Acompanhe o calendário de etapas, classificação de pilotos, pontuação de equipes e o histórico de resultados de cada campeonato.
        </p>
      </div>

      {/* Grid of Season Cards */}
      {seasons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-12 text-center text-slate-400">
          Nenhuma temporada encontrada. Cadastre temporadas no painel para iniciar.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {seasons.map((season) => (
            <Link
              key={season.id}
              href={`/season/${season.id}`}
              className="group relative block rounded-2xl border border-slate-850 bg-slate-900/40 p-6 hover:border-amber-500/40 hover:bg-slate-900 transition-all duration-300 shadow-md hover:shadow-amber-500/5"
            >
              <div className="flex flex-col justify-between h-full gap-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-white tracking-tight italic">
                      {season.year}
                    </span>
                    {season.is_active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-400 border border-slate-700">
                        Finalizada
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-200 group-hover:text-amber-500 transition-colors uppercase tracking-wide">
                    {season.name}
                  </h3>
                </div>
                <div className="flex items-center justify-end text-xs font-bold text-amber-500 group-hover:translate-x-1 transition-transform uppercase tracking-wider">
                  Ver Classificação →
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

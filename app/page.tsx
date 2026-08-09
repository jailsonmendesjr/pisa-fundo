import Link from "next/link";
import { ChevronRight, Circle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Season {
  id: number;
  name: string;
  year: number;
  is_active: boolean;
}

export const revalidate = 0;

async function getSeasons(): Promise<Season[]> {
  const { data, error } = await supabase
    .from("championship_season")
    .select("id, name, year, is_active")
    .order("year", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar temporadas: ${error.message}`);
  }

  return data;
}

export default async function HomePage() {
  const seasons = await getSeasons();

  return (
    <div className="space-y-8">
      {/* Hero Header Section */}
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Temporadas
        </h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Acompanhe o calendário de etapas, classificação de pilotos, pontuação de equipes e o histórico de resultados de cada campeonato.
        </p>
      </div>

      {/* Grid of Season Cards */}
      {seasons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          Nenhuma temporada encontrada. Cadastre temporadas no painel para iniciar.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {seasons.map((season) => (
            <Link
              key={season.id}
              href={`/season/${season.id}`}
              className="group relative block rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="flex flex-col justify-between h-full gap-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold tracking-tight text-slate-950">
                      {season.year}
                    </span>
                    {season.is_active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        <Circle className="h-2 w-2 animate-pulse fill-current" aria-hidden="true" />
                        Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        Finalizada
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 transition-colors group-hover:text-red-700">
                    {season.name}
                  </h3>
                </div>
                <div className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider text-red-600 transition-transform group-hover:translate-x-1">
                  Ver classificação <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

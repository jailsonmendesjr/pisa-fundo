import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getSeasonStandingsWithChanges, getRoundsWithWinners } from "@/lib/standings";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { seasonId: string };
  searchParams: { tab?: string };
}

function formatDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function renderEvolution(change?: number) {
  if (change === undefined || change === 0) {
    return <span className="text-zinc-500 text-xl leading-none flex items-center justify-center">•</span>;
  }
  if (change > 0) {
    return (
      <span className="text-emerald-500 text-xs font-bold flex items-center gap-0.5">
        ▲ {change}
      </span>
    );
  }
  return (
    <span className="text-rose-500 text-xs font-bold flex items-center gap-0.5">
      ▼ {Math.abs(change)}
    </span>
  );
}

export default async function SeasonDetailPage({ params, searchParams }: PageProps) {
  const { seasonId } = params;
  const activeTab = searchParams.tab || "drivers";

  // Busca dados da temporada, classificação e etapas em paralelo
  const [seasonResponse, standings, rounds] = await Promise.all([
    supabase.from("seasons").select("name, year").eq("id", seasonId).single(),
    getSeasonStandingsWithChanges(supabase, seasonId),
    getRoundsWithWinners(supabase, seasonId),
  ]);

  const season = seasonResponse.data;

  if (!season) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold text-red-500 mb-2">Temporada não encontrada</h1>
        <p className="text-zinc-400 mb-6">A temporada solicitada não existe ou foi removida.</p>
        <Link
          href="/"
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-md transition-colors"
        >
          Voltar para Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header da Temporada */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-bold uppercase tracking-wider border border-red-500/20">
                {season.year}
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white uppercase">
                {season.name}
              </h1>
            </div>
            <p className="text-zinc-400 text-sm mt-1">
              Classificação geral e calendário completo da temporada.
            </p>
          </div>
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
            >
              ← Voltar para Temporadas
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Navegação por Abas (Tabs) */}
        <div className="flex border-b border-zinc-800 mb-8">
          <Link
            href={`/season/${seasonId}?tab=drivers`}
            scroll={false}
            className={`px-6 py-3 border-b-2 text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
              activeTab === "drivers"
                ? "border-red-600 text-red-500 bg-red-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Classificação de Pilotos
          </Link>
          <Link
            href={`/season/${seasonId}?tab=calendar`}
            scroll={false}
            className={`px-6 py-3 border-b-2 text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
              activeTab === "calendar"
                ? "border-red-600 text-red-500 bg-red-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Calendário de Etapas
          </Link>
        </div>

        {/* Conteúdo da Aba 1: Classificação dos Pilotos */}
        {activeTab === "drivers" && (
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800/80 overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-850 bg-zinc-900 text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-4 px-4 text-center w-16">Pos</th>
                    <th className="py-4 px-2 text-center w-12">Ev</th>
                    <th className="py-4 px-4">Piloto</th>
                    <th className="py-4 px-4">Equipe</th>
                    <th className="py-4 px-4 text-center w-24">Carro</th>
                    <th className="py-4 px-6 text-right w-28">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {standings.drivers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 text-sm">
                        Nenhum resultado registrado para esta temporada ainda.
                      </td>
                    </tr>
                  ) : (
                    standings.drivers.map((driver) => {
                      const isPodium = driver.position && driver.position <= 3;
                      return (
                        <tr
                          key={driver.entryId}
                          className="hover:bg-zinc-800/40 transition-colors duration-150 group"
                        >
                          {/* Posição */}
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-black ${
                                driver.position === 1
                                  ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/10"
                                  : driver.position === 2
                                  ? "bg-zinc-300 text-zinc-950"
                                  : driver.position === 3
                                  ? "bg-amber-700 text-zinc-100"
                                  : "text-zinc-400 group-hover:text-zinc-200"
                              }`}
                            >
                              {driver.position}
                            </span>
                          </td>

                          {/* Evolução */}
                          <td className="py-4 px-2 text-center">
                            <div className="flex items-center justify-center">
                              {renderEvolution(driver.change)}
                            </div>
                          </td>

                          {/* Nome do Piloto */}
                          <td className="py-4 px-4">
                            <span className="font-semibold text-zinc-100 group-hover:text-white transition-colors">
                              {driver.driverName}
                            </span>
                          </td>

                          {/* Equipe */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/20"
                                style={{ backgroundColor: driver.teamColor || "#52525b" }}
                              />
                              <span className="text-zinc-300 text-sm">{driver.teamName}</span>
                            </div>
                          </td>

                          {/* Carro (Número) */}
                          <td className="py-4 px-4 text-center">
                            {driver.carNumber !== null && driver.carNumber !== undefined ? (
                              <span className="inline-block px-2 py-0.5 text-xs font-mono font-bold bg-zinc-800 text-zinc-400 rounded border border-zinc-700/50">
                                #{driver.carNumber}
                              </span>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>

                          {/* Pontos Totais */}
                          <td className="py-4 px-6 text-right">
                            <span className="text-sm font-bold text-white tabular-nums">
                              {driver.totalPoints}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Conteúdo da Aba 2: Calendário de Etapas */}
        {activeTab === "calendar" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rounds.length === 0 ? (
              <div className="col-span-full py-8 text-center text-zinc-500 text-sm bg-zinc-900/40 border border-zinc-800 rounded-xl">
                Nenhuma etapa cadastrada nesta temporada ainda.
              </div>
            ) : (
              rounds.map((round) => (
                <div
                  key={round.id}
                  className="bg-zinc-900/60 p-5 rounded-xl border border-zinc-800/80 shadow-lg flex flex-col justify-between hover:border-zinc-750 hover:bg-zinc-900 transition-all duration-200 group"
                >
                  <div>
                    {/* Topo do Card */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-wider text-red-500 bg-red-500/5 px-2 py-0.5 rounded border border-red-500/10">
                        Etapa {round.order}
                      </span>
                      <span className="text-xs text-zinc-400 font-medium">
                        {formatDate(round.date)}
                      </span>
                    </div>

                    {/* Título & Local */}
                    <h3 className="text-base font-extrabold text-white group-hover:text-red-500 transition-colors line-clamp-1">
                      {round.name}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                      <span className="text-zinc-500">📍</span> {round.location}
                    </p>
                  </div>

                  {/* Vencedor */}
                  <div className="mt-5 pt-3 border-t border-zinc-850 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                      Vencedor
                    </span>
                    {round.winner ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-400 bg-amber-400/5 px-2.5 py-1 rounded-md border border-amber-400/10">
                        🏆 {round.winner}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-zinc-500">
                        A realizar
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

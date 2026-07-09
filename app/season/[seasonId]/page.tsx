import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getSeasonStandingsWithChanges, getRoundsWithWinners } from "@/lib/standings";

export const dynamic = "force-dynamic";

interface PageProps {
  params: {
    seasonId: string;
  };
  searchParams: {
    tab?: string;
  };
}

export default async function SeasonDetailPage({ params, searchParams }: PageProps) {
  // 1. Converte o seasonId vindo da URL (string) para número inteiro (Django pattern)
  const seasonId = parseInt(params.seasonId, 10);

  if (isNaN(seasonId)) {
    return notFound();
  }

  const activeTab = searchParams.tab || "drivers";

  // 2. Executa as chamadas ao Supabase usando o ID numérico correto
  const [seasonResponse, standings, rounds] = await Promise.all([
    supabase.from("seasons").select("name, year").eq("id", seasonId).single(),
    getSeasonStandingsWithChanges(supabase, seasonId),
    getRoundsWithWinners(supabase, seasonId),
  ]);

  if (seasonResponse.error || !seasonResponse.data) {
    return notFound();
  }

  const season = seasonResponse.data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header da Temporada */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 mb-6">
          <div>
            <Link href="/" className="text-sm text-amber-500 hover:underline mb-2 block">
              &larr; Voltar para temporadas
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight uppercase italic text-amber-500">
              {season.name}
            </h1>
            <p className="text-slate-400 mt-1">Ano de disputa: {season.year}</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link
              href={`/season/${seasonId}/performance`}
              className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold uppercase italic rounded text-sm transition-colors"
            >
              📊 Análise de Performance
            </Link>
          </div>
        </div>

        {/* Abas de Navegação (Server-Side Tabs) */}
        <div className="flex border-b border-slate-800 mb-6">
          <Link
            href={`/season/${seasonId}?tab=drivers`}
            className={`px-4 py-2 font-bold uppercase italic border-b-2 text-sm transition-colors ${activeTab === "drivers"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
          >
            🏁 Classificação de Pilotos
          </Link>
          <Link
            href={`/season/${seasonId}?tab=calendar`}
            className={`px-4 py-2 font-bold uppercase italic border-b-2 text-sm transition-colors ${activeTab === "calendar"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
          >
            📅 Calendário de Etapas
          </Link>
        </div>

        {/* Conteúdo das Abas */}
        {activeTab === "drivers" ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase text-xs tracking-wider border-b border-slate-800">
                    <th className="py-4 px-4 text-center w-16">Pos</th>
                    <th className="py-4 px-3 text-center w-12">&nbsp;</th>
                    <th className="py-4 px-4">Piloto</th>
                    <th className="py-4 px-4">Equipe</th>
                    <th className="py-4 px-4 text-center w-20">Nº</th>
                    <th className="py-4 px-4 text-center w-24">Vitórias</th>
                    <th className="py-4 px-4 text-center w-24">Pódios</th>
                    <th className="py-4 px-4 text-right w-24 pr-6">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {standings.drivers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum piloto pontuou ou se inscreveu nesta temporada ainda.
                      </td>
                    </tr>
                  ) : (
                    standings.drivers.map((driver) => {
                      const change = String(driver.change);
                      const isUp = change.startsWith("▲");
                      const isDown = change.startsWith("▼");

                      return (
                        <tr key={driver.driverId} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-4 px-4 font-black italic text-center text-base text-slate-300">
                            {driver.position}º
                          </td>
                          <td className="py-4 px-3 text-center text-xs font-bold">
                            {isUp && <span className="text-emerald-500">{change}</span>}
                            {isDown && <span className="text-rose-500">{change}</span>}
                            {!isUp && !isDown && <span className="text-slate-600">•</span>}
                          </td>
                          <td className="py-4 px-4 font-semibold text-white">
                            {driver.driverName}
                          </td>
                          <td className="py-4 px-4">
                            <span
                              className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium border bg-slate-950/50"
                              style={{ borderColor: driver.teamColor + "40", color: driver.teamColor }}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: driver.teamColor }} />
                              {driver.teamName}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-slate-400">
                            {driver.carNumber || "-"}
                          </td>
                          <td className="py-4 px-4 text-center font-medium text-slate-300">
                            {driver.wins}
                          </td>
                          <td className="py-4 px-4 text-center text-slate-300">
                            {driver.podiums}
                          </td>
                          <td className="py-4 px-4 text-right font-black text-amber-500 text-base pr-6">
                            {driver.totalPoints}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rounds.length === 0 ? (
              <p className="text-slate-500 col-span-2 text-center py-8">
                Nenhuma corrida cadastrada para este campeonato.
              </p>
            ) : (
              rounds.map((round) => (
                <div
                  key={round.id}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between shadow-lg"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-bold tracking-widest text-amber-500 uppercase bg-amber-500/10 px-2 py-0.5 rounded">
                        Etapa {round.order}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {round.date}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">
                      {round.name}
                    </h3>
                    <p className="text-sm text-slate-400 flex items-center gap-1 mb-4">
                      📍 {round.location}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Vencedor:</span>
                    {round.winner ? (
                      <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                        🏆 {round.winner}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-slate-500 italic">
                        A realizar
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}


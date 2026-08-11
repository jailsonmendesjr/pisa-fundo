import { notFound } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Circle,
  MapPin,
  Triangle,
  Trophy,
  UsersRound,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { StandingsMetricHeader } from "@/components/standings-metric-header";
import { supabase } from "@/lib/supabase";
import { getSeasonStandingsWithChanges, getRoundsWithWinners } from "@/lib/standings";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    seasonId: string;
  }>;
  searchParams: Promise<{
    tab?: string;
  }>;
}

function PositionChange({ change = 0 }: { change?: number }) {
  const isUp = change > 0;
  const isDown = change < 0;
  const changeAmount = Math.abs(change);
  const positionLabel = changeAmount === 1 ? "posição" : "posições";

  if (isUp) {
    return (
      <span
        className="inline-flex items-center gap-1 text-emerald-700"
        aria-label={`Subiu ${changeAmount} ${positionLabel} desde a última etapa`}
        title={`Subiu ${changeAmount} ${positionLabel}`}
      >
        <Triangle className="h-2.5 w-2.5 fill-current" strokeWidth={0} aria-hidden="true" />
        {changeAmount}
      </span>
    );
  }

  if (isDown) {
    return (
      <span
        className="inline-flex items-center gap-1 text-rose-600"
        aria-label={`Caiu ${changeAmount} ${positionLabel} desde a última etapa`}
        title={`Caiu ${changeAmount} ${positionLabel}`}
      >
        <Triangle className="h-2.5 w-2.5 rotate-180 fill-current" strokeWidth={0} aria-hidden="true" />
        {changeAmount}
      </span>
    );
  }

  return (
    <span className="text-slate-400" aria-label="Manteve a posição desde a última etapa">
      —
    </span>
  );
}

export default async function SeasonDetailPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  // 1. Converte o seasonId vindo da URL (string) para número inteiro (Django pattern)
  const seasonId = parseInt(params.seasonId, 10);

  if (isNaN(seasonId)) {
    return notFound();
  }

  const activeTab =
    searchParams.tab === "teams" || searchParams.tab === "calendar"
      ? searchParams.tab
      : "drivers";

  // 2. Executa as chamadas ao Supabase usando o ID numérico correto
  const [seasonResponse, standings, rounds] = await Promise.all([
    supabase.from("championship_season").select("name, year").eq("id", seasonId).single(),
    getSeasonStandingsWithChanges(supabase, seasonId),
    getRoundsWithWinners(supabase, seasonId),
  ]);

  if (seasonResponse.error || !seasonResponse.data) {
    return notFound();
  }

  const season = seasonResponse.data;

  return (
    <div className="min-h-screen p-4 text-slate-950 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header da Temporada */}
        <div className="mb-6 border-b border-slate-200 pb-6">
          <BackLink href="/" className="mb-3" />
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-bold tracking-tight text-slate-950">
                {season.name}
              </h1>
              <p className="mt-1 text-slate-500">Ano de disputa: {season.year}</p>
            </div>
            <Link
              href={`/season/${seasonId}/performance`}
              aria-label="Análise de performance"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-md bg-red-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 md:h-9 md:w-auto md:px-4"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden md:inline">Análise de performance</span>
            </Link>
          </div>
        </div>

        {/* Abas de Navegação (Server-Side Tabs) */}
        <div className="flex overflow-x-auto border-b border-slate-200 mb-6">
          <Link
            href={`/season/${seasonId}?tab=drivers`}
            aria-current={activeTab === "drivers" ? "page" : undefined}
            className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-3 text-center font-medium border-b-2 text-sm transition-colors ${activeTab === "drivers"
              ? "border-red-500 text-red-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
          >
            <span className="sm:hidden">Pilotos</span>
            <span className="hidden items-center gap-2 sm:inline-flex"><UsersRound className="h-4 w-4" aria-hidden="true" />Ranking de pilotos</span>
          </Link>
          <Link
            href={`/season/${seasonId}?tab=teams`}
            aria-current={activeTab === "teams" ? "page" : undefined}
            className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-3 text-center font-medium border-b-2 text-sm transition-colors ${activeTab === "teams"
              ? "border-red-500 text-red-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
          >
            <span className="sm:hidden">Equipes</span>
            <span className="hidden items-center gap-2 sm:inline-flex"><Trophy className="h-4 w-4" aria-hidden="true" />Ranking de equipes</span>
          </Link>
          <Link
            href={`/season/${seasonId}?tab=calendar`}
            aria-current={activeTab === "calendar" ? "page" : undefined}
            className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-3 text-center font-medium border-b-2 text-sm transition-colors ${activeTab === "calendar"
              ? "border-red-500 text-red-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
          >
            <span className="sm:hidden">Etapas</span>
            <span className="hidden items-center gap-2 sm:inline-flex"><CalendarDays className="h-4 w-4" aria-hidden="true" />Calendário de etapas</span>
          </Link>
        </div>

        {/* Conteúdo das Abas */}
        {activeTab === "drivers" ? (
          <div className="-mx-4 sm:mx-0 bg-white border border-slate-200 rounded-none sm:rounded-lg overflow-visible sm:overflow-hidden shadow-sm">
            <div className="overflow-visible">
              <table className="w-full table-fixed md:table-auto text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200">
                    <th className="py-4 px-2 sm:px-4 text-center w-16 md:w-28">
                      Pos
                      <span className="sr-only"> e variação desde a última etapa</span>
                    </th>
                    <th className="py-4 px-2 sm:px-4">Piloto</th>
                    <th className="hidden md:table-cell py-4 px-4">Equipe</th>
                    <th className="py-2 px-0 sm:px-2 md:py-4 md:px-4 text-center w-11 md:w-24">
                      <StandingsMetricHeader label="Vitórias" metric="wins" />
                    </th>
                    <th className="py-2 px-0 sm:px-2 md:py-4 md:px-4 text-center w-11 md:w-24">
                      <StandingsMetricHeader label="Pódios" metric="podiums" />
                    </th>
                    <th className="py-4 px-2 sm:px-4 text-right w-14 sm:w-20 md:w-24 sm:pr-6">
                      <span className="md:hidden">Pts</span>
                      <span className="hidden md:inline">Pontos</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {standings.drivers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                        Nenhum piloto pontuou ou se inscreveu nesta temporada ainda.
                      </td>
                    </tr>
                  ) : (
                    standings.drivers.map((driver) => (
                        <tr key={driver.driverId} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-2 sm:px-4 text-center text-slate-700">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-black italic text-base">{driver.position}º</span>
                              <span className="text-xs font-bold">
                                <PositionChange change={driver.change} />
                              </span>
                            </div>
                          </td>
                          <td className="max-w-0 py-4 px-2 sm:px-4">
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                              <Circle
                                className="h-3 w-3 shrink-0 md:hidden"
                                style={{ color: driver.teamColor, fill: driver.teamColor }}
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-950">
                                  {driver.driverName}
                                </div>
                                <div className="mt-0.5 truncate text-xs leading-snug text-slate-500">
                                  <span className="md:hidden">{driver.teamName} · </span>
                                  #{driver.carNumber || "--"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="hidden md:table-cell py-4 px-4">
                            <span
                              className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium border bg-slate-50"
                              style={{ borderColor: driver.teamColor + "40", color: driver.teamColor }}
                            >
                              <Circle className="h-2 w-2 fill-current" aria-hidden="true" />
                              {driver.teamName}
                            </span>
                          </td>
                          <td className="py-4 px-0 sm:px-2 md:px-4 text-center font-medium text-slate-700">
                            {driver.wins}
                          </td>
                          <td className="py-4 px-0 sm:px-2 md:px-4 text-center text-slate-700">
                            {driver.podiums}
                          </td>
                          <td className="py-4 px-3 sm:px-4 text-right font-black text-red-600 text-base sm:pr-6">
                            {driver.totalPoints}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === "teams" ? (
          <div className="-mx-4 sm:mx-0 bg-white border border-slate-200 rounded-none sm:rounded-lg overflow-hidden shadow-sm">
            <table className="w-full table-fixed md:table-auto text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200">
                  <th className="py-4 px-2 sm:px-4 text-center w-16 md:w-28">
                    Pos
                    <span className="sr-only"> e variação desde a última etapa</span>
                  </th>
                  <th className="py-4 px-3 sm:px-4">Equipe</th>
                  <th className="hidden md:table-cell py-4 px-4 text-center w-24">Vitórias</th>
                  <th className="hidden md:table-cell py-4 px-4 text-center w-24">Pódios</th>
                  <th className="py-4 px-2 sm:px-4 text-right w-14 sm:w-20 md:w-24 sm:pr-6">
                    <span className="sm:hidden">Pts</span>
                    <span className="hidden sm:inline">Pontos</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {standings.teams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-slate-500">
                      Nenhuma equipe pontuou ou foi inscrita nesta temporada ainda.
                    </td>
                  </tr>
                ) : (
                  standings.teams.map((team) => (
                    <tr key={team.teamId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-2 sm:px-4 text-center text-slate-700">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-black italic text-base">{team.position}º</span>
                          <span className="text-xs font-bold">
                            <PositionChange change={team.change} />
                          </span>
                        </div>
                      </td>
                      <td className="max-w-0 py-4 px-2 sm:px-4">
                        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                          <Circle
                            className="h-6 w-6 shrink-0 drop-shadow-sm sm:h-8 sm:w-8"
                            style={{ color: team.teamColor, fill: team.teamColor }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-950">{team.teamName}</div>
                            <div className="mt-0.5 break-words text-xs leading-snug text-slate-500">
                              {team.driversSummary}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell py-4 px-4 text-center font-medium text-slate-700">
                        {team.wins}
                      </td>
                      <td className="hidden md:table-cell py-4 px-4 text-center text-slate-700">
                        {team.podiums}
                      </td>
                      <td className="py-4 px-3 sm:px-4 text-right font-black text-red-600 text-base sm:pr-6">
                        {team.totalPoints}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rounds.length === 0 ? (
              <p className="text-slate-500 col-span-2 text-center py-8">
                Nenhuma corrida cadastrada para este campeonato.
              </p>
            ) : (
              rounds.map((round) => (
                <Link
                  key={round.id}
                  href={`/season/${seasonId}/round/${round.id}`}
                  aria-label={`Ver resultado da etapa ${round.order}: ${round.name}`}
                  className="group flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-bold tracking-widest text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded">
                        Etapa {round.order}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {round.date}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-950 mb-1">
                      {round.name}
                    </h3>
                    <p className="mb-4 flex items-center gap-1.5 text-sm text-slate-500">
                      <MapPin className="h-4 w-4" aria-hidden="true" /> {round.location}
                    </p>
                  </div>

                  <div className="flex items-end justify-between gap-4 border-t border-slate-200 pt-3">
                    <div>
                      <span className="text-xs font-semibold uppercase text-slate-500">Vencedor:</span>
                      {round.winner ? (
                        <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                          <Trophy className="h-4 w-4" aria-hidden="true" /> {round.winner}
                        </span>
                      ) : (
                        <span className="mt-1 block text-sm font-medium italic text-slate-500">
                          A realizar
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-red-600 transition-transform group-hover:translate-x-1">
                      Ver resultado <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

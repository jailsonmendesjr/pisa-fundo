import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  MapPin,
  Medal,
  Timer,
  TriangleAlert,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { getRoundResult } from "@/lib/standings";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    seasonId: string;
    roundId: string;
  }>;
};

const statusLabels: Record<string, string> = {
  COMPLETED: "Concluiu",
  DNF: "Não concluiu",
  DNS: "Não largou",
};

const compactStatusLabels: Record<string, string> = {
  DNF: "Não concluiu",
  DNS: "Não largou",
};

const podiumIcons: Record<number, { icon: LucideIcon; label: string; className: string }> = {
  1: { icon: Trophy, label: "Primeiro lugar", className: "text-amber-600" },
  2: { icon: Medal, label: "Segundo lugar", className: "text-slate-500" },
  3: { icon: Medal, label: "Terceiro lugar", className: "text-orange-700" },
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export default async function RoundResultPage({ params }: PageProps) {
  const routeParams = await params;
  const seasonId = Number.parseInt(routeParams.seasonId, 10);
  const roundId = Number.parseInt(routeParams.roundId, 10);

  if (!Number.isSafeInteger(seasonId) || !Number.isSafeInteger(roundId)) {
    notFound();
  }

  const [seasonResponse, roundData] = await Promise.all([
    supabase
      .from("championship_season")
      .select("name, year")
      .eq("id", seasonId)
      .maybeSingle(),
    getRoundResult(supabase, seasonId, roundId),
  ]);

  if (seasonResponse.error) throw seasonResponse.error;
  if (!seasonResponse.data || !roundData) notFound();

  const { round, results } = roundData;
  const season = seasonResponse.data;
  const classifiedDriversCount = results.filter(
    (result) => result.status === "COMPLETED" || result.status === "DNF"
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-slate-200 pb-6">
        <Link
          href={`/season/${seasonId}?tab=calendar`}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar para o calendário
        </Link>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">
          {season.name} · Etapa {round.order}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {round.name}
        </h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden="true" />{formatDate(round.date)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden="true" />{round.location}</span>
          <span>{season.year}</span>
        </div>
      </header>

      {results.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-lg font-bold text-slate-900">Resultado ainda não publicado</p>
          <p className="mt-2 text-sm text-slate-500">
            O ranking desta etapa aparecerá aqui assim que os resultados forem lançados.
          </p>
        </section>
      ) : (
        <section className="-mx-4 overflow-hidden border-y border-slate-200 bg-white shadow-sm sm:mx-0 sm:rounded-lg sm:border-x">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">Resultado da etapa</h2>
            <p className="mt-1 text-sm text-slate-500">
              {classifiedDriversCount}{" "}
              {classifiedDriversCount === 1 ? "piloto classificado" : "pilotos classificados"}
            </p>
          </div>
          <div>
            <table className="w-full table-fixed text-left text-sm md:table-auto">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-16 px-2 py-3 text-center md:w-auto md:px-5">Pos.</th>
                  <th className="px-1 py-3 md:px-5">Piloto</th>
                  <th className="hidden px-5 py-3 md:table-cell">Equipe</th>
                  <th className="hidden px-5 py-3 md:table-cell">Status</th>
                  <th className="w-14 px-1 py-3 text-center md:w-auto md:px-5">
                    <span className="md:hidden" aria-label="Volta rápida">V.R.</span>
                    <span className="hidden md:inline">Volta rápida</span>
                  </th>
                  <th className="w-16 px-3 py-3 text-right md:w-auto md:px-5">
                    <span className="md:hidden" aria-label="Pontos">PTS</span>
                    <span className="hidden md:inline">Pontos</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.map((result) => {
                  const podium = podiumIcons[result.position];
                  const PodiumIcon = podium?.icon;
                  const isNonFinisher = result.status === "DNF" || result.status === "DNS";

                  return (
                    <tr
                      key={result.id}
                      className={`transition-colors hover:bg-slate-50 ${isNonFinisher ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="px-2 py-5 text-center text-base font-black italic md:px-5 md:py-4">
                        <span
                          className={`inline-flex items-center justify-center gap-2 ${isNonFinisher ? "text-rose-600" : "text-slate-900"}`}
                        >
                          <span className="md:hidden">
                            {isNonFinisher ? result.status : `${result.position}º`}
                          </span>
                          <span className="hidden md:inline">{result.position}º</span>
                          {podium && PodiumIcon && (
                            <PodiumIcon
                              aria-label={podium.label}
                              className={`hidden h-5 w-5 md:block ${podium.className}`}
                            />
                          )}
                        </span>
                      </td>
                      <td className="min-w-0 px-1 py-5 md:px-5 md:py-4">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span
                            className="mt-1.5 h-3 w-3 shrink-0 rounded-full md:hidden"
                            style={{ backgroundColor: result.teamColor }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className={`font-bold leading-5 ${isNonFinisher ? "text-slate-500" : "text-slate-950"}`}>
                              {result.driverName}
                            </p>
                            {isNonFinisher ? (
                              <span className="mt-1 inline-flex rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 md:hidden">
                                {compactStatusLabels[result.status]}
                              </span>
                            ) : null}
                            {result.hasPenalty ? (
                              <details className="group mt-2 max-w-sm">
                                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 md:min-h-9 [&::-webkit-details-marker]:hidden">
                                  <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                                  Penalidade
                                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                                </summary>
                                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-950">
                                  <span className="font-semibold">Motivo:</span> {result.penaltyReason}
                                </div>
                              </details>
                            ) : null}
                            <p className="mt-1.5 truncate text-xs text-slate-500">
                              <span className="md:hidden">{result.teamName} · </span>
                              #{result.carNumber || "--"}
                              {result.isGuest ? " · convidado" : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        <span
                          className="inline-flex items-center gap-2 rounded border bg-slate-50 px-2 py-1 text-xs font-medium"
                          style={{ borderColor: `${result.teamColor}40`, color: result.teamColor }}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: result.teamColor }} />
                          {result.teamName}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 text-slate-700 md:table-cell">
                        {statusLabels[result.status] ?? result.status}
                      </td>
                      <td className="px-1 py-5 text-center md:px-5 md:py-4">
                        <div className="flex justify-center">
                          {result.fastestLap && (
                            <span
                              className="inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700"
                              aria-label="Volta rápida"
                              title="Volta rápida"
                            >
                              <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                              <span aria-hidden="true" className="hidden lg:inline">
                                Volta rápida
                              </span>
                            </span>
                          )}
                          {!result.fastestLap && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-5 text-right text-base font-black text-red-600 md:px-5 md:py-4">
                        <span className="md:hidden">{isNonFinisher ? "—" : `+${result.points}`}</span>
                        <span className="hidden md:inline">{result.points}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

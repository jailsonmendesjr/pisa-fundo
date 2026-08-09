import Link from "next/link";
import { notFound } from "next/navigation";
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

const podiumEmojis: Record<number, { emoji: string; label: string }> = {
  1: { emoji: "🏆", label: "Primeiro lugar" },
  2: { emoji: "🥈", label: "Segundo lugar" },
  3: { emoji: "🥉", label: "Terceiro lugar" },
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-slate-800 pb-6">
        <Link
          href={`/season/${seasonId}?tab=calendar`}
          className="mb-4 inline-flex text-sm font-semibold text-amber-500 hover:underline"
        >
          ← Voltar para o calendário
        </Link>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">
          {season.name} · Etapa {round.order}
        </p>
        <h1 className="mt-2 text-3xl font-black uppercase italic tracking-tight text-white sm:text-4xl">
          {round.name}
        </h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
          <span>📅 {formatDate(round.date)}</span>
          <span>📍 {round.location}</span>
          <span>{season.year}</span>
        </div>
      </header>

      {results.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-14 text-center">
          <p className="text-lg font-bold text-slate-200">Resultado ainda não publicado</p>
          <p className="mt-2 text-sm text-slate-500">
            O ranking desta etapa aparecerá aqui assim que os resultados forem lançados.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-lg font-black uppercase italic text-white">Resultado da etapa</h2>
            <p className="mt-1 text-sm text-slate-500">{results.length} pilotos classificados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-center">Pos.</th>
                  <th className="px-5 py-3">Piloto</th>
                  <th className="px-5 py-3">Equipe</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-center">Destaques</th>
                  <th className="px-5 py-3 text-right">Pontos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {results.map((result) => {
                  const podium = podiumEmojis[result.position];

                  return (
                    <tr key={result.id} className="hover:bg-slate-800/30">
                      <td className="px-5 py-4 text-center text-base font-black italic text-slate-200">
                        <span className="inline-flex items-center justify-center gap-2">
                          {result.position}º
                          {podium && (
                            <span aria-hidden="true" title={podium.label} className="not-italic">
                              {podium.emoji}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-white">{result.driverName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {result.carNumber !== null ? `#${result.carNumber}` : "Sem número"}
                          {result.isGuest ? " · convidado" : ""}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center gap-2 rounded border bg-slate-950/50 px-2 py-1 text-xs font-medium"
                          style={{ borderColor: `${result.teamColor}40`, color: result.teamColor }}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: result.teamColor }} />
                          {result.teamName}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {statusLabels[result.status] ?? result.status}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex flex-wrap justify-center gap-2">
                          {result.fastestLap && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-1 text-xs font-bold text-purple-300"
                              aria-label="Volta rápida"
                              title="Volta rápida"
                            >
                              <span aria-hidden="true">⏱️</span>
                              <span aria-hidden="true" className="hidden sm:inline">
                                Volta rápida
                              </span>
                            </span>
                          )}
                          {result.hasPenalty && (
                            <span
                              className="rounded-full bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-300"
                              title={result.penaltyReason}
                            >
                              Penalidade
                            </span>
                          )}
                          {!result.fastestLap && !result.hasPenalty && (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-base font-black text-amber-500">
                        {result.points}
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

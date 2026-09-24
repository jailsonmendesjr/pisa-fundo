import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FlagTriangleRight,
  MapPin,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { StandingsMetricHeader } from "@/components/standings-metric-header";
import { getCupStandings } from "@/lib/cup-standings";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mini Copa | Pisa Fundo Kart",
  description:
    "Acompanhe as etapas, os pilotos e a classificação individual da Mini Copa Pisa Fundo.",
};

type PageProps = {
  params: Promise<{ cupId: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}

export default async function CupPage({ params }: PageProps) {
  const cupId = Number.parseInt((await params).cupId, 10);
  if (!Number.isSafeInteger(cupId) || cupId < 1) notFound();

  const data = await getCupStandings(supabase, cupId);
  if (!data?.cup.publishedAt || !data.cup.isEnabled) notFound();

  const classifiedDrivers = data.standings.filter(
    (standing) => standing.resultsCounted > 0
  );
  const roundById = new Map(data.rounds.map((round) => [round.id, round]));
  const completedRounds = data.rounds.filter((round) => round.hasResults).length;
  const cupStatus = data.finalRoundPublished
    ? "Finalizada"
    : completedRounds > 0
      ? "Em andamento"
      : "Aguardando a primeira etapa";

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-2">
      <header className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-sm">
        <div className="border-b border-white/10 px-5 py-4 sm:px-7">
          <BackLink
            href={`/season/${data.cup.seasonId}`}
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
          />
        </div>
        <div className="grid gap-8 px-5 py-8 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-400">
              <FlagTriangleRight className="h-4 w-4" aria-hidden="true" />
              Campeonato individual paralelo
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              {data.cup.name}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Quatro etapas oficiais, a mesma pontuação do campeonato e uma nova disputa para quem aderiu à Copa.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-2xl font-black">{completedRounds}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                de 4 etapas
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-2xl font-black">{data.standings.length}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                inscritos
              </p>
            </div>
            <div className="col-span-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 sm:col-span-1 sm:flex sm:items-center sm:justify-center">
              {cupStatus}
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="ranking-copa">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
              Classificação individual
            </p>
            <h2 id="ranking-copa" className="mt-1 text-2xl font-black text-slate-950">
              Disputa da Mini Copa
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            {completedRounds === 0
              ? "A classificação começa após a primeira etapa."
              : `${completedRounds} etapa${completedRounds === 1 ? " computada" : "s computadas"}`}
          </p>
        </div>

        <div className="-mx-4 overflow-hidden border-y border-slate-200 bg-white shadow-sm sm:mx-0 sm:rounded-lg sm:border">
          <table className="w-full table-fixed border-collapse text-left md:table-auto">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="w-16 px-2 py-4 text-center sm:w-24 sm:px-4">
                  Pos
                </th>
                <th scope="col" className="px-2 py-4 sm:px-4">Piloto</th>
                <th scope="col" className="w-11 px-0 py-2 text-center sm:px-2 md:w-24 md:px-4 md:py-4">
                  <StandingsMetricHeader label="Vitórias" metric="wins" />
                </th>
                <th scope="col" className="w-11 px-0 py-2 text-center sm:px-2 md:w-24 md:px-4 md:py-4">
                  <StandingsMetricHeader label="Pódios" metric="podiums" />
                </th>
                <th scope="col" className="w-14 px-2 py-4 text-right sm:w-20 sm:px-4 sm:pr-6 md:w-24">
                  <span className="md:hidden">Pts</span>
                  <span className="hidden md:inline">Pontos</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {classifiedDrivers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Nenhum resultado válido para a Copa foi publicado ainda.
                  </td>
                </tr>
              ) : (
                classifiedDrivers.map((driver) => (
                  <tr key={driver.entryId} className="transition-colors hover:bg-slate-50">
                    <td className="px-2 py-4 text-center text-slate-700 sm:px-4">
                      <span className="text-base font-black italic">{driver.position}º</span>
                      {driver.isTied ? (
                        <span className="mt-1 block text-[10px] font-bold uppercase leading-tight text-amber-700">
                          {driver.tieIsProvisional ? "empate provisório" : "empate"}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-0 px-2 py-4 sm:px-4">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">
                          {driver.driverName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          Carro #{driver.carNumber ?? "--"} · {driver.resultsCounted} resultado{driver.resultsCounted === 1 ? "" : "s"}
                        </p>
                      </div>
                    </td>
                    <td className="px-0 py-4 text-center font-medium text-slate-700 sm:px-2 md:px-4">
                      {driver.wins}
                    </td>
                    <td className="px-0 py-4 text-center text-slate-700 sm:px-2 md:px-4">
                      {driver.podiums}
                    </td>
                    <td className="px-3 py-4 text-right text-base font-black text-red-600 sm:px-4 sm:pr-6">
                      {driver.totalPoints}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="etapas-copa">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
            Calendário
          </p>
          <h2 id="etapas-copa" className="mt-1 text-2xl font-black text-slate-950">
            As quatro etapas
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.rounds.map((round) => {
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded bg-red-50 px-2 py-1 text-xs font-black uppercase tracking-wider text-red-600">
                    {round.cupOrder}ª etapa
                  </span>
                  {round.hasResults ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Resultado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                      <Clock3 className="h-4 w-4" aria-hidden="true" /> A realizar
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-950">{round.name}</h3>
                <div className="mt-2 space-y-1 text-sm text-slate-500">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {formatDate(round.date)}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {round.location}
                  </p>
                </div>
                {round.hasResults ? (
                  <span className="mt-5 inline-flex items-center text-xs font-bold uppercase tracking-wider text-red-600">
                    Ver resultado oficial
                    <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </span>
                ) : null}
              </>
            );

            return round.hasResults ? (
              <Link
                key={round.id}
                href={`/season/${data.cup.seasonId}/round/${round.id}`}
                className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                {content}
              </Link>
            ) : (
              <article
                key={round.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                {content}
              </article>
            );
          })}
          {data.rounds.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 md:col-span-2">
              As etapas da Copa ainda não foram divulgadas.
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="inscritos-copa">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
              <UsersRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Participantes
              </p>
              <h2 id="inscritos-copa" className="text-xl font-black text-slate-950">
                Pilotos inscritos
              </h2>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.standings.map((driver) => {
              const firstRound = roundById.get(driver.firstRoundId);
              return (
                <li key={driver.entryId} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{driver.driverName}</p>
                    <p className="truncate text-xs text-slate-500">{driver.teamName}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    Desde a {firstRound?.cupOrder ?? "?"}ª
                  </span>
                </li>
              );
            })}
            {data.standings.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500">
                Nenhum piloto inscrito até o momento.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="regras-copa">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-lg bg-red-50 p-2 text-red-600">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
                Como funciona
              </p>
              <h2 id="regras-copa" className="text-xl font-black text-slate-950">
                Regulamento resumido
              </h2>
            </div>
          </div>
          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li className="flex gap-2"><Trophy className="mt-1 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />Os pontos são exatamente os mesmos do resultado oficial.</li>
            <li className="flex gap-2"><Trophy className="mt-1 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />Posições e pontos não são redistribuídos quando um convidado ou não participante termina à frente.</li>
            <li className="flex gap-2"><Trophy className="mt-1 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />Adesões tardias contam somente a partir da etapa escolhida.</li>
            <li className="flex gap-2"><Trophy className="mt-1 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />Desempate: pontos, vitórias, pódios e, após a final, o melhor resultado real na quarta etapa.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

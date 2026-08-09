import { SubmitButton } from "@/components/admin/submit-button";
import {
  Notice,
  PageHeading,
  cardClassName,
  inputClassName,
  labelClassName,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { saveRoundResults } from "../../actions";

type PageProps = {
  searchParams: Promise<{ round?: string; success?: string; error?: string }>;
};

export default async function ResultsAdminPage({ searchParams }: PageProps) {
  const [{ supabase }, query] = await Promise.all([requireAdmin(), searchParams]);
  const [seasonsResponse, roundsResponse, driversResponse, teamsResponse] =
    await Promise.all([
      supabase.from("championship_season").select("id, name, year, is_active").order("year", { ascending: false }),
      supabase.from("championship_round").select("id, season_id, name, date, order").order("season_id", { ascending: false }).order("order"),
      supabase.from("championship_driver").select("id, name"),
      supabase.from("championship_team").select("id, name"),
    ]);

  if (seasonsResponse.error) throw seasonsResponse.error;
  if (roundsResponse.error) throw roundsResponse.error;
  if (driversResponse.error) throw driversResponse.error;
  if (teamsResponse.error) throw teamsResponse.error;

  const seasons = seasonsResponse.data ?? [];
  const rounds = roundsResponse.data ?? [];
  const activeSeasonId = seasons.find((season) => season.is_active)?.id;
  const activeRounds = rounds.filter((round) => round.season_id === activeSeasonId);
  const selectedRoundId =
    Number.parseInt(query.round ?? "", 10) ||
    activeRounds.at(-1)?.id ||
    rounds.at(-1)?.id;
  const selectedRound = rounds.find((round) => round.id === selectedRoundId);
  const selectedSeason = seasons.find((season) => season.id === selectedRound?.season_id);

  const [entriesResponse, resultsResponse] = selectedRound
    ? await Promise.all([
        supabase
          .from("championship_driverteamseason")
          .select("id, driver_id, team_id, car_number, is_guest")
          .eq("season_id", selectedRound.season_id)
          .order("team_id")
          .order("driver_id"),
        supabase
          .from("championship_roundresult")
          .select("id, entry_id, position, status, fastest_lap, has_penalty, penalty_reason, points")
          .eq("round_id", selectedRound.id),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (entriesResponse.error) throw entriesResponse.error;
  if (resultsResponse.error) throw resultsResponse.error;

  const driverNames = new Map((driversResponse.data ?? []).map((driver) => [driver.id, driver.name]));
  const teamNames = new Map((teamsResponse.data ?? []).map((team) => [team.id, team.name]));
  const seasonNames = new Map(seasons.map((season) => [season.id, season.name]));
  const results = new Map((resultsResponse.data ?? []).map((result) => [result.entry_id, result]));

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Publicação"
        title="Resultados"
        description="Lance o grid da etapa em uma única operação. Posições, volta rápida e pontuação são validadas antes da publicação."
      />
      <Notice success={query.success} error={query.error} />

      <section className={cardClassName}>
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className={`${labelClassName} flex-1`}>
            Etapa
            <select name="round" defaultValue={selectedRoundId} className={inputClassName}>
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {seasonNames.get(round.season_id)} · #{round.order} {round.name} · {round.date}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-900 hover:border-red-500">
            Carregar grid
          </button>
        </form>
      </section>

      {selectedRound ? (
        <form action={saveRoundResults} className="space-y-5">
          <input type="hidden" name="round_id" value={selectedRound.id} />
          <section className={cardClassName}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-red-600">
                  {selectedSeason?.name}
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  #{selectedRound.order} {selectedRound.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{selectedRound.date}</p>
              </div>
              <div className="text-sm text-slate-500">
                {results.size} de {entriesResponse.data?.length ?? 0} resultados lançados
              </div>
            </div>
          </section>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Piloto</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Posição</th>
                  <th className="px-4 py-3">Volta rápida</th>
                  <th className="px-4 py-3">Penalidade</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3 text-right">Pontos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(entriesResponse.data ?? []).map((entry, index) => {
                  const result = results.get(entry.id);
                  return (
                    <tr key={entry.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <input type="hidden" name="entry_id" value={entry.id} />
                        <p className="font-black text-slate-950">
                          {driverNames.get(entry.driver_id) ?? `Piloto ${entry.driver_id}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {teamNames.get(entry.team_id)}
                          {entry.car_number !== null ? ` · #${entry.car_number}` : ""}
                          {entry.is_guest ? " · convidado" : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          name={`status_${entry.id}`}
                          defaultValue={result?.status ?? ""}
                          className={inputClassName}
                        >
                          <option value="">Não lançado</option>
                          <option value="COMPLETED">Concluído</option>
                          <option value="DNF">DNF</option>
                          <option value="DNS">DNS</option>
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <input
                          name={`position_${entry.id}`}
                          type="number"
                          min={1}
                          defaultValue={result?.position ?? index + 1}
                          className={`${inputClassName} w-24`}
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <input
                          name={`fastest_${entry.id}`}
                          type="checkbox"
                          defaultChecked={result?.fastest_lap}
                          className="mt-2 h-5 w-5 accent-red-600"
                          aria-label={`Volta rápida de ${driverNames.get(entry.driver_id)}`}
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <input
                          name={`penalty_${entry.id}`}
                          type="checkbox"
                          defaultChecked={result?.has_penalty}
                          className="mt-2 h-5 w-5 accent-red-500"
                          aria-label={`Penalidade de ${driverNames.get(entry.driver_id)}`}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input
                          name={`penalty_reason_${entry.id}`}
                          defaultValue={result?.penalty_reason}
                          maxLength={200}
                          className={inputClassName}
                          placeholder="Informativo"
                        />
                      </td>
                      <td className="px-4 py-4 text-right font-black text-red-600">
                        {result?.points ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-slate-700">
              Linhas com “Não lançado” serão removidas desta etapa. Penalidades ficam registradas como informação e não alteram a pontuação.
            </p>
            <SubmitButton pendingLabel="Publicando..." className="px-6 py-3">
              Publicar resultados
            </SubmitButton>
          </div>
        </form>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          Cadastre uma etapa antes de lançar resultados.
        </p>
      )}
    </div>
  );
}

import { SubmitButton } from "@/components/admin/submit-button";
import {
  Notice,
  PageHeading,
  cardClassName,
  inputClassName,
  labelClassName,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { createEntry, updateEntry } from "../../actions";

type PageProps = {
  searchParams: Promise<{ season?: string; success?: string; error?: string }>;
};

export default async function EntriesAdminPage({ searchParams }: PageProps) {
  const [{ supabase }, query] = await Promise.all([requireAdmin(), searchParams]);
  const [seasonsResponse, teamsResponse, driversResponse] = await Promise.all([
    supabase.from("championship_season").select("id, name, year, is_active").order("year", { ascending: false }),
    supabase.from("championship_team").select("id, name").order("name"),
    supabase.from("championship_driver").select("id, name").order("name"),
  ]);

  if (seasonsResponse.error) throw seasonsResponse.error;
  if (teamsResponse.error) throw teamsResponse.error;
  if (driversResponse.error) throw driversResponse.error;

  const seasons = seasonsResponse.data ?? [];
  const selectedSeasonId =
    Number.parseInt(query.season ?? "", 10) ||
    seasons.find((season) => season.is_active)?.id ||
    seasons[0]?.id;
  const { data: entries, error: entriesError } = selectedSeasonId
    ? await supabase
        .from("championship_driverteamseason")
        .select("id, season_id, team_id, driver_id, car_number, is_guest")
        .eq("season_id", selectedSeasonId)
        .order("team_id")
        .order("driver_id")
    : { data: [], error: null };

  if (entriesError) throw entriesError;

  const teams = teamsResponse.data ?? [];
  const drivers = driversResponse.data ?? [];
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const driverNames = new Map(drivers.map((driver) => [driver.id, driver.name]));

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Formação do grid"
        title="Inscrições"
        description="Relacione cada piloto a uma equipe dentro do campeonato selecionado. O banco limita cada equipe a dois pilotos."
      />
      <Notice success={query.success} error={query.error} />

      <section className={cardClassName}>
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className={`${labelClassName} flex-1`}>
            Campeonato
            <select name="season" defaultValue={selectedSeasonId} className={inputClassName}>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} ({season.year}){season.is_active ? " — ativo" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-amber-500">
            Carregar
          </button>
        </form>
      </section>

      {selectedSeasonId ? (
        <section className={cardClassName}>
          <h2 className="mb-5 text-lg font-black text-white">Adicionar piloto ao grid</h2>
          <form action={createEntry} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
            <input type="hidden" name="season_id" value={selectedSeasonId} />
            <label className={labelClassName}>
              Piloto
              <select name="driver_id" required className={inputClassName}>
                <option value="">Selecione</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Equipe
              <select name="team_id" required className={inputClassName}>
                <option value="">Selecione</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Número do carro
              <input name="car_number" type="number" min={0} className={inputClassName} />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-300">
              <input name="is_guest" type="checkbox" className="h-4 w-4 accent-amber-500" />
              Piloto convidado
            </label>
            <SubmitButton>Adicionar inscrição</SubmitButton>
          </form>
        </section>
      ) : null}

      <div className="space-y-3">
        {(entries ?? []).map((entry) => (
          <section key={entry.id} className={cardClassName}>
            <div className="mb-4">
              <h2 className="font-black text-white">{driverNames.get(entry.driver_id) ?? `Piloto ${entry.driver_id}`}</h2>
              <p className="text-xs text-slate-500">{teamNames.get(entry.team_id)} · inscrição {entry.id}</p>
            </div>
            <form action={updateEntry} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="season_id" value={entry.season_id} />
              <label className={labelClassName}>
                Piloto
                <select name="driver_id" defaultValue={entry.driver_id} className={inputClassName}>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </label>
              <label className={labelClassName}>
                Equipe
                <select name="team_id" defaultValue={entry.team_id} className={inputClassName}>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
              <label className={labelClassName}>
                Número do carro
                <input name="car_number" type="number" min={0} defaultValue={entry.car_number ?? ""} className={inputClassName} />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-300">
                <input name="is_guest" type="checkbox" defaultChecked={entry.is_guest} className="h-4 w-4 accent-amber-500" />
                Convidado
              </label>
              <SubmitButton>Salvar inscrição</SubmitButton>
            </form>
          </section>
        ))}
        {(entries ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
            Nenhum piloto inscrito neste campeonato.
          </p>
        ) : null}
      </div>
    </div>
  );
}

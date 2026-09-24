import { RetroactiveCupRoundForm } from "@/components/admin/retroactive-cup-round-form";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  Notice,
  PageHeading,
  cardClassName,
  inputClassName,
  labelClassName,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import {
  addCupRound,
  closeCupRoundRegistrations,
  createCup,
  enrollCupEntry,
  publishCup,
  removeCupEntry,
  removeCupRound,
  setCupEnabled,
  undoRetroactiveCupRound,
  updateCup,
} from "../../actions";

type PageProps = {
  searchParams: Promise<{ cup?: string; success?: string; error?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}

function statusBadge(label: string, tone: "green" | "amber" | "slate") {
  const colors = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-bold ${colors[tone]}`}>
      {label}
    </span>
  );
}

export default async function CupAdminPage({ searchParams }: PageProps) {
  const [{ supabase }, query] = await Promise.all([requireAdmin(), searchParams]);
  const [seasonsResponse, cupsResponse, driversResponse, teamsResponse] =
    await Promise.all([
      supabase
        .from("championship_season")
        .select("id, name, year, is_active")
        .order("year", { ascending: false }),
      supabase
        .from("championship_cup")
        .select("id, season_id, name, published_at, is_enabled, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("championship_driver").select("id, name").order("name"),
      supabase.from("championship_team").select("id, name").order("name"),
    ]);

  if (seasonsResponse.error) throw seasonsResponse.error;
  if (cupsResponse.error) throw cupsResponse.error;
  if (driversResponse.error) throw driversResponse.error;
  if (teamsResponse.error) throw teamsResponse.error;

  const seasons = seasonsResponse.data ?? [];
  const cups = cupsResponse.data ?? [];
  const requestedCupId = Number.parseInt(query.cup ?? "", 10);
  const selectedCup =
    cups.find((cup) => cup.id === requestedCupId) ?? cups[0] ?? null;
  const selectedSeason = seasons.find(
    (season) => season.id === selectedCup?.season_id
  );

  const [roundsResponse, cupRoundsResponse, entriesResponse, cupEntriesResponse] =
    selectedCup
      ? await Promise.all([
          supabase
            .from("championship_round")
            .select("id, name, date, location, order")
            .eq("season_id", selectedCup.season_id)
            .order("order"),
          supabase
            .from("championship_cup_round")
            .select(
              "cup_id, round_id, cup_order, registration_closed_at, retroactive_at, retroactive_by, retroactive_reason"
            )
            .eq("cup_id", selectedCup.id)
            .order("cup_order"),
          supabase
            .from("championship_driverteamseason")
            .select("id, driver_id, team_id, is_guest")
            .eq("season_id", selectedCup.season_id)
            .order("driver_id"),
          supabase
            .from("championship_cup_entry")
            .select("cup_id, entry_id, first_round_id, enrolled_at")
            .eq("cup_id", selectedCup.id)
            .order("enrolled_at"),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (roundsResponse.error) throw roundsResponse.error;
  if (cupRoundsResponse.error) throw cupRoundsResponse.error;
  if (entriesResponse.error) throw entriesResponse.error;
  if (cupEntriesResponse.error) throw cupEntriesResponse.error;

  const rounds = roundsResponse.data ?? [];
  const cupRounds = cupRoundsResponse.data ?? [];
  const entries = entriesResponse.data ?? [];
  const cupEntries = cupEntriesResponse.data ?? [];
  const linkedRoundIds = cupRounds.map((round) => round.round_id);
  const seasonRoundIds = rounds.map((round) => round.id);
  const resultsResponse = seasonRoundIds.length
    ? await supabase
        .from("championship_roundresult")
        .select("round_id, entry_id, position, points, status")
        .in("round_id", seasonRoundIds)
    : { data: [], error: null };
  if (resultsResponse.error) throw resultsResponse.error;

  const roundById = new Map(rounds.map((round) => [round.id, round]));
  const cupRoundByRoundId = new Map(
    cupRounds.map((round) => [round.round_id, round])
  );
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const driverNames = new Map(
    (driversResponse.data ?? []).map((driver) => [driver.id, driver.name])
  );
  const teamNames = new Map(
    (teamsResponse.data ?? []).map((team) => [team.id, team.name])
  );
  const resultRoundIds = new Set(
    (resultsResponse.data ?? []).map((result) => result.round_id)
  );
  const linkedRoundIdSet = new Set(linkedRoundIds);
  const cupEntryIds = new Set(cupEntries.map((entry) => entry.entry_id));
  const availableRounds = rounds.filter(
    (round) => !linkedRoundIdSet.has(round.id) && !resultRoundIds.has(round.id)
  );
  const retroactiveRounds = rounds.filter(
    (round) => !linkedRoundIdSet.has(round.id) && resultRoundIds.has(round.id)
  );
  const usedCupOrders = new Set(cupRounds.map((round) => round.cup_order));
  const availableCupOrders = [1, 2, 3, 4].filter(
    (order) => !usedCupOrders.has(order)
  );
  const openCupRounds = cupRounds.filter(
    (round) =>
      !round.registration_closed_at && !resultRoundIds.has(round.round_id)
  );
  const availableEntries = entries.filter(
    (entry) => !entry.is_guest && !cupEntryIds.has(entry.id)
  );
  const guestCount = entries.filter((entry) => entry.is_guest).length;
  const retroactiveEntries = entries
    .filter((entry) => !entry.is_guest)
    .map((entry) => ({
      id: entry.id,
      driverName: driverNames.get(entry.driver_id) ?? `Piloto ${entry.driver_id}`,
      teamName: teamNames.get(entry.team_id) ?? "Equipe",
    }));
  const retroactiveResults = (resultsResponse.data ?? []).map((result) => ({
    entryId: result.entry_id,
    roundId: result.round_id,
    points: result.points,
    position: result.position,
    status: result.status,
  }));

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Campeonato paralelo"
        title="Mini Copa"
        description="Reaproveite etapas e inscrições do campeonato oficial. A Copa mantém apenas os vínculos necessários e nunca duplica resultados ou pontuação."
      />
      <Notice success={query.success} error={query.error} />

      <section className={cardClassName}>
        <h2 className="mb-5 text-lg font-black text-slate-950">
          Criar nova Mini Copa
        </h2>
        <form
          action={createCup}
          className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
        >
          <label className={labelClassName}>
            Nome
            <input
              name="name"
              required
              maxLength={100}
              className={inputClassName}
              placeholder="Mini Copa Pisa Fundo 2026"
            />
          </label>
          <label className={labelClassName}>
            Campeonato de origem
            <select
              name="season_id"
              required
              defaultValue={seasons.find((season) => season.is_active)?.id}
              className={inputClassName}
            >
              <option value="">Selecione</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} ({season.year})
                  {season.is_active ? " — ativo" : ""}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton>Criar em rascunho</SubmitButton>
        </form>
      </section>

      {cups.length > 1 ? (
        <section className={cardClassName}>
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className={`${labelClassName} flex-1`}>
              Mini Copa em edição
              <select name="cup" defaultValue={selectedCup?.id} className={inputClassName}>
                {cups.map((cup) => (
                  <option key={cup.id} value={cup.id}>
                    {cup.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-900 hover:border-red-500">
              Carregar
            </button>
          </form>
        </section>
      ) : null}

      {selectedCup ? (
        <>
          <section className={cardClassName}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {selectedCup.published_at
                    ? statusBadge("Publicada", "green")
                    : statusBadge("Rascunho", "amber")}
                  {selectedCup.is_enabled
                    ? statusBadge("Visível", "green")
                    : statusBadge("Oculta", "slate")}
                </div>
                <h2 className="text-xl font-black text-slate-950">
                  {selectedCup.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedSeason?.name} ({selectedSeason?.year}) · ID {selectedCup.id}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!selectedCup.published_at ? (
                  <form action={publishCup}>
                    <input type="hidden" name="cup_id" value={selectedCup.id} />
                    <SubmitButton pendingLabel="Publicando...">
                      Publicar e ativar
                    </SubmitButton>
                  </form>
                ) : (
                  <form action={setCupEnabled}>
                    <input type="hidden" name="cup_id" value={selectedCup.id} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={selectedCup.is_enabled ? "false" : "true"}
                    />
                    <SubmitButton
                      className="bg-slate-200 hover:bg-white"
                      pendingLabel="Atualizando..."
                    >
                      {selectedCup.is_enabled ? "Ocultar Copa" : "Ativar Copa"}
                    </SubmitButton>
                  </form>
                )}
              </div>
            </div>
            <form
              action={updateCup}
              className="mt-6 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-[1fr_auto] md:items-end"
            >
              <input type="hidden" name="cup_id" value={selectedCup.id} />
              <label className={labelClassName}>
                Nome da Mini Copa
                <input
                  name="name"
                  defaultValue={selectedCup.name}
                  required
                  maxLength={100}
                  className={inputClassName}
                />
              </label>
              <SubmitButton>Salvar nome</SubmitButton>
            </form>
          </section>

          <section className={cardClassName}>
            <div className="mb-5">
              <h2 className="text-lg font-black text-slate-950">Etapas da Copa</h2>
              <p className="mt-1 text-sm text-slate-500">
                {cupRounds.length} de 4 etapas vinculadas. O resultado continuará sendo lançado apenas na etapa oficial.
              </p>
            </div>

            {availableRounds.length > 0 && availableCupOrders.length > 0 ? (
              <form
                action={addCupRound}
                className="mb-6 grid gap-4 rounded-lg border border-dashed border-slate-200 p-4 md:grid-cols-[1fr_130px_auto] md:items-end"
              >
                <input type="hidden" name="cup_id" value={selectedCup.id} />
                <label className={labelClassName}>
                  Etapa oficial
                  <select name="round_id" required className={inputClassName}>
                    <option value="">Selecione</option>
                    {availableRounds.map((round) => (
                      <option key={round.id} value={round.id}>
                        {round.name} · {formatDate(round.date)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClassName}>
                  Ordem na Copa
                  <select name="cup_order" required className={inputClassName}>
                    {availableCupOrders.map((order) => (
                      <option key={order} value={order}>
                        {order}ª etapa
                      </option>
                    ))}
                  </select>
                </label>
                <SubmitButton>Vincular etapa</SubmitButton>
              </form>
            ) : null}

            {!selectedCup.published_at &&
            retroactiveRounds.length > 0 &&
            retroactiveEntries.length > 0 &&
            availableCupOrders.length > 0 ? (
              <div className="mb-6">
                <RetroactiveCupRoundForm
                  cupId={selectedCup.id}
                  rounds={retroactiveRounds}
                  availableOrders={availableCupOrders}
                  entries={retroactiveEntries}
                  results={retroactiveResults}
                />
              </div>
            ) : null}

            <div className="space-y-3">
              {cupRounds.map((cupRound) => {
                const round = roundById.get(cupRound.round_id);
                const hasResults = resultRoundIds.has(cupRound.round_id);
                const closed = Boolean(cupRound.registration_closed_at) || hasResults;
                return (
                  <article
                    key={cupRound.round_id}
                    className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-slate-950">
                          {cupRound.cup_order}ª · {round?.name ?? `Etapa ${cupRound.round_id}`}
                        </span>
                        {closed
                          ? statusBadge(hasResults ? "Resultado publicado" : "Adesões encerradas", "slate")
                          : statusBadge("Adesões abertas", "green")}
                        {cupRound.retroactive_at
                          ? statusBadge("Inclusão retroativa", "amber")
                          : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {round ? `${formatDate(round.date)} · ${round.location}` : null}
                      </p>
                      {cupRound.retroactive_reason ? (
                        <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
                          Justificativa: {cupRound.retroactive_reason}
                        </p>
                      ) : null}
                    </div>
                    {cupRound.retroactive_at && !selectedCup.published_at ? (
                      <form
                        action={undoRetroactiveCupRound}
                        className="w-full space-y-2 sm:w-72"
                      >
                        <input type="hidden" name="cup_id" value={selectedCup.id} />
                        <input type="hidden" name="round_id" value={cupRound.round_id} />
                        <label className={labelClassName}>
                          Motivo para desfazer
                          <input
                            name="reason"
                            required
                            minLength={10}
                            maxLength={300}
                            className={inputClassName}
                            placeholder="Informe o motivo"
                          />
                        </label>
                        <SubmitButton
                          className="bg-slate-200 hover:bg-white"
                          pendingLabel="Desfazendo..."
                        >
                          Desfazer inclusão
                        </SubmitButton>
                      </form>
                    ) : !closed ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={closeCupRoundRegistrations}>
                          <input type="hidden" name="cup_id" value={selectedCup.id} />
                          <input type="hidden" name="round_id" value={cupRound.round_id} />
                          <SubmitButton pendingLabel="Encerrando...">
                            Encerrar adesões
                          </SubmitButton>
                        </form>
                        {!selectedCup.published_at ? (
                          <form action={removeCupRound}>
                            <input type="hidden" name="cup_id" value={selectedCup.id} />
                            <input type="hidden" name="round_id" value={cupRound.round_id} />
                            <SubmitButton className="bg-slate-200 hover:bg-white">
                              Remover
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {cupRounds.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-7 text-center text-sm text-slate-500">
                  Nenhuma etapa vinculada. Adicione uma etapa oficial antes de publicar.
                </p>
              ) : null}
            </div>
          </section>

          <section className={cardClassName}>
            <div className="mb-5">
              <h2 className="text-lg font-black text-slate-950">Pilotos participantes</h2>
              <p className="mt-1 text-sm text-slate-500">
                A adesão é opcional. {guestCount} piloto{guestCount === 1 ? " convidado foi desconsiderado" : "s convidados foram desconsiderados"} automaticamente.
              </p>
            </div>

            {availableEntries.length > 0 && openCupRounds.length > 0 ? (
              <form
                action={enrollCupEntry}
                className="mb-6 grid gap-4 rounded-lg border border-dashed border-slate-200 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
              >
                <input type="hidden" name="cup_id" value={selectedCup.id} />
                <label className={labelClassName}>
                  Piloto regular
                  <select name="entry_id" required className={inputClassName}>
                    <option value="">Selecione</option>
                    {availableEntries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {driverNames.get(entry.driver_id) ?? `Piloto ${entry.driver_id}`} · {teamNames.get(entry.team_id) ?? "Equipe"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClassName}>
                  Começa a pontuar em
                  <select name="first_round_id" required className={inputClassName}>
                    {openCupRounds.map((cupRound) => (
                      <option key={cupRound.round_id} value={cupRound.round_id}>
                        {cupRound.cup_order}ª · {roundById.get(cupRound.round_id)?.name}
                      </option>
                    ))}
                  </select>
                </label>
                <SubmitButton>Incluir piloto</SubmitButton>
              </form>
            ) : null}

            <div className="space-y-3">
              {cupEntries.map((cupEntry) => {
                const entry = entryById.get(cupEntry.entry_id);
                const firstRound = cupRoundByRoundId.get(cupEntry.first_round_id);
                const canRemove = !firstRound?.registration_closed_at &&
                  !resultRoundIds.has(cupEntry.first_round_id);
                return (
                  <article
                    key={cupEntry.entry_id}
                    className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-black text-slate-950">
                        {entry
                          ? driverNames.get(entry.driver_id)
                          : `Inscrição ${cupEntry.entry_id}`}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {entry ? teamNames.get(entry.team_id) : null} · pontua a partir da {firstRound?.cup_order ?? "?"}ª etapa
                      </p>
                    </div>
                    {canRemove ? (
                      <form action={removeCupEntry}>
                        <input type="hidden" name="cup_id" value={selectedCup.id} />
                        <input type="hidden" name="entry_id" value={cupEntry.entry_id} />
                        <SubmitButton className="bg-slate-200 hover:bg-white">
                          Remover adesão
                        </SubmitButton>
                      </form>
                    ) : (
                      statusBadge("Adesão consolidada", "slate")
                    )}
                  </article>
                );
              })}
              {cupEntries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-7 text-center text-sm text-slate-500">
                  Nenhum piloto aderiu à Mini Copa.
                </p>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

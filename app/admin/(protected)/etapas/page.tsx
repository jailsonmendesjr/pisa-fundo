import { SubmitButton } from "@/components/admin/submit-button";
import {
  Notice,
  PageHeading,
  cardClassName,
  inputClassName,
  labelClassName,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { createRound, updateRound } from "../../actions";

type PageProps = {
  searchParams: Promise<{ season?: string; success?: string; error?: string }>;
};

const RoundFields = ({
  round,
  nextOrder,
}: {
  round?: { name: string; date: string; location: string; order: number };
  nextOrder?: number;
}) => (
  <>
    <label className={labelClassName}>
      Ordem
      <input name="order" type="number" min={1} required defaultValue={round?.order ?? nextOrder} className={inputClassName} />
    </label>
    <label className={labelClassName}>
      Nome da etapa
      <input name="name" required maxLength={100} defaultValue={round?.name} className={inputClassName} placeholder="🇦🇺 Etapa 06" />
    </label>
    <label className={labelClassName}>
      Data
      <input name="date" type="date" required defaultValue={round?.date} className={inputClassName} />
    </label>
    <label className={labelClassName}>
      Local
      <input name="location" required maxLength={100} defaultValue={round?.location} className={inputClassName} placeholder="Jardim Camburi/ES" />
    </label>
  </>
);

export default async function RoundsAdminPage({ searchParams }: PageProps) {
  const [{ supabase }, query] = await Promise.all([requireAdmin(), searchParams]);
  const { data: seasons, error: seasonsError } = await supabase
    .from("championship_season")
    .select("id, name, year, is_active")
    .order("year", { ascending: false });
  if (seasonsError) throw seasonsError;

  const selectedSeasonId =
    Number.parseInt(query.season ?? "", 10) ||
    seasons?.find((season) => season.is_active)?.id ||
    seasons?.[0]?.id;
  const { data: rounds, error: roundsError } = selectedSeasonId
    ? await supabase
        .from("championship_round")
        .select("id, season_id, name, date, location, order")
        .eq("season_id", selectedSeasonId)
        .order("order")
    : { data: [], error: null };
  if (roundsError) throw roundsError;

  const nextOrder = Math.max(0, ...(rounds ?? []).map((round) => round.order)) + 1;

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Calendário"
        title="Etapas"
        description="Crie as próximas etapas e mantenha ordem, nome, data e local de cada evento."
      />
      <Notice success={query.success} error={query.error} />

      <section className={cardClassName}>
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className={`${labelClassName} flex-1`}>
            Campeonato
            <select name="season" defaultValue={selectedSeasonId} className={inputClassName}>
              {(seasons ?? []).map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} ({season.year}){season.is_active ? " — ativo" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-900 hover:border-red-500">
            Carregar
          </button>
        </form>
      </section>

      {selectedSeasonId ? (
        <section className={cardClassName}>
          <h2 className="mb-5 text-lg font-black text-slate-950">Nova etapa</h2>
          <form action={createRound} className="grid gap-4 md:grid-cols-[100px_1fr_180px_1fr_auto] md:items-end">
            <input type="hidden" name="season_id" value={selectedSeasonId} />
            <RoundFields nextOrder={nextOrder} />
            <SubmitButton>Criar etapa</SubmitButton>
          </form>
        </section>
      ) : null}

      <div className="space-y-4">
        {(rounds ?? []).map((round) => (
          <section key={round.id} className={cardClassName}>
            <form action={updateRound} className="grid gap-4 md:grid-cols-[100px_1fr_180px_1fr_auto] md:items-end">
              <input type="hidden" name="id" value={round.id} />
              <input type="hidden" name="season_id" value={round.season_id} />
              <RoundFields round={round} />
              <SubmitButton>Salvar</SubmitButton>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}

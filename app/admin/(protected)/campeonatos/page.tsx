import { SubmitButton } from "@/components/admin/submit-button";
import {
  Notice,
  PageHeading,
  cardClassName,
  inputClassName,
  labelClassName,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { activateSeason, createSeason, updateSeason } from "../../actions";

type PageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function SeasonsAdminPage({ searchParams }: PageProps) {
  const [{ supabase }, query] = await Promise.all([requireAdmin(), searchParams]);
  const { data: seasons, error } = await supabase
    .from("championship_season")
    .select("id, name, year, is_active")
    .order("year", { ascending: false });

  if (error) throw error;

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Configuração"
        title="Campeonatos"
        description="Mantenha o histórico e escolha qual campeonato está ativo. Apenas um pode ficar ativo por vez."
      />
      <Notice success={query.success} error={query.error} />

      <section className={cardClassName}>
        <h2 className="mb-5 text-lg font-black text-white">Novo campeonato</h2>
        <form action={createSeason} className="grid gap-4 md:grid-cols-[1fr_160px_auto] md:items-end">
          <label className={labelClassName}>
            Nome
            <input name="name" required maxLength={100} className={inputClassName} placeholder="Pisa Fundo 2027" />
          </label>
          <label className={labelClassName}>
            Ano
            <input name="year" type="number" min={2000} required className={inputClassName} placeholder="2027" />
          </label>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <input name="activate" type="checkbox" className="h-4 w-4 accent-amber-500" />
              Ativar ao criar
            </label>
            <SubmitButton>Criar campeonato</SubmitButton>
          </div>
        </form>
      </section>

      <div className="space-y-4">
        {(seasons ?? []).map((season) => (
          <section key={season.id} className={cardClassName}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  ID {season.id}
                </span>
                {season.is_active ? (
                  <span className="ml-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">
                    Ativo
                  </span>
                ) : null}
              </div>
              {!season.is_active ? (
                <form action={activateSeason}>
                  <input type="hidden" name="id" value={season.id} />
                  <SubmitButton className="bg-slate-200 hover:bg-white" pendingLabel="Ativando...">
                    Tornar ativo
                  </SubmitButton>
                </form>
              ) : null}
            </div>
            <form action={updateSeason} className="grid gap-4 md:grid-cols-[1fr_160px_auto] md:items-end">
              <input type="hidden" name="id" value={season.id} />
              <label className={labelClassName}>
                Nome
                <input name="name" defaultValue={season.name} required maxLength={100} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Ano
                <input name="year" type="number" min={2000} defaultValue={season.year} required className={inputClassName} />
              </label>
              <SubmitButton>Salvar</SubmitButton>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}

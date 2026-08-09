import { ColorField } from "@/components/admin/color-field";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  Notice,
  PageHeading,
  cardClassName,
  inputClassName,
  labelClassName,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { createTeam, updateTeam } from "../../actions";

type PageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function TeamsAdminPage({ searchParams }: PageProps) {
  const [{ supabase }, query] = await Promise.all([requireAdmin(), searchParams]);
  const { data: teams, error } = await supabase
    .from("championship_team")
    .select("id, name, slug, primary_color, secondary_color")
    .order("name");

  if (error) throw error;

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Cadastros"
        title="Equipes"
        description="Cadastre a identidade de cada equipe. As cores podem ser digitadas em hexadecimal ou escolhidas visualmente."
      />
      <Notice success={query.success} error={query.error} />

      <section className={cardClassName}>
        <h2 className="mb-5 text-lg font-black text-white">Nova equipe</h2>
        <form action={createTeam} className="grid gap-4 lg:grid-cols-2">
          <label className={labelClassName}>
            Nome
            <input name="name" required maxLength={100} className={inputClassName} placeholder="Nova equipe" />
          </label>
          <label className={labelClassName}>
            Slug opcional
            <input name="slug" maxLength={120} className={inputClassName} placeholder="gerado-automaticamente" />
          </label>
          <ColorField name="primary_color" label="Cor primária" defaultValue="#000000" />
          <ColorField name="secondary_color" label="Cor secundária" defaultValue="#FFFFFF" />
          <div className="lg:col-span-2">
            <SubmitButton>Criar equipe</SubmitButton>
          </div>
        </form>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {(teams ?? []).map((team) => (
          <section key={team.id} className={cardClassName}>
            <div className="mb-5 flex items-center gap-3">
              <span className="h-8 w-8 rounded-full border border-white/10" style={{ background: team.primary_color }} />
              <span className="h-8 w-8 rounded-full border border-white/10" style={{ background: team.secondary_color }} />
              <div>
                <h2 className="font-black text-white">{team.name}</h2>
                <p className="text-xs text-slate-500">ID {team.id}</p>
              </div>
            </div>
            <form action={updateTeam} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={team.id} />
              <label className={labelClassName}>
                Nome
                <input name="name" defaultValue={team.name} required maxLength={100} className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Slug
                <input name="slug" defaultValue={team.slug} maxLength={120} className={inputClassName} />
              </label>
              <ColorField name="primary_color" label="Cor primária" defaultValue={team.primary_color} />
              <ColorField name="secondary_color" label="Cor secundária" defaultValue={team.secondary_color} />
              <div className="sm:col-span-2">
                <SubmitButton>Salvar equipe</SubmitButton>
              </div>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}

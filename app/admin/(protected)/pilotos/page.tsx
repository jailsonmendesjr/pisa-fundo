import { SubmitButton } from "@/components/admin/submit-button";
import {
  Notice,
  PageHeading,
  cardClassName,
  inputClassName,
  labelClassName,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { createDriver, updateDriver } from "../../actions";

type PageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

const DriverFields = ({
  driver,
}: {
  driver?: { name: string; nickname: string; slug: string; number: number | null };
}) => (
  <>
    <label className={labelClassName}>
      Nome
      <input name="name" defaultValue={driver?.name} required maxLength={100} className={inputClassName} />
    </label>
    <label className={labelClassName}>
      Apelido
      <input name="nickname" defaultValue={driver?.nickname} maxLength={50} className={inputClassName} />
    </label>
    <label className={labelClassName}>
      Slug opcional
      <input name="slug" defaultValue={driver?.slug} maxLength={120} className={inputClassName} />
    </label>
    <label className={labelClassName}>
      Número
      <input name="number" type="number" min={0} defaultValue={driver?.number ?? ""} className={inputClassName} />
    </label>
  </>
);

export default async function DriversAdminPage({ searchParams }: PageProps) {
  const [{ supabase }, query] = await Promise.all([requireAdmin(), searchParams]);
  const { data: drivers, error } = await supabase
    .from("championship_driver")
    .select("id, name, nickname, slug, number")
    .order("name");

  if (error) throw error;

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Cadastros"
        title="Pilotos"
        description="Mantenha uma única ficha por piloto. A equipe e o número do carro são definidos na inscrição de cada campeonato."
      />
      <Notice success={query.success} error={query.error} />

      <section className={cardClassName}>
        <h2 className="mb-5 text-lg font-black text-white">Novo piloto</h2>
        <form action={createDriver} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <DriverFields />
          <div className="lg:col-span-4">
            <SubmitButton>Criar piloto</SubmitButton>
          </div>
        </form>
      </section>

      <div className="space-y-4">
        {(drivers ?? []).map((driver) => (
          <section key={driver.id} className={cardClassName}>
            <form action={updateDriver} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
              <input type="hidden" name="id" value={driver.id} />
              <DriverFields driver={driver} />
              <div className="flex items-center justify-between lg:col-span-4">
                <span className="text-xs font-bold text-slate-600">ID {driver.id}</span>
                <SubmitButton>Salvar piloto</SubmitButton>
              </div>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}

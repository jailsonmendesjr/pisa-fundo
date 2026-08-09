import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeading, cardClassName } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();
  const [seasonCount, teamCount, driverCount, roundCount, activeSeason] =
    await Promise.all([
      supabase.from("championship_season").select("id", { count: "exact", head: true }),
      supabase.from("championship_team").select("id", { count: "exact", head: true }),
      supabase.from("championship_driver").select("id", { count: "exact", head: true }),
      supabase.from("championship_round").select("id", { count: "exact", head: true }),
      supabase
        .from("championship_season")
        .select("id, name, year")
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  const cards = [
    ["Campeonatos", seasonCount.count ?? 0, "/admin/campeonatos"],
    ["Equipes", teamCount.count ?? 0, "/admin/equipes"],
    ["Pilotos", driverCount.count ?? 0, "/admin/pilotos"],
    ["Etapas", roundCount.count ?? 0, "/admin/etapas"],
  ] as const;

  const upcomingRounds = activeSeason.data
    ? await supabase
        .from("championship_round")
        .select("id, name, date, location, order")
        .eq("season_id", activeSeason.data.id)
        .order("order", { ascending: true })
    : { data: [] };

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Visão geral"
        title="Gestão do Pisa Fundo"
        description="Cadastre a próxima etapa, organize equipes e pilotos e publique resultados pelo mesmo fluxo protegido."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value, href]) => (
          <Link key={href} href={href} className={`${cardClassName} group transition hover:border-red-300`}>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-4xl font-black text-slate-950 group-hover:text-red-600">
              {value}
            </p>
          </Link>
        ))}
      </div>

      <section className={cardClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Campeonato ativo
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              {activeSeason.data?.name ?? "Nenhum campeonato ativo"}
            </h2>
          </div>
          <Link
            href="/admin/etapas"
            className="inline-flex items-center text-sm font-semibold text-red-600 hover:text-red-700"
          >
            Gerenciar etapas <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-6 divide-y divide-slate-200">
          {(upcomingRounds.data ?? []).map((round) => (
            <div key={round.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="mr-2 text-xs font-black text-red-600">
                  #{round.order}
                </span>
                <span className="font-bold text-slate-900">{round.name}</span>
                <p className="mt-1 text-xs text-slate-500">{round.location}</p>
              </div>
              <time className="text-sm text-slate-500">{round.date}</time>
            </div>
          ))}
          {(upcomingRounds.data ?? []).length === 0 ? (
            <p className="py-6 text-sm text-slate-500">Cadastre a primeira etapa deste campeonato.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

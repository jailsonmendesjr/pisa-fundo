import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { signOutAdmin } from "../login/actions";

const navigation = [
  ["Visão geral", "/admin"],
  ["Campeonatos", "/admin/campeonatos"],
  ["Equipes", "/admin/equipes"],
  ["Pilotos", "/admin/pilotos"],
  ["Inscrições", "/admin/inscricoes"],
  ["Etapas", "/admin/etapas"],
  ["Resultados", "/admin/resultados"],
  ["Configurações", "/admin/configuracoes"],
] as const;

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
              Painel administrativo
            </p>
            <p className="mt-1 text-sm text-slate-500">{admin.email}</p>
          </div>
          <form action={signOutAdmin}>
            <button
              type="submit"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
            >
              Sair
            </button>
          </form>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 py-3" aria-label="Administração">
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-red-700"
            >
              {label}
            </Link>
          ))}
        </nav>
      </section>

      {children}
    </div>
  );
}

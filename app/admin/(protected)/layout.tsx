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
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="flex flex-col gap-4 border-b border-slate-800 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">
              Painel administrativo
            </p>
            <p className="mt-1 text-sm text-slate-400">{admin.email}</p>
          </div>
          <form action={signOutAdmin}>
            <button
              type="submit"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
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
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-800 hover:text-amber-400"
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalAdmin } from "@/lib/admin/auth";
import { sendMagicLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    sent?: string;
    error?: string;
    signedOut?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const [admin, query] = await Promise.all([
    getOptionalAdmin(),
    searchParams,
  ]);

  if (admin) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-md items-center">
      <section className="w-full rounded-3xl border border-slate-800 bg-slate-900/70 p-7 shadow-2xl shadow-black/20 sm:p-9">
        <div className="mb-8 space-y-3">
          <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
            Área restrita
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Administração
          </h1>
          <p className="text-sm leading-6 text-slate-400">
            Informe o e-mail autorizado. Você receberá um link seguro para acessar o painel.
          </p>
        </div>

        {query.sent ? (
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Se o e-mail estiver autorizado, o link de acesso será enviado em instantes.
          </div>
        ) : null}
        {query.signedOut ? (
          <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/70 p-4 text-sm text-slate-300">
            Sessão encerrada com segurança.
          </div>
        ) : null}
        {query.error ? (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {query.error}
          </div>
        ) : null}

        <form action={sendMagicLink} className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-200">E-mail</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              placeholder="voce@exemplo.com"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-amber-500 px-4 py-3 font-black text-slate-950 transition hover:bg-amber-400"
          >
            Enviar link de acesso
          </button>
        </form>

        <Link
          href="/"
          className="mt-6 block text-center text-sm font-semibold text-slate-400 transition hover:text-white"
        >
          ← Voltar para o campeonato
        </Link>
      </section>
    </div>
  );
}

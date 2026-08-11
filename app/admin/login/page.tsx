import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { getOptionalAdmin } from "@/lib/admin/auth";
import { sendMagicLink, signInAdminWithPassword } from "./actions";

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
      <section className="w-full rounded-xl border border-slate-200 bg-white p-7 shadow-lg shadow-slate-950/5 sm:p-9">
        <div className="mb-8 space-y-3">
          <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
            Área restrita
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Administração
          </h1>
          <p className="text-sm leading-6 text-slate-500">
            Entre com o e-mail autorizado e sua senha do painel.
          </p>
        </div>

        {query.sent ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Se o e-mail estiver autorizado, o link de acesso será enviado em instantes.
          </div>
        ) : null}
        {query.signedOut ? (
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Sessão encerrada com segurança.
          </div>
        ) : null}
        {query.error ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {query.error}
          </div>
        ) : null}

        <form action={signInAdminWithPassword} className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">E-mail</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/15"
              placeholder="voce@exemplo.com"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Senha</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={72}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/15"
              placeholder="Sua senha"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-red-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-red-700"
          >
            Entrar
          </button>
          <div className="border-t border-slate-200 pt-5 text-center">
            <p className="mb-3 text-xs leading-5 text-slate-500">
              Primeiro acesso ou ainda não definiu uma senha?
            </p>
            <button
              type="submit"
              formAction={sendMagicLink}
              formNoValidate
              className="text-sm font-semibold text-red-600 transition hover:text-red-700"
            >
              Enviar link para definir a senha
            </button>
          </div>
        </form>

        <BackLink href="/" className="mt-6" />
      </section>
    </div>
  );
}

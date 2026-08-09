import { updateAdminPassword } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  Notice,
  PageHeading,
  cardClassName,
  inputClassName,
  labelClassName,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";

type PageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function AdminSettingsPage({ searchParams }: PageProps) {
  const [admin, query] = await Promise.all([requireAdmin(), searchParams]);

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Acesso"
        title="Configurações"
        description="Defina ou altere a senha usada para entrar no painel sem depender de novos e-mails."
      />
      <Notice success={query.success} error={query.error} />

      <section className={`${cardClassName} max-w-2xl`}>
        <div className="mb-6 space-y-2">
          <h2 className="text-xl font-black text-white">Senha administrativa</h2>
          <p className="text-sm leading-6 text-slate-400">
            A senha ficará vinculada à conta <strong className="text-slate-200">{admin.email}</strong> no Supabase Auth. Ela não será armazenada nas tabelas do campeonato.
          </p>
        </div>

        <form action={updateAdminPassword} className="space-y-5">
          <label className={labelClassName}>
            Nova senha
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              className={inputClassName}
            />
          </label>
          <label className={labelClassName}>
            Confirmar nova senha
            <input
              name="password_confirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              className={inputClassName}
            />
          </label>
          <div className="flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">
              Use pelo menos 8 caracteres. Um gerenciador de senhas é recomendado.
            </p>
            <SubmitButton pendingLabel="Atualizando..." className="px-6 py-3">
              Salvar senha
            </SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}

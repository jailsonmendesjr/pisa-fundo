# Pisa Fundo

Aplicação pública para acompanhar temporadas, etapas, classificação e
comparativos de performance do campeonato de kart Pisa Fundo.

## Arquitetura

- Next.js 16 com App Router, React 19 e TypeScript
- Tailwind CSS
- Supabase/Postgres como fonte de dados
- Vercel para build e hospedagem

O site público usa somente leitura através da chave publicável do Supabase. O
painel em `/admin` usa Supabase Auth e a mesma chave publicável: o JWT do usuário
e as políticas RLS autorizam escrita somente para contas presentes em
`app_admins`. Nenhuma chave `service_role` é usada pela aplicação.

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env.local` e preencha:

   ```dotenv
   SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ADMIN_EMAIL=admin@exemplo.com
   ```

3. Inicie o projeto:

   ```bash
   npm run dev
   ```

## Banco de dados

A migration em `supabase/migrations/` cria ou completa as tabelas esperadas
pelo código:

- `championship_season`
- `championship_team`
- `championship_driver`
- `championship_driverteamseason`
- `championship_round`
- `championship_roundresult`
- `app_admins`

As migrations também configuram índices, restrições, cálculo automático de
pontos, RLS, um único campeonato ativo e publicação atômica dos resultados de
uma etapa.

### Autorizar o primeiro administrador

Insira o e-mail permitido sem criar ou manipular diretamente `auth.users`:

```sql
insert into public.app_admins (email)
values (lower('admin@exemplo.com'));
```

No primeiro link mágico, o Supabase cria o usuário e o callback associa seu
UUID à autorização existente. Depois desse primeiro acesso, o cadastro público
por e-mail pode ser desabilitado no Supabase Auth.

Em **Authentication > URL Configuration**, configure a URL de produção como
Site URL e autorize `/auth/callback` para produção e desenvolvimento local.

### Gerar novamente a carga legada

O gerador valida relacionamentos e nunca exporta `auth.user` ou hashes de senha:

```bash
npm run generate:legacy-import -- caminho/backup.json supabase/migrations/migration.sql
```

## Vercel

Conecte o projeto Supabase existente ao projeto Vercel pela integração oficial.
Ela sincroniza `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` com os ambientes da
Vercel sem expor os segredos. Configure também `ADMIN_EMAIL` como variável
server-only em Production, Preview e Development. Depois de alterar variáveis,
gere um novo deployment.

## Verificação

```bash
npm run typecheck
npm run lint
npm run build
```

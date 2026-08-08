# Pisa Fundo

Aplicação pública para acompanhar temporadas, etapas, classificação e
comparativos de performance do campeonato de kart Pisa Fundo.

## Arquitetura

- Next.js 16 com App Router, React 19 e TypeScript
- Tailwind CSS
- Supabase/Postgres como fonte de dados
- Vercel para build e hospedagem

O frontend usa somente leitura através da chave publicável do Supabase. As
tabelas do campeonato têm RLS habilitado e políticas públicas apenas para
`SELECT`. Cadastros e alterações devem ser feitos por uma conexão administrativa
confiável ou pelo Table Editor do Supabase.

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env.local` e preencha:

   ```dotenv
   SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
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

Ela também configura índices, restrições, cálculo automático de pontos, RLS e
grants de leitura para `anon` e `authenticated`.

## Vercel

Conecte o projeto Supabase existente ao projeto Vercel pela integração oficial.
Ela sincroniza `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` com os ambientes da
Vercel sem expor os segredos. Como alternativa, configure essas duas variáveis
manualmente em Production, Preview e Development. Depois de alterar variáveis,
gere um novo deployment.

## Verificação

```bash
npm run typecheck
npm run lint
npm run build
```

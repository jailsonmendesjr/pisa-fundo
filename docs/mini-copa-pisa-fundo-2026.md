# Mini Copa Pisa Fundo 2026 — especificação para desenvolvimento

Status: fases 1 a 5 implementadas e validadas apenas localmente: migração aditiva, testes SQL isolados, gestão administrativa, motor individual de classificação, página pública condicionada à ativação, regressão e ensaio de rollback funcional. Ainda não houve migração nem publicação em produção. O regulamento público completo e a validação em um Supabase remoto permanecem pendentes.

## Evidências da validação local

- A migração foi reaplicada do zero no Supabase local e os verificadores de segurança e desempenho não apontaram alertas.
- Os testes de banco confirmaram restrições de temporada, convidados, adesão tardia, etapas encerradas, publicação, ocultação e permissões administrativas.
- Os testes do motor confirmaram pontuação oficial sem redistribuição e a sequência completa de desempate, inclusive o resultado real da quarta etapa.
- A navegação pública confirmou que convidados e regulares não participantes continuam no resultado oficial, mas não entram na classificação da Copa.
- O ensaio de rollback ocultou o atalho e bloqueou a página pública da Copa sem alterar a classificação oficial; a Copa foi reativada em seguida com seus vínculos e dados preservados.
- Tipagem, lint e build de produção concluíram sem erros.

## Objetivo e limites

Criar uma classificação individual paralela para quatro etapas do Campeonato Pisa Fundo 2026. As etapas, inscrições oficiais e resultados continuam sendo únicos e pertencendo ao campeonato oficial. A Copa apenas seleciona etapas e pilotos elegíveis e soma, sem recalcular ou redistribuir, os pontos já atribuídos aos resultados oficiais.

Fora do escopo da primeira versão: ranking de equipes na Copa, cadastro de piloto sem equipe no campeonato oficial, pontos extras, handicap, descarte de resultados, conversão de convidados em regulares após o início da Copa e cópia de etapas ou resultados.

## Decisões de negócio acordadas

1. A Copa contém quatro etapas oficiais de 2026. Elas são vinculadas explicitamente à Copa quando cadastradas ou editadas; não são escolhidas automaticamente por data nem duplicadas.
2. Uma etapa gera um único resultado por piloto. A pontuação do resultado vale normalmente no campeonato oficial e, quando elegível, também compõe o total da Copa. Isso não dobra os pontos do campeonato oficial.
3. Apenas pilotos regulares inscritos no campeonato oficial podem aderir à Copa. A adesão é opcional, inclusive para pilotos regulares que corram as etapas da Copa.
4. Um convidado aparece no resultado da etapa e recebe a pontuação associada à sua posição, mas não aparece nos rankings oficial ou da Copa. Um regular não inscrito na Copa aparece no ranking oficial, mas não no da Copa.
5. Posições, pontos e bônus de volta rápida não são redistribuídos quando convidados ou regulares não participantes terminam à frente de participantes da Copa.
6. Novos pilotos continuam vinculados a equipes no campeonato oficial. A Copa não exibe nem agrega equipes.
7. A adesão tardia é permitida antes de uma etapa da Copa. Apenas resultados a partir da primeira etapa elegível são contabilizados. A única exceção é a inclusão retroativa controlada de uma etapa já realizada, enquanto a Copa ainda estiver em rascunho, para registrar uma lista de participantes que já havia sido definida antes da divulgação do resultado.
8. O administrador encerra as adesões daquela etapa antes da largada. Não é permitido optar por aderir depois de conhecido o resultado.
9. Após o início da Copa, convidados não são transformados em pilotos regulares para ingressar nela. A identidade e a condição de convidado de uma inscrição vinculada à Copa não podem ser trocadas de forma a reatribuir resultados anteriores.

## Modelo de dados proposto

Criar estruturas novas, sem alterar os dados das tabelas oficiais:

- **Copa:** nome, temporada oficial de origem, data de publicação e ativação pública independente. Desativar oculta a Copa sem apagar sua publicação, etapas ou adesões.
- **Etapas da Copa:** vínculo entre Copa e etapa oficial, ordem dentro da Copa (1 a 4) e estado de adesões dessa etapa (abertas/encerradas). Uma etapa só pode entrar uma vez na mesma Copa e deve pertencer à temporada oficial de origem.
- **Adesões:** vínculo entre Copa e inscrição oficial do piloto, com primeira etapa elegível e registro de quando/por quem a adesão foi feita. Um piloto só pode aderir uma vez à mesma Copa; inscrição convidada ou de outra temporada é inelegível. Não armazenar pontos na adesão.

Restrições de unicidade, chaves estrangeiras e validações no servidor devem proteger esses vínculos. As novas tabelas precisam de RLS: leitura pública apenas dos dados publicados e escrita apenas para administradores autorizados. Qualquer índice necessário deve acompanhar as relações consultadas. Os tipos do Supabase devem ser regenerados após a migração.

## Fluxo administrativo

1. Criar a Copa em rascunho, apontando para o Campeonato 2026.
2. Ao criar ou editar uma etapa oficial de 2026, oferecer “Incluir na Mini Copa”. Permitir vincular até quatro etapas, exibindo quais já estão confirmadas. As quatro etapas não precisam existir no momento da criação da Copa.
3. Na gestão da Copa, listar inscrições regulares da temporada, distinguindo pilotos já aderidos, regulares disponíveis e convidados inelegíveis. Oferecer adesão ao cadastrar um novo piloto regular e seleção dos pilotos já cadastrados.
4. Antes da largada de cada etapa, revisar a lista e acionar “Encerrar adesões”. Depois disso, não permitir adesões com início nessa etapa; uma nova adesão poderá começar na próxima etapa ainda aberta. Se a configuração da Copa ocorrer depois de uma etapa já realizada, usar o fluxo excepcional “Incluir etapa já realizada”, selecionar a lista previamente combinada, revisar os pontos oficiais, confirmar a declaração e registrar a justificativa. A etapa entra com adesões encerradas.
5. Publicar o resultado apenas pelo fluxo oficial já existente. A classificação da Copa é derivada automaticamente dos resultados publicados das etapas vinculadas.
6. Correções excepcionais de adesão ou de vínculo de etapa após seu encerramento exigem fluxo administrativo separado, com prévia do impacto, declaração explícita e registro auditável da justificativa; não serão alterações silenciosas por checkbox. A inclusão retroativa pode ser desfeita enquanto a Copa permanecer em rascunho, sem excluir ou alterar a etapa e os resultados oficiais.

## Cálculo e apresentação

- Consultar somente etapas vinculadas à Copa e resultados oficiais nelas publicados.
- Incluir somente adesões elegíveis cuja primeira etapa seja igual ou anterior à etapa do resultado.
- Somar o campo de pontos do resultado oficial; contar vitórias e pódios apenas por posições reais da corrida, dentro do período elegível. DNF e DNS permanecem com zero.
- Não considerar etapa futura como zero, nem ausência de resultado como DNS. Exibir separadamente “inscritos” e “classificação”; contextualizar etapas disputadas/publicadas.
- Mostrar uma página própria da Copa com regulamento resumido, etapas, classificação individual e ligação para os resultados oficiais. O campeonato geral e o ranking de equipes permanecem nas páginas atuais.
- Quando a Copa estiver desativada, ocultar links e impedir acesso público à sua página sem tornar a página oficial dependente das novas consultas.

### Desempate da Copa

Ordenar por pontos, vitórias e pódios obtidos somente nas etapas elegíveis da Copa. Persistindo o empate, vence quem tiver o melhor resultado na última etapa válida da Copa, considerando a posição real da corrida, sem retirar convidados ou não participantes da frente. Uma chegada concluída supera DNF, DNS ou ausência. Se nenhum dos pilotos empatados concluir essa etapa, o empate permanece; a ordem alfabética não decide o título. Antes da publicação do resultado da etapa final, esse último critério não deve ser aplicado e o empate é provisório.

O motor implementado mantém posições compartilhadas nos empates reais, usando ordem alfabética somente para apresentação estável. Os pontos são lidos diretamente do resultado oficial; o cálculo da Copa não reaplica a tabela nem transfere pontos, posições ou bônus.

### Regulamento público futuro

Antes do lançamento da Copa, criar um documento de regulamento acessível aos pilotos. Ele deve explicar elegibilidade, adesão tardia sem pontos retroativos, encerramento de adesões antes da largada, pontuação sem redistribuição, tratamento de convidados e o desempate acima. Este documento público não faz parte da entrega de planejamento atual.

## Segurança de implantação e rollback

1. Registrar um baseline dos resultados, rankings e principais páginas oficiais; fazer backup do banco antes da migração.
2. Validar a migração aditiva e os casos de segurança em ambiente de teste. Confirmar que o código anterior ainda funciona com as novas estruturas presentes.
3. Implantar o código com a Copa desativada por um controle independente de publicação. Verificar campeonato oficial, resultados, inscrições, equipes e API antes de ativar a Copa.
4. Ativar a Copa apenas após revisar etapas, adesões e pontuação calculada.
5. Em incidente, desativar a Copa ou voltar ao deployment anterior. Não apagar etapas ou resultados oficiais. A remoção física das estruturas da Copa é uma operação posterior, opcional e condicionada a backup.

Rollback funcional significa retornar à experiência atual do campeonato oficial; não significa apagar automaticamente os dados históricos da Copa nem desfazer correções legítimas feitas nos resultados oficiais.

## Critérios de aceite essenciais

1. Cadastrar uma etapa vinculada à Copa não cria outra etapa nem outro resultado; sua publicação atualiza os rankings oficial e da Copa conforme a elegibilidade.
2. Um regular participante recebe na Copa os mesmos pontos do seu resultado oficial. O total do campeonato oficial permanece inalterado pela existência da Copa.
3. Um regular não participante mantém seus pontos oficiais, mas não aparece na classificação da Copa. Um convidado consta no resultado da etapa, mas não aparece em nenhum dos dois rankings.
4. Se um convidado ou não participante chegar em primeiro, os demais pilotos conservam os pontos de suas posições reais; não há redistribuição nem bônus transferido.
5. Uma adesão a partir da terceira etapa contabiliza apenas terceira e quarta etapas, mesmo que existam resultados do piloto nas duas primeiras.
6. Adesão à etapa encerrada é recusada no servidor. Inscrição convidada, de outra temporada ou duplicada também é recusada.
7. Uma correção de resultado oficial recalcula a Copa sem sincronização manual ou resultados órfãos.
8. A Copa aceita até quatro etapas da temporada correta; etapas de outra temporada e vínculos duplicados são rejeitados.
9. Não é possível converter convidado em regular após o início da Copa nem reatribuir a outro piloto uma inscrição já vinculada, inclusive por envio direto da ação administrativa.
10. Com a Copa desativada ou o código anterior reimplantado, todas as páginas e operações oficiais continuam funcionando e exibindo os mesmos resultados e rankings.
11. Empates aplicam pontos, vitórias, pódios e, somente após a última etapa válida publicada, o melhor resultado real nessa etapa. Se nenhum empatado a concluir, o empate permanece, sem desempate alfabético.

## Sequência sugerida de entrega

1. Testes de regra e migração aditiva, com políticas RLS e tipos atualizados.
2. Gestão administrativa de etapas, adesões e encerramento de inscrições.
3. Cálculo e testes da classificação individual, isolados do cálculo oficial.
4. Página pública da Copa e controle de ativação.
5. Regressão completa, teste de rollback e publicação gradual.

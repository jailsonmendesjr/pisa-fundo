/**
 * lib/validation.ts
 *
 * Regras de validacao de negocio do Campeonato Pisa Fundo.
 *
 * Estas funcoes portam as validacoes do Django (metodos `clean()` dos
 * models) para o contexto das API Routes do Next.js, onde cada validacao
 * deve ser executada ANTES de um INSERT ou UPDATE no Supabase.
 *
 * IMPORTANTE: As funcoes desta lib recebem um cliente do Supabase (ou
 * qualquer adapter que implemente a interface QueryAdapter) como parametro,
 * mantendo o nucleo testavel de forma isolada. Para testes unitarios,
 * utilize o MockQueryAdapter fornecido ao final do arquivo.
 *
 * Correspondencias com o Django:
 *   - DriverTeamSeason.clean()  -> validateTeamDriverCount()
 *   - RoundResult.clean()       -> validateUniqueFastestLap()
 *                               -> validateUniquePosition()
 */

import type { ResultStatus } from "./scoring";

// ---------------------------------------------------------------------------
// 1. INTERFACE DO ADAPTER DE CONSULTA
// ---------------------------------------------------------------------------

/**
 * Interface minima que o cliente de banco de dados deve implementar
 * para que as funcoes de validacao possam consultar dados.
 *
 * Na pratica, o SupabaseClient satisfaz esta interface.
 * Para testes, use o MockQueryAdapter abaixo.
 */
export interface QueryAdapter {
  /**
   * Conta registros numa tabela com filtros aplicados.
   *
   * @param table   Nome da tabela no Supabase.
   * @param filters Objeto de filtros { coluna: valor }.
   * @param excludeId Se informado, exclui este registro da contagem
   *                  (usado para validacoes de UPDATE — "exceto eu mesmo").
   * @returns O numero de registros que atendem aos filtros.
   */
  count(
    table: string,
    filters: Record<string, unknown>,
    excludeId?: string
  ): Promise<number>;
}

// ---------------------------------------------------------------------------
// 2. RESULTADO PADRAO DE VALIDACAO
// ---------------------------------------------------------------------------

/**
 * Resultado retornado por todas as funcoes de validacao.
 * Inspirado no padrao Result/Either para evitar uso de excecoes
 * como fluxo de controle.
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/** Helper para criar um resultado de sucesso. */
export const valid = (): ValidationResult => ({ valid: true });

/** Helper para criar um resultado de falha com mensagem. */
export const invalid = (error: string): ValidationResult => ({
  valid: false,
  error,
});

// ---------------------------------------------------------------------------
// 3. VALIDACOES DE INSCRICAO (DriverTeamSeason)
// ---------------------------------------------------------------------------

/**
 * Valida que uma equipe nao ultrapasse o limite de 2 pilotos por temporada.
 *
 * Porta DriverTeamSeason.clean() em models.py (linhas 76-81):
 *   if existing.count() >= 2:
 *     raise ValidationError("Esta equipe ja tem 2 pilotos nesta temporada.")
 *
 * Use esta funcao antes de INSERT ou UPDATE em `driver_team_season`.
 *
 * @param db          Adapter de consulta ao banco.
 * @param seasonId    ID da temporada.
 * @param teamId      ID da equipe a ser validada.
 * @param excludeEntryId  ID da inscricao atual (em updates, para ignorar
 *                        o proprio registro na contagem). Null em inserts.
 *
 * @example
 * // Em uma API Route de criacao de inscricao:
 * const result = await validateTeamDriverCount(supabase, seasonId, teamId);
 * if (!result.valid) return NextResponse.json({ error: result.error }, { status: 422 });
 */
export async function validateTeamDriverCount(
  db: QueryAdapter,
  seasonId: string,
  teamId: string,
  excludeEntryId?: string
): Promise<ValidationResult> {
  const count = await db.count(
    "driver_team_season",
    { season_id: seasonId, team_id: teamId },
    excludeEntryId
  );

  if (count >= 2) {
    return invalid(
      "Esta equipe ja tem 2 pilotos nesta temporada. Remova um piloto antes de adicionar outro."
    );
  }

  return valid();
}

/**
 * Valida que um piloto nao esta inscrito em mais de uma equipe na mesma temporada.
 *
 * Complementa a restricao `unique_together = ("season", "driver")` do modelo Django.
 * Embora o banco ja imponha esta restricao via UNIQUE, e uma boa pratica
 * validar antes para retornar uma mensagem de erro amigavel.
 *
 * @param db            Adapter de consulta ao banco.
 * @param seasonId      ID da temporada.
 * @param driverId      ID do piloto.
 * @param excludeEntryId  ID da inscricao atual (para updates).
 */
export async function validateDriverUniquePerSeason(
  db: QueryAdapter,
  seasonId: string,
  driverId: string,
  excludeEntryId?: string
): Promise<ValidationResult> {
  const count = await db.count(
    "driver_team_season",
    { season_id: seasonId, driver_id: driverId },
    excludeEntryId
  );

  if (count >= 1) {
    return invalid(
      "Este piloto ja esta inscrito em outra equipe nesta temporada."
    );
  }

  return valid();
}

// ---------------------------------------------------------------------------
// 4. VALIDACOES DE RESULTADO DE CORRIDA (RoundResult)
// ---------------------------------------------------------------------------

/**
 * Valida que apenas um piloto tem a volta mais rapida em uma etapa.
 *
 * Porta a primeira parte de RoundResult.clean() em models.py (linhas 129-135):
 *   if self.fastest_lap:
 *     existing = RoundResult.objects.filter(round=self.round, fastest_lap=True)
 *     if existing.exists():
 *       raise ValidationError("Ja existe um piloto com a volta mais rapida nesta etapa.")
 *
 * Use esta funcao SOMENTE quando fastestLap == true.
 *
 * @param db              Adapter de consulta ao banco.
 * @param roundId         ID da etapa.
 * @param fastestLap      Flag de volta mais rapida do resultado sendo salvo.
 * @param excludeResultId ID do resultado atual (para updates).
 *
 * @example
 * const result = await validateUniqueFastestLap(supabase, roundId, true);
 * if (!result.valid) return NextResponse.json({ error: result.error }, { status: 422 });
 */
export async function validateUniqueFastestLap(
  db: QueryAdapter,
  roundId: string,
  fastestLap: boolean,
  excludeResultId?: string
): Promise<ValidationResult> {
  // So precisa validar se o resultado sendo salvo tem volta rapida.
  if (!fastestLap) return valid();

  const count = await db.count(
    "round_result",
    { round_id: roundId, fastest_lap: true },
    excludeResultId
  );

  if (count >= 1) {
    return invalid(
      "Ja existe um piloto com a volta mais rapida nesta etapa. " +
        "Remova o marcador do piloto anterior antes de atribuir a outro."
    );
  }

  return valid();
}

/**
 * Valida que a posicao de chegada e unica dentro de uma etapa.
 *
 * Porta a segunda parte de RoundResult.clean() em models.py (linhas 137-143):
 *   if self.status != 'DNS':
 *     existing_pos = RoundResult.objects.filter(round=self.round, position=self.position)
 *     if existing_pos.exists():
 *       raise ValidationError(...)
 *
 * Pilotos com status DNS podem ter posicao duplicada (regra original do Django).
 *
 * @param db              Adapter de consulta ao banco.
 * @param roundId         ID da etapa.
 * @param position        Posicao de chegada do resultado sendo salvo.
 * @param status          Status do resultado. DNS ignora a validacao.
 * @param excludeResultId ID do resultado atual (para updates).
 */
export async function validateUniquePosition(
  db: QueryAdapter,
  roundId: string,
  position: number,
  status: ResultStatus,
  excludeResultId?: string
): Promise<ValidationResult> {
  // DNS nao tem posicao definida — a validacao nao se aplica.
  if (status === "DNS") return valid();

  const count = await db.count(
    "round_result",
    { round_id: roundId, position },
    excludeResultId
  );

  if (count >= 1) {
    return invalid(
      `A posicao ${position} ja foi registrada para outro piloto nesta etapa.`
    );
  }

  return valid();
}

// ---------------------------------------------------------------------------
// 5. FUNCAO COMPOSITA DE VALIDACAO DE RESULTADO
// ---------------------------------------------------------------------------

/**
 * Executa todas as validacoes de um RoundResult em sequencia.
 * Para imediatamente ao encontrar o primeiro erro (fail-fast).
 *
 * Uso tipico em uma API Route de criacao/edicao de resultado:
 *
 * @example
 * const validation = await validateRoundResult(supabase, {
 *   roundId,
 *   position: 1,
 *   status: "COMPLETED",
 *   fastestLap: true,
 *   excludeResultId: undefined, // null em inserts
 * });
 * if (!validation.valid) {
 *   return NextResponse.json({ error: validation.error }, { status: 422 });
 * }
 */
export interface RoundResultValidationInput {
  roundId: string;
  position: number;
  status: ResultStatus;
  fastestLap: boolean;
  /** Preencher apenas em operacoes de UPDATE (PATCH). */
  excludeResultId?: string;
}

export async function validateRoundResult(
  db: QueryAdapter,
  input: RoundResultValidationInput
): Promise<ValidationResult> {
  const { roundId, position, status, fastestLap, excludeResultId } = input;

  // Valida unicidade de posicao (exceto DNS)
  const positionCheck = await validateUniquePosition(
    db,
    roundId,
    position,
    status,
    excludeResultId
  );
  if (!positionCheck.valid) return positionCheck;

  // Valida unicidade de volta rapida
  const fastestLapCheck = await validateUniqueFastestLap(
    db,
    roundId,
    fastestLap,
    excludeResultId
  );
  if (!fastestLapCheck.valid) return fastestLapCheck;

  return valid();
}

/**
 * Executa todas as validacoes de uma inscricao (DriverTeamSeason) em sequencia.
 *
 * @example
 * const validation = await validateDriverEntry(supabase, {
 *   seasonId,
 *   teamId,
 *   driverId,
 *   excludeEntryId: undefined,
 * });
 * if (!validation.valid) {
 *   return NextResponse.json({ error: validation.error }, { status: 422 });
 * }
 */
export interface DriverEntryValidationInput {
  seasonId: string;
  teamId: string;
  driverId: string;
  excludeEntryId?: string;
}

export async function validateDriverEntry(
  db: QueryAdapter,
  input: DriverEntryValidationInput
): Promise<ValidationResult> {
  const { seasonId, teamId, driverId, excludeEntryId } = input;

  // Valida limite de 2 pilotos por equipe
  const teamCheck = await validateTeamDriverCount(
    db,
    seasonId,
    teamId,
    excludeEntryId
  );
  if (!teamCheck.valid) return teamCheck;

  // Valida que o piloto nao esta em outra equipe na mesma temporada
  const driverCheck = await validateDriverUniquePerSeason(
    db,
    seasonId,
    driverId,
    excludeEntryId
  );
  if (!driverCheck.valid) return driverCheck;

  return valid();
}

// ---------------------------------------------------------------------------
// 6. MOCK ADAPTER PARA TESTES UNITARIOS
// ---------------------------------------------------------------------------

/**
 * Implementacao mock do QueryAdapter para uso em testes.
 *
 * Permite simular contagens sem acesso real ao banco de dados.
 *
 * @example
 * // Simula que ja existe 1 piloto com volta rapida na etapa
 * const mock = new MockQueryAdapter({ round_result: 1 });
 * const result = await validateUniqueFastestLap(mock, "round-1", true);
 * // result => { valid: false, error: "Ja existe um piloto..." }
 *
 * // Simula banco vazio
 * const emptyMock = new MockQueryAdapter({});
 * const result2 = await validateUniqueFastestLap(emptyMock, "round-1", true);
 * // result2 => { valid: true }
 */
export class MockQueryAdapter implements QueryAdapter {
  /**
   * @param mockCounts Mapa de tabela -> contagem simulada a ser retornada.
   *                   Se a tabela nao estiver no mapa, retorna 0.
   */
  constructor(private readonly mockCounts: Record<string, number> = {}) {}

  async count(
    table: string,
    _filters: Record<string, unknown>,
    _excludeId?: string
  ): Promise<number> {
    return this.mockCounts[table] ?? 0;
  }
}

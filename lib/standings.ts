/**
 * lib/standings.ts
 *
 * Camada de acesso a dados para calcular classificacoes e performance.
 * Conecta as funcoes puras de lib/scoring.ts ao cliente Supabase.
 *
 * Porta as seguintes views do Django para o Next.js:
 *   - calculate_standings()         -> views.py (linhas 9-111)
 *   - season_detail() [logica]      -> views.py (linhas 113-153)
 *   - get_driver_performance_data() -> views.py (linhas 162-207)
 *
 * ESTRUTURA DAS TABELAS NO SUPABASE (equivalente ao models.py):
 *
 *   seasons          <- championship.Season
 *     id, name, year, is_active
 *
 *   teams            <- championship.Team
 *     id, name, slug, primary_color, secondary_color
 *
 *   drivers          <- championship.Driver
 *     id, name, nickname, slug, number
 *
 *   driver_team_season <- championship.DriverTeamSeason  [tabela pivô]
 *     id, season_id, team_id, driver_id, car_number, is_guest
 *
 *   rounds           <- championship.Round
 *     id, season_id, name, date, location, order
 *
 *   round_results    <- championship.RoundResult
 *     id, round_id, entry_id (FK -> driver_team_season), position,
 *     status, has_penalty, penalty_reason, fastest_lap, points
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  accumulateDriverPoints,
  applyDriverPositionChanges,
  applyTeamPositionChanges,
  buildTeamStandings,
  sortDriverStandings,
  sortTeamStandings,
  type DriverStandingEntry,
  type RaceResult,
  type ResultStatus,
  type TeamStandingEntry,
} from "./scoring";

// ---------------------------------------------------------------------------
// 1. TIPOS DE RETORNO DAS FUNCOES
// ---------------------------------------------------------------------------

/** Retorno completo do calculo de classificacao de uma temporada. */
export interface SeasonStandings {
  /** Ranking de pilotos (ja ordenado e com position + change). */
  drivers: DriverStandingEntry[];
  /** Ranking de equipes (ja ordenado e com position + change). */
  teams: TeamStandingEntry[];
}

/** Estrutura de dados de performance de um piloto para os graficos. */
export interface DriverPerformanceData {
  name: string;
  teamName: string;
  teamColor: string;
  totalPoints: number;
  /** Melhor posicao na temporada. '-' se nunca completou uma corrida. */
  bestPosition: number | "-";
  fastLaps: number;
  /** Labels dos eixos X: ["R1", "R2", ...] */
  labels: string[];
  /** Pontos acumulados por etapa: [0, 18, 36, ...] */
  dataPoints: number[];
  /** Posicao de chegada por etapa: [2, 1, null, ...] null = nao correu */
  dataPositions: (number | null)[];
}

// ---------------------------------------------------------------------------
// 2. HELPERS INTERNOS DE FETCH
// ---------------------------------------------------------------------------

/**
 * Busca todas as etapas de uma temporada ordenadas por 'order'.
 * Retorna os IDs e dados basicos de cada etapa.
 */
async function fetchRounds(
  supabase: SupabaseClient,
  seasonId: string
): Promise<Array<{ id: string; order: number; name: string; date: string; location: string }>> {
  const { data, error } = await supabase
    .from("rounds")
    .select("id, order, name, date, location")
    .eq("season_id", seasonId)
    .order("order", { ascending: true });

  if (error) {
    throw new Error(`[standings] Erro ao buscar etapas: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Busca todas as inscricoes de pilotos de uma temporada.
 * Ja faz o JOIN com drivers e teams via embed do Supabase.
 * Por padrao, exclui convidados (is_guest = false).
 */
async function fetchEntries(
  supabase: SupabaseClient,
  seasonId: string,
  includeGuests = false
): Promise<DriverStandingEntry[]> {
  let query = supabase
    .from("driver_team_season")
    .select(
      `
      id,
      car_number,
      is_guest,
      drivers ( id, name ),
      teams   ( id, name, primary_color )
      `
    )
    .eq("season_id", seasonId);

  // Espelha: DriverTeamSeason.objects.filter(season=season, is_guest=False)
  // views.py linha 22-25
  if (!includeGuests) {
    query = query.eq("is_guest", false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`[standings] Erro ao buscar inscricoes: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    entryId: String(row.id),
    driverId: String(row.drivers.id),
    driverName: row.drivers.name as string,
    teamId: String(row.teams.id),
    teamName: row.teams.name as string,
    teamColor: row.teams.primary_color as string,
    carNumber: row.car_number as number | null,
    isGuest: row.is_guest as boolean,
    totalPoints: 0,
    wins: 0,
    podiums: 0,
  }));
}

/**
 * Busca todos os resultados de um conjunto de IDs de etapas.
 * Retorna apenas os campos necessarios para o motor de calculo.
 */
async function fetchResultsForRounds(
  supabase: SupabaseClient,
  roundIds: string[]
): Promise<RaceResult[]> {
  if (roundIds.length === 0) return [];

  const { data, error } = await supabase
    .from("round_results")
    .select("entry_id, points, position, status")
    .in("round_id", roundIds);

  if (error) {
    throw new Error(`[standings] Erro ao buscar resultados: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    entryId: String(row.entry_id),
    points: row.points as number,
    position: row.position as number,
    status: row.status as ResultStatus,
  }));
}

// ---------------------------------------------------------------------------
// 3. FUNCAO PRINCIPAL: calculateStandings
// ---------------------------------------------------------------------------

/**
 * Calcula o ranking completo de pilotos e equipes para uma temporada.
 *
 * Porta fiel da funcao `calculate_standings()` em views.py (linhas 9-111)
 * combinada com a logica de comparacao de posicoes de `season_detail()`
 * (views.py linhas 119-133).
 *
 * FLUXO:
 *   1. Busca etapas da temporada, podendo excluir a ultima (para comparacao).
 *   2. Busca inscricoes de pilotos titulares (is_guest = false).
 *   3. Busca todos os resultados das etapas selecionadas.
 *   4. Acumula pontos/vitorias/podios nos pilotos.
 *   5. Ordena pilotos com desempate em cascata.
 *   6. Agrega e ordena equipes.
 *   7. Se houver mais de 1 etapa, calcula o ranking anterior (sem a ultima)
 *      e gera as variacoes de posicao (change).
 *
 * @param supabase         Cliente Supabase (server-side, usando service role ou anon).
 * @param seasonId         ID da temporada a calcular.
 * @param excludeLastRound Se true, exclui a ultima etapa do calculo.
 *                         Usado internamente para calcular o ranking anterior.
 * @returns SeasonStandings com drivers e teams ja ordenados e com change preenchido.
 *
 * @example
 * // Na API Route /api/seasons/[seasonId]/standings/route.ts:
 * const standings = await calculateStandings(supabase, params.seasonId);
 * return NextResponse.json(standings);
 */
export async function calculateStandings(
  supabase: SupabaseClient,
  seasonId: string,
  excludeLastRound = false
): Promise<SeasonStandings> {
  // 1. Busca todas as etapas da temporada
  let rounds = await fetchRounds(supabase, seasonId);

  // Espelha: if exclude_last_round and rounds: rounds = rounds[:-1]
  // views.py linha 15-16
  if (excludeLastRound && rounds.length > 0) {
    rounds = rounds.slice(0, -1);
  }

  const roundIds = rounds.map((r) => r.id);

  // 2. Busca inscricoes (apenas titulares, sem convidados)
  const entries = await fetchEntries(supabase, seasonId, false);

  // 3. Busca resultados de todas as etapas relevantes
  const results = await fetchResultsForRounds(supabase, roundIds);

  // 4. Acumula pontos, vitorias e podios
  const accumulatedEntries = accumulateDriverPoints(entries, results);

  // 5. Ordena pilotos com desempate em cascata
  const sortedDrivers = sortDriverStandings(accumulatedEntries);

  // 6. Agrega e ordena equipes
  const teamEntries = buildTeamStandings(sortedDrivers);
  const sortedTeams = sortTeamStandings(teamEntries);

  return { drivers: sortedDrivers, teams: sortedTeams };
}

/**
 * Calcula a classificacao completa de uma temporada com indicadores de
 * evolucao de posicao (change), executando o calculo duas vezes:
 * uma com todas as etapas e outra sem a ultima.
 *
 * Porta a logica composta de `season_detail()` em views.py (linhas 113-153).
 *
 * Se houver apenas 1 etapa (ou nenhuma), o change e definido como 0 para todos.
 *
 * @param supabase  Cliente Supabase.
 * @param seasonId  ID da temporada.
 * @returns SeasonStandings com change preenchido em drivers e teams.
 *
 * @example
 * // Na page.tsx de /season/[seasonId]:
 * const standings = await getSeasonStandingsWithChanges(supabase, seasonId);
 */
export async function getSeasonStandingsWithChanges(
  supabase: SupabaseClient,
  seasonId: string
): Promise<SeasonStandings> {
  // Busca etapas para saber se ha mais de 1 (necessario para calcular change)
  const allRounds = await fetchRounds(supabase, seasonId);

  // Calcula o ranking atual (com todas as etapas)
  const current = await calculateStandings(supabase, seasonId, false);

  // Espelha: if rounds_count > 1: ... (views.py linhas 119-133)
  if (allRounds.length > 1) {
    // Calcula o ranking anterior (sem a ultima etapa)
    const previous = await calculateStandings(supabase, seasonId, true);

    // Aplica variacoes nos pilotos
    const driversWithChange = applyDriverPositionChanges(
      current.drivers,
      previous.drivers
    );

    // Aplica variacoes nas equipes
    const teamsWithChange = applyTeamPositionChanges(
      current.teams,
      previous.teams
    );

    return { drivers: driversWithChange, teams: teamsWithChange };
  }

  // Apenas 1 etapa ou nenhuma: change = 0 para todos
  const driversWithZeroChange = current.drivers.map((d) => ({
    ...d,
    change: 0,
  }));
  const teamsWithZeroChange = current.teams.map((t) => ({
    ...t,
    change: 0,
  }));

  return { drivers: driversWithZeroChange, teams: teamsWithZeroChange };
}

// ---------------------------------------------------------------------------
// 4. FUNCAO DE PERFORMANCE: getDriverPerformanceData
// ---------------------------------------------------------------------------

/**
 * Coleta os dados de performance de um piloto especifico em uma temporada,
 * montando os arrays de labels, pontos acumulados e posicoes para os graficos.
 *
 * Porta fiel de `get_driver_performance_data()` em views.py (linhas 162-207).
 *
 * LOGICA:
 *   - Itera sobre cada etapa em ordem.
 *   - Para cada etapa, busca o resultado do piloto.
 *   - Se encontrou resultado: acumula pontos, registra posicao, conta volta rapida.
 *   - Se nao participou: mantem total acumulado, posicao = null.
 *
 * @param supabase   Cliente Supabase.
 * @param seasonId   ID da temporada.
 * @param driverId   ID do piloto (tabela drivers.id).
 * @returns          DriverPerformanceData ou null se piloto nao encontrado na temporada.
 *
 * @example
 * // Na API Route /api/seasons/[seasonId]/performance/route.ts:
 * const p1 = await getDriverPerformanceData(supabase, seasonId, searchParams.get('p1'));
 * const p2 = await getDriverPerformanceData(supabase, seasonId, searchParams.get('p2'));
 *
 * // Ajuste de cor se os dois pilotos forem da mesma equipe (views.py linhas 219-221)
 * if (p1 && p2 && p1.teamColor === p2.teamColor) {
 *   p2 = { ...p2, teamColor: '#374151' };
 * }
 */
export async function getDriverPerformanceData(
  supabase: SupabaseClient,
  seasonId: string,
  driverId: string
): Promise<DriverPerformanceData | null> {
  // 1. Busca a inscricao do piloto nesta temporada (inclui convidados aqui,
  //    pois o grafico de performance e individual e nao afeta o ranking).
  const { data: entryData, error: entryError } = await supabase
    .from("driver_team_season")
    .select(
      `
      id,
      drivers ( id, name ),
      teams   ( name, primary_color )
      `
    )
    .eq("season_id", seasonId)
    .eq("driver_id", driverId)
    .single();

  if (entryError || !entryData) {
    // Piloto nao esta inscrito nesta temporada
    return null;
  }

  const entryId = String(entryData.id);
  const driverName = (entryData.drivers as any).name as string;
  const teamName = (entryData.teams as any).name as string;
  const teamColor = (entryData.teams as any).primary_color as string;

  // 2. Busca as etapas da temporada em ordem
  const rounds = await fetchRounds(supabase, seasonId);

  if (rounds.length === 0) {
    return {
      name: driverName,
      teamName,
      teamColor,
      totalPoints: 0,
      bestPosition: "-",
      fastLaps: 0,
      labels: [],
      dataPoints: [],
      dataPositions: [],
    };
  }

  // 3. Busca todos os resultados do piloto nesta temporada de uma vez
  //    (mais eficiente que 1 query por etapa)
  const { data: resultsData, error: resultsError } = await supabase
    .from("round_results")
    .select("round_id, points, position, status, fastest_lap")
    .eq("entry_id", entryId);

  if (resultsError) {
    throw new Error(
      `[standings] Erro ao buscar resultados do piloto: ${resultsError.message}`
    );
  }

  // Indexa resultados por round_id para acesso O(1) no loop abaixo
  const resultsByRound = new Map<string, {
    points: number;
    position: number;
    status: ResultStatus;
    fastest_lap: boolean;
  }>();

  for (const r of resultsData ?? []) {
    resultsByRound.set(String(r.round_id), {
      points: r.points as number,
      position: r.position as number,
      status: r.status as ResultStatus,
      fastest_lap: r.fastest_lap as boolean,
    });
  }

  // 4. Itera pelas etapas em ordem e constroi os arrays
  //    Espelha o loop de views.py (linhas 182-194)
  const labels: string[] = [];
  const dataPoints: number[] = [];
  const dataPositions: (number | null)[] = [];

  let currentTotal = 0;
  let totalFastLaps = 0;
  let bestPos: number | null = null;

  for (const round of rounds) {
    labels.push(`R${round.order}`);

    const result = resultsByRound.get(round.id);

    if (result) {
      currentTotal += result.points;
      dataPoints.push(currentTotal);
      dataPositions.push(result.position);

      if (result.fastest_lap) totalFastLaps += 1;
      if (bestPos === null || result.position < bestPos) {
        bestPos = result.position;
      }
    } else {
      // Piloto nao correu nesta etapa: mantem total acumulado, posicao = null
      dataPoints.push(currentTotal);
      dataPositions.push(null);
    }
  }

  return {
    name: driverName,
    teamName,
    teamColor,
    totalPoints: currentTotal,
    bestPosition: bestPos ?? "-",
    fastLaps: totalFastLaps,
    labels,
    dataPoints,
    dataPositions,
  };
}

// ---------------------------------------------------------------------------
// 5. HELPERS EXTRAS PARA AS PAGES
// ---------------------------------------------------------------------------

/**
 * Busca o vencedor de cada etapa para exibir nos cards do calendario.
 * Porta a logica do loop de views.py (linhas 138-145) em season_detail().
 *
 * @param supabase  Cliente Supabase.
 * @param seasonId  ID da temporada.
 * @returns         Mapa de roundId -> nome do vencedor (so o primeiro nome).
 *
 * @example
 * const winners = await getRoundWinners(supabase, seasonId);
 * // { "13": "Jailson", "15": "Clauston", "17": null }
 */
export async function getRoundWinners(
  supabase: SupabaseClient,
  seasonId: string
): Promise<Record<string, string | null>> {
  // Busca resultados de 1o lugar concluido, com JOIN para o nome do piloto
  const { data, error } = await supabase
    .from("round_results")
    .select(
      `
      round_id,
      position,
      status,
      driver_team_season!entry_id (
        driver_id,
        drivers ( name )
      )
      `
    )
    .eq("position", 1)
    .eq("status", "COMPLETED")
    .in(
      "round_id",
      // Subquery: IDs de etapas da temporada
      (
        await supabase
          .from("rounds")
          .select("id")
          .eq("season_id", seasonId)
      ).data?.map((r: any) => r.id) ?? []
    );

  if (error) {
    throw new Error(
      `[standings] Erro ao buscar vencedores das etapas: ${error.message}`
    );
  }

  const winners: Record<string, string | null> = {};
  for (const row of data ?? []) {
    const fullName = (row as any).driver_team_season?.drivers?.name as
      | string
      | undefined;
    // Pega so o primeiro nome (espelha: winner_result.entry.driver.name.split()[0])
    winners[String(row.round_id)] = fullName
      ? fullName.split(" ")[0]
      : null;
  }

  return winners;
}

/**
 * Busca a lista completa de etapas de uma temporada com o vencedor de cada uma.
 * Combina fetchRounds() + getRoundWinners() em uma unica chamada conveniente
 * para ser usada diretamente nas pages do Next.js.
 *
 * @param supabase  Cliente Supabase.
 * @param seasonId  ID da temporada.
 * @returns         Array de etapas com campo `winner` (string | null).
 */
export async function getRoundsWithWinners(
  supabase: SupabaseClient,
  seasonId: string
): Promise<
  Array<{
    id: string;
    order: number;
    name: string;
    date: string;
    location: string;
    winner: string | null;
  }>
> {
  const [rounds, winners] = await Promise.all([
    fetchRounds(supabase, seasonId),
    getRoundWinners(supabase, seasonId),
  ]);

  return rounds.map((round) => ({
    ...round,
    winner: winners[round.id] ?? null,
  }));
}

/**
 * Busca a lista de pilotos de uma temporada para popular os selects
 * de comparacao na pagina de performance.
 * Inclui convidados (para permitir ver a performance deles individualmente).
 *
 * @param supabase  Cliente Supabase.
 * @param seasonId  ID da temporada.
 * @returns         Array de { entryId, driverId, driverName, isGuest }.
 */
export async function getDriversListForSeason(
  supabase: SupabaseClient,
  seasonId: string
): Promise<
  Array<{ entryId: string; driverId: string; driverName: string; isGuest: boolean }>
> {
  const { data, error } = await supabase
    .from("driver_team_season")
    .select("id, is_guest, driver_id, drivers ( id, name )")
    .eq("season_id", seasonId)
    .order("name", { referencedTable: "drivers", ascending: true });

  if (error) {
    throw new Error(
      `[standings] Erro ao buscar lista de pilotos: ${error.message}`
    );
  }

  return (data ?? []).map((row: any) => ({
    entryId: String(row.id),
    driverId: String(row.drivers.id),
    driverName: row.drivers.name as string,
    isGuest: row.is_guest as boolean,
  }));
}

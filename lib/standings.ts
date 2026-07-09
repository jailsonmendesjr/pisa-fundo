/**
 * lib/standings.ts
 *
 * Camada de acesso a dados para calcular classificacoes e performance.
 * Conecta as funcoes puras de lib/scoring.ts ao cliente Supabase.
 *
 * CORRIGIDO: IDs numéricos e mapeamento das funções originais do scoring.ts.
 * teste para push
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  accumulateDriverPoints,
  sortDriverStandings,
  buildTeamStandings,
  sortTeamStandings,
  applyDriverPositionChanges,
  applyTeamPositionChanges,
  type DriverStandingEntry,
  type TeamStandingEntry,
  type RaceResult,
  type ResultStatus,
} from "./scoring";

export interface SeasonStandings {
  drivers: DriverStandingEntry[];
  teams: TeamStandingEntry[];
}

export interface DriverPerformanceData {
  name: string;
  teamName: string;
  teamColor: string;
  totalPoints: number;
  bestPosition: number | "-";
  fastLaps: number;
  labels: string[];
  dataPoints: number[];
  dataPositions: (number | null)[];
}

/**
 * Motor central — busca dados do Supabase, acumula e ordena os standings.
 */
export async function calculateStandings(
  supabase: SupabaseClient,
  seasonId: number,
  excludeLastRound = false
): Promise<SeasonStandings> {
  // 1. Buscar etapas da temporada
  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("id, order")
    .eq("season_id", seasonId)
    .order("order", { ascending: true });

  if (roundsError) throw new Error(`[standings] Erro ao buscar etapas: ${roundsError.message}`);
  let targetRounds = rounds || [];
  if (excludeLastRound && targetRounds.length > 0) {
    targetRounds = targetRounds.slice(0, -1);
  }
  const roundIds = targetRounds.map((r) => r.id);

  // 2. Buscar inscrições de pilotos titulares (is_guest = false)
  const { data: entries, error: entryError } = await supabase
    .from("driver_team_season")
    .select(`
      id,
      car_number,
      is_guest,
      drivers ( id, name ),
      teams   ( id, name, primary_color )
    `)
    .eq("season_id", seasonId)
    .eq("is_guest", false);

  if (entryError) throw new Error(`[standings] Erro ao buscar inscricoes: ${entryError.message}`);
  if (!entries || entries.length === 0 || roundIds.length === 0) return { drivers: [], teams: [] };

  const mappedEntries: any[] = entries.map((row: any) => ({
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

  // 3. Buscar resultados das etapas selecionadas
  const { data: results, error: resultsError } = await supabase
    .from("round_results")
    .select("entry_id, points, position, status")
    .in("round_id", roundIds);

  if (resultsError) throw new Error(`[standings] Erro ao buscar resultados: ${resultsError.message}`);

  const mappedResults: RaceResult[] = (results || []).map((row: any) => ({
    entryId: String(row.entry_id),
    points: row.points as number,
    position: row.position as number,
    status: row.status as ResultStatus,
  }));

  // 4. Rodar o motor de cálculo puro importado do scoring.ts
  const accumulatedDrivers = accumulateDriverPoints(mappedEntries, mappedResults);
  const sortedDrivers = sortDriverStandings(accumulatedDrivers);
  const teamEntries = buildTeamStandings(sortedDrivers);
  const sortedTeams = sortTeamStandings(teamEntries);

  return { drivers: sortedDrivers, teams: sortedTeams };
}

/**
 * Calcula os standings com indicadores de evolução de posição (change)
 */
export async function getSeasonStandingsWithChanges(
  supabase: SupabaseClient,
  seasonId: number
): Promise<SeasonStandings> {
  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("id")
    .eq("season_id", seasonId);

  if (roundsError) throw new Error(`[standings] Erro ao verificar etapas: ${roundsError.message}`);

  const current = await calculateStandings(supabase, seasonId, false);

  if (rounds && rounds.length > 1) {
    const previous = await calculateStandings(supabase, seasonId, true);
    const driversWithChange = applyDriverPositionChanges(current.drivers, previous.drivers);
    const teamsWithChange = applyTeamPositionChanges(current.teams, previous.teams);
    return { drivers: driversWithChange, teams: teamsWithChange };
  }

  return {
    drivers: current.drivers.map((d) => ({ ...d, change: 0 })),
    teams: current.teams.map((t) => ({ ...t, change: 0 })),
  };
}

/**
 * Coleta os dados de performance de um piloto para os gráficos
 */
export async function getDriverPerformanceData(
  supabase: SupabaseClient,
  seasonId: number,
  driverId: number
): Promise<DriverPerformanceData | null> {
  const { data: entryData, error: entryError } = await supabase
    .from("driver_team_season")
    .select(`
      id,
      drivers ( id, name ),
      teams   ( name, primary_color )
    `)
    .eq("season_id", seasonId)
    .eq("driver_id", driverId)
    .maybeSingle();

  if (entryError || !entryData) return null;

  const entryId = String(entryData.id);
  const driverName = (entryData.drivers as any).name as string;
  const teamName = (entryData.teams as any).name as string;
  const teamColor = (entryData.teams as any).primary_color as string;

  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("id, name, order")
    .eq("season_id", seasonId)
    .order("order", { ascending: true });

  if (roundsError || !rounds || rounds.length === 0) {
    return { name: driverName, teamName, teamColor, totalPoints: 0, bestPosition: "-", fastLaps: 0, labels: [], dataPoints: [], dataPositions: [] };
  }

  const { data: resultsData, error: resultsError } = await supabase
    .from("round_results")
    .select("round_id, points, position, status, fastest_lap")
    .eq("entry_id", entryId);

  if (resultsError) throw new Error(`[standings] Erro ao buscar resultados do piloto: ${resultsError.message}`);

  const resultsByRound = new Map<string, any>();
  (resultsData || []).forEach((r) => resultsByRound.set(String(r.round_id), r));

  const labels: string[] = [];
  const dataPoints: number[] = [];
  const dataPositions: (number | null)[] = [];
  let currentTotal = 0;
  let totalFastLaps = 0;
  let bestPos: number | null = null;

  for (const round of rounds) {
    labels.push(`R${round.order}`);
    const result = resultsByRound.get(String(round.id));

    if (result) {
      currentTotal += result.points;
      dataPoints.push(currentTotal);
      dataPositions.push(result.position);
      if (result.fastest_lap) totalFastLaps++;
      if (bestPos === null || result.position < bestPos) bestPos = result.position;
    } else {
      dataPoints.push(currentTotal);
      dataPositions.push(null);
    }
  }

  return { name: driverName, teamName, teamColor, totalPoints: currentTotal, bestPosition: bestPos ?? "-", fastLaps: totalFastLaps, labels, dataPoints, dataPositions };
}

export async function getRoundsWithWinners(supabase: SupabaseClient, seasonId: number) {
  const { data: rounds, error: rErr } = await supabase
    .from("rounds")
    .select("id, order, name, date, location")
    .eq("season_id", seasonId)
    .order("order", { ascending: true });

  if (rErr) throw rErr;
  const targetRounds = rounds || [];

  if (targetRounds.length === 0) return [];

  const { data: results, error: resErr } = await supabase
    .from("round_results")
    .select("round_id, position, status, driver_team_season!entry_id ( drivers ( name ) )")
    .eq("position", 1)
    .eq("status", "COMPLETED")
    .in("round_id", targetRounds.map((r) => r.id));

  if (resErr) throw resErr;

  const winners: Record<string, string | null> = {};
  (results || []).forEach((row: any) => {
    const fullName = row.driver_team_season?.drivers?.name as string | undefined;
    winners[String(row.round_id)] = fullName ? fullName.split(" ")[0] : null;
  });

  return targetRounds.map((round) => ({
    ...round,
    winner: winners[String(round.id)] ?? null,
  }));
}

export async function getDriversListForSeason(supabase: SupabaseClient, seasonId: number) {
  const { data, error } = await supabase
    .from("driver_team_season")
    .select("id, is_guest, driver_id, drivers ( id, name )")
    .eq("season_id", seasonId);

  if (error) throw new Error(`[standings] Erro ao buscar lista de pilotos: ${error.message}`);

  return (data || []).map((row: any) => ({
    entryId: String(row.id),
    driverId: Number(row.drivers.id),
    driverName: row.drivers.name as string,
    isGuest: row.is_guest as boolean,
  }));
}
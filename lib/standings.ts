/**
 * lib/standings.ts
 *
 * Ajustado para ler as tabelas nativas do Django no Supabase:
 * championship_season, championship_round, championship_driverteamseason, etc.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";
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

type AppSupabaseClient = SupabaseClient<Database>;
type PerformanceResult = Pick<
  Tables<"championship_roundresult">,
  "round_id" | "points" | "position" | "status" | "fastest_lap"
>;

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

export interface RoundResultEntry {
  id: number;
  position: number;
  status: ResultStatus;
  fastestLap: boolean;
  hasPenalty: boolean;
  penaltyReason: string;
  points: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  carNumber: number | null;
  isGuest: boolean;
}

export interface RoundResultData {
  round: {
    id: number;
    order: number;
    name: string;
    date: string;
    location: string;
  };
  results: RoundResultEntry[];
}

export async function calculateStandings(
  supabase: AppSupabaseClient,
  seasonId: number,
  excludedRoundId?: number
): Promise<SeasonStandings> {
  // 1. Buscar etapas da temporada
  let roundsQuery = supabase
    .from("championship_round")
    .select("id, order")
    .eq("season_id", seasonId)
    .order("order", { ascending: true });

  if (excludedRoundId !== undefined) {
    roundsQuery = roundsQuery.neq("id", excludedRoundId);
  }

  const { data: rounds, error: roundsError } = await roundsQuery;

  if (roundsError) throw new Error(`[standings] Erro ao buscar etapas: ${roundsError.message}`);
  const roundIds = (rounds || []).map((round) => round.id);

  // 2. Buscar inscrições usando as tabelas do Django e Joins explícitos via Supabase Embeds
  const { data: entries, error: entryError } = await supabase
    .from("championship_driverteamseason")
    .select(`
      id,
      car_number,
      is_guest,
      championship_driver ( id, name ),
      championship_team   ( id, name, primary_color )
    `)
    .eq("season_id", seasonId)
    .eq("is_guest", false);

  if (entryError) throw new Error(`[standings] Erro ao buscar inscricoes: ${entryError.message}`);
  if (!entries || entries.length === 0 || roundIds.length === 0) return { drivers: [], teams: [] };

  const mappedEntries: DriverStandingEntry[] = entries.map((row) => ({
    entryId: String(row.id),
    driverId: String(row.championship_driver.id),
    driverName: row.championship_driver.name,
    teamId: String(row.championship_team.id),
    teamName: row.championship_team.name,
    teamColor: row.championship_team.primary_color,
    carNumber: row.car_number,
    isGuest: row.is_guest,
    totalPoints: 0,
    wins: 0,
    podiums: 0,
  }));

  // 3. Buscar resultados das etapas
  const { data: results, error: resultsError } = await supabase
    .from("championship_roundresult")
    .select("entry_id, points, position, status")
    .in("round_id", roundIds);

  if (resultsError) throw new Error(`[standings] Erro ao buscar resultados: ${resultsError.message}`);

  const mappedResults: RaceResult[] = (results || []).map((row) => ({
    entryId: String(row.entry_id),
    points: row.points,
    position: row.position,
    status: row.status as ResultStatus,
  }));

  const accumulatedDrivers = accumulateDriverPoints(mappedEntries, mappedResults);
  const sortedDrivers = sortDriverStandings(accumulatedDrivers);
  const teamEntries = buildTeamStandings(sortedDrivers);
  const sortedTeams = sortTeamStandings(teamEntries);

  return { drivers: sortedDrivers, teams: sortedTeams };
}

export async function getSeasonStandingsWithChanges(
  supabase: AppSupabaseClient,
  seasonId: number
): Promise<SeasonStandings> {
  const { data: rounds, error: roundsError } = await supabase
    .from("championship_round")
    .select("id, date, order")
    .eq("season_id", seasonId)
    .order("date", { ascending: true })
    .order("order", { ascending: true });

  if (roundsError) throw new Error(`[standings] Erro ao verificar etapas: ${roundsError.message}`);

  const roundIds = (rounds ?? []).map((round) => round.id);
  const { data: resultRounds, error: resultRoundsError } = roundIds.length
    ? await supabase
        .from("championship_roundresult")
        .select("round_id")
        .in("round_id", roundIds)
    : { data: [], error: null };

  if (resultRoundsError) {
    throw new Error(
      `[standings] Erro ao verificar resultados publicados: ${resultRoundsError.message}`
    );
  }

  const resultRoundIds = new Set((resultRounds ?? []).map((result) => result.round_id));
  const publishedRounds = (rounds ?? []).filter((round) => resultRoundIds.has(round.id));
  const latestPublishedRoundId = publishedRounds.at(-1)?.id;

  if (publishedRounds.length > 1 && latestPublishedRoundId !== undefined) {
    const [current, previous] = await Promise.all([
      calculateStandings(supabase, seasonId),
      calculateStandings(supabase, seasonId, latestPublishedRoundId),
    ]);
    const driversWithChange = applyDriverPositionChanges(current.drivers, previous.drivers);
    const teamsWithChange = applyTeamPositionChanges(current.teams, previous.teams);
    return { drivers: driversWithChange, teams: teamsWithChange };
  }

  const current = await calculateStandings(supabase, seasonId);

  return {
    drivers: current.drivers.map((d) => ({ ...d, change: 0 })),
    teams: current.teams.map((t) => ({ ...t, change: 0 })),
  };
}

export async function getDriverPerformanceData(
  supabase: AppSupabaseClient,
  seasonId: number,
  driverId: number
): Promise<DriverPerformanceData | null> {
  const { data: entryData, error: entryError } = await supabase
    .from("championship_driverteamseason")
    .select(`
      id,
      championship_driver ( id, name ),
      championship_team   ( name, primary_color )
    `)
    .eq("season_id", seasonId)
    .eq("driver_id", driverId)
    .maybeSingle();

  if (entryError || !entryData) return null;

  const entryId = entryData.id;
  const driverName = entryData.championship_driver.name;
  const teamName = entryData.championship_team.name;
  const teamColor = entryData.championship_team.primary_color;

  const { data: rounds, error: roundsError } = await supabase
    .from("championship_round")
    .select("id, name, order")
    .eq("season_id", seasonId)
    .order("order", { ascending: true });

  if (roundsError || !rounds || rounds.length === 0) {
    return { name: driverName, teamName, teamColor, totalPoints: 0, bestPosition: "-", fastLaps: 0, labels: [], dataPoints: [], dataPositions: [] };
  }

  const { data: resultsData, error: resultsError } = await supabase
    .from("championship_roundresult")
    .select("round_id, points, position, status, fastest_lap")
    .eq("entry_id", entryId);

  if (resultsError) throw new Error(`[standings] Erro ao buscar resultados: ${resultsError.message}`);

  const resultsByRound = new Map<number, PerformanceResult>();
  (resultsData || []).forEach((result) => resultsByRound.set(result.round_id, result));

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
      if (result.fastest_lap) totalFastLaps++;
      if (bestPos === null || result.position < bestPos) bestPos = result.position;
    } else {
      dataPoints.push(currentTotal);
      dataPositions.push(null);
    }
  }

  return { name: driverName, teamName, teamColor, totalPoints: currentTotal, bestPosition: bestPos ?? "-", fastLaps: totalFastLaps, labels, dataPoints, dataPositions };
}

export async function getRoundsWithWinners(supabase: AppSupabaseClient, seasonId: number) {
  const { data: rounds, error: rErr } = await supabase
    .from("championship_round")
    .select("id, order, name, date, location")
    .eq("season_id", seasonId)
    .order("date", { ascending: false })
    .order("order", { ascending: false });

  if (rErr) throw rErr;
  const targetRounds = rounds || [];

  if (targetRounds.length === 0) return [];

  const { data: results, error: resErr } = await supabase
    .from("championship_roundresult")
    .select("round_id, position, status, championship_driverteamseason!entry_id ( championship_driver ( name ) )")
    .eq("position", 1)
    .eq("status", "COMPLETED")
    .in("round_id", targetRounds.map((r) => r.id));

  if (resErr) throw resErr;

  const winners: Record<string, string | null> = {};
  (results || []).forEach((row) => {
    const fullName = row.championship_driverteamseason?.championship_driver?.name;
    winners[String(row.round_id)] = fullName ? fullName.split(" ")[0] : null;
  });

  return targetRounds.map((round) => ({
    ...round,
    winner: winners[String(round.id)] ?? null,
  }));
}

export async function getRoundResult(
  supabase: AppSupabaseClient,
  seasonId: number,
  roundId: number
): Promise<RoundResultData | null> {
  const { data: round, error: roundError } = await supabase
    .from("championship_round")
    .select("id, order, name, date, location")
    .eq("id", roundId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (roundError) {
    throw new Error(`[round] Erro ao buscar etapa: ${roundError.message}`);
  }
  if (!round) return null;

  const { data: results, error: resultsError } = await supabase
    .from("championship_roundresult")
    .select(`
      id,
      position,
      status,
      fastest_lap,
      has_penalty,
      penalty_reason,
      points,
      championship_driverteamseason!entry_id (
        car_number,
        is_guest,
        championship_driver ( name ),
        championship_team ( name, primary_color )
      )
    `)
    .eq("round_id", roundId)
    .order("position", { ascending: true });

  if (resultsError) {
    throw new Error(`[round] Erro ao buscar resultados: ${resultsError.message}`);
  }

  return {
    round,
    results: (results ?? []).map((result) => ({
      id: result.id,
      position: result.position,
      status: result.status as ResultStatus,
      fastestLap: result.fastest_lap,
      hasPenalty: result.has_penalty,
      penaltyReason: result.penalty_reason,
      points: result.points,
      driverName: result.championship_driverteamseason.championship_driver.name,
      teamName: result.championship_driverteamseason.championship_team.name,
      teamColor: result.championship_driverteamseason.championship_team.primary_color,
      carNumber: result.championship_driverteamseason.car_number,
      isGuest: result.championship_driverteamseason.is_guest,
    })),
  };
}

export async function getDriversListForSeason(supabase: AppSupabaseClient, seasonId: number) {
  const { data, error } = await supabase
    .from("championship_driverteamseason")
    .select("id, is_guest, driver_id, championship_driver ( id, name )")
    .eq("season_id", seasonId);

  if (error) throw new Error(`[standings] Erro ao buscar lista de pilotos: ${error.message}`);

  return (data || []).map((row) => ({
    entryId: String(row.id),
    driverId: String(row.championship_driver.id),
    driverName: row.championship_driver.name,
    isGuest: row.is_guest,
  }));
}

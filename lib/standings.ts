/**
 * lib/standings.ts
 *
 * Camada de acesso a dados para calcular classificacoes e performance.
 * Conecta as funcoes puras de lib/scoring.ts ao cliente Supabase.
 *
 * CORRIGIDO: IDs alterados de string para number para refletir o banco vindo do Django.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { accumulateResults, sortStandings } from "./scoring";

export interface DriverStanding {
  position: number;
  change: number | string; // ▲, ▼, • ou number
  driverId: number;
  driverName: string;
  driverNumber: string | null;
  teamId: number | null;
  teamName: string;
  teamSlug: string;
  primaryColor: string;
  secondaryColor: string;
  carNumber: string | null;
  points: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
}

export interface TeamStanding {
  position: number;
  change: number | string;
  teamId: number;
  teamName: string;
  teamSlug: string;
  primaryColor: string;
  secondaryColor: string;
  points: number;
  wins: number;
  podiums: number;
}

export interface SeasonStandings {
  drivers: DriverStanding[];
  teams: TeamStanding[];
}

/**
 * Motor central — busca dados do Supabase, acumula e ordena os standings.
 */
export async function calculateStandings(
  supabase: SupabaseClient,
  seasonId: number,
  excludeLastRoundId?: number
): Promise<SeasonStandings> {
  // 1. Buscar a relação de pilotos/equipes da temporada (removendo convidados)
  let entryQuery = supabase
    .from("driver_team_season")
    .select("id, team_id, driver_id, car_number, is_guest, drivers(name, number), teams(name, slug, primary_color, secondary_color)")
    .eq("season_id", seasonId)
    .eq("is_guest", false);

  const { data: entries, error: entryError } = await entryQuery;
  if (entryError) throw new Error(`[standings] Erro ao buscar inscritos: ${entryError.message}`);
  if (!entries || entries.length === 0) return { drivers: [], teams: [] };

  const entryIds = entries.map((e) => e.id);
  const entriesMap = new Map<number, any>();
  entries.forEach((e) => entriesMap.set(e.id, e));

  // 2. Buscar resultados das etapas
  let resultsQuery = supabase
    .from("round_results")
    .select("id, round_id, entry_id, position, status, fastest_lap, points, rounds(order)")
    .in("entry_id", entryIds);

  const { data: results, error: resultsError } = await resultsQuery;
  if (resultsError) throw new Error(`[standings] Erro ao buscar resultados: ${resultsError.message}`);

  // Filtrar última etapa se solicitado
  let filteredResults = results || [];
  if (excludeLastRoundId !== undefined) {
    filteredResults = filteredResults.filter((r) => r.round_id !== excludeLastRoundId);
  }

  // 3. Processar acumulado de pilotos usando a lógica pura de scoring
  const driverStatsMap = accumulateResults(filteredResults);

  const driverStandingsUnsorted: Omit<DriverStanding, "position" | "change">[] = entries.map((entry) => {
    const stats = driverStatsMap.get(entry.id) || { points: 0, wins: 0, podiums: 0, fastestLaps: 0, positions: [] };
    const d = entry.drivers as any;
    const t = entry.teams as any;

    return {
      driverId: entry.driver_id,
      driverName: d?.name || "Piloto Desconhecido",
      driverNumber: d?.number || null,
      teamId: entry.team_id,
      teamName: t?.name || "Equipe Independente",
      teamSlug: t?.slug || "independente",
      primaryColor: t?.primary_color || "#788084",
      secondaryColor: t?.secondary_color || "#b3b3b3",
      carNumber: entry.car_number,
      points: stats.points,
      wins: stats.wins,
      podiums: stats.podiums,
      fastestLaps: stats.fastestLaps,
      positions: stats.positions, // Necessário para desempate do sort
    };
  });

  const sortedDrivers = sortStandings(driverStandingsUnsorted).map((d, index) => ({
    ...d,
    position: index + 1,
    change: "•",
  })) as DriverStanding[];

  // 4. Acumular classificação de Equipes
  const teamStatsMap = new Map<number, { points: number; wins: number; podiums: number; positions: number[] }>();

  sortedDrivers.forEach((driver) => {
    if (!driver.teamId) return;
    const current = teamStatsMap.get(driver.teamId) || { points: 0, wins: 0, podiums: 0, positions: [] };
    const unsortedDriver = driverStandingsUnsorted.find((u) => u.driverId === driver.driverId);

    teamStatsMap.set(driver.teamId, {
      points: current.points + driver.points,
      wins: current.wins + driver.wins,
      podiums: current.podiums + driver.podiums,
      positions: [...current.positions, ...(unsortedDriver as any).positions],
    });
  });

  const teamStandingsUnsorted: Omit<TeamStanding, "position" | "change">[] = [];
  const uniqueTeams = Array.from(new Set(entries.map((e) => e.team_id).filter(Boolean))) as number[];

  uniqueTeams.forEach((tId) => {
    const entrySample = entries.find((e) => e.team_id === tId);
    const t = entrySample?.teams as any;
    const stats = teamStatsMap.get(tId) || { points: 0, wins: 0, podiums: 0, positions: [] };

    teamStandingsUnsorted.push({
      teamId: tId,
      teamName: t?.name || "Equipe",
      teamSlug: t?.slug || "equipe",
      primaryColor: t?.primary_color || "#788084",
      secondaryColor: t?.secondary_color || "#b3b3b3",
      points: stats.points,
      wins: stats.wins,
      podiums: stats.podiums,
      positions: stats.positions,
    } as any);
  });

  const sortedTeams = sortStandings(teamStandingsUnsorted).map((t, index) => ({
    ...t,
    position: index + 1,
    change: "•",
  })) as TeamStanding[];

  return { drivers: sortedDrivers, teams: sortedTeams };
}

/**
 * Calcula os standings comparando com a penúltima etapa para gerar as setas (▲/▼)
 */
export async function getSeasonStandingsWithChanges(
  supabase: SupabaseClient,
  seasonId: number
): Promise<SeasonStandings> {
  const currentStandings = await calculateStandings(supabase, seasonId);

  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("id, order")
    .eq("season_id", seasonId)
    .order("order", { ascending: true });

  if (roundsError) throw new Error(`[standings] Erro ao buscar etapas: ${roundsError.message}`);
  if (!rounds || rounds.length <= 1) {
    return currentStandings;
  }

  const lastRound = rounds[rounds.length - 1];
  const previousStandings = await calculateStandings(supabase, seasonId, lastRound.id);

  const prevDriverPosMap = new Map<number, number>();
  previousStandings.drivers.forEach((d) => prevDriverPosMap.set(d.driverId, d.position));

  const driversWithChanges = currentStandings.drivers.map((d) => {
    const prevPos = prevDriverPosMap.get(d.driverId);
    if (prevPos === undefined) return { ...d, change: "▲" };
    const diff = prevPos - d.position;
    return { ...d, change: diff > 0 ? `▲${diff}` : diff < 0 ? `▼${Math.abs(diff)}` : "•" };
  });

  const prevTeamPosMap = new Map<number, number>();
  previousStandings.teams.forEach((t) => prevTeamPosMap.set(t.teamId, t.position));

  const teamsWithChanges = currentStandings.teams.map((t) => {
    const prevPos = prevTeamPosMap.get(t.teamId);
    if (prevPos === undefined) return { ...t, change: "▲" };
    const diff = prevPos - t.position;
    return { ...t, change: diff > 0 ? `▲${diff}` : diff < 0 ? `▼${Math.abs(diff)}` : "•" };
  });

  return { drivers: driversWithChanges, teams: teamsWithChanges };
}

/**
 * Busca dados para alimentar os gráficos do ApexCharts/SVG de performance comparativa
 */
export async function getDriverPerformanceData(
  supabase: SupabaseClient,
  seasonId: number,
  driverId: number
) {
  const { data: entry, error: entryError } = await supabase
    .from("driver_team_season")
    .select("id, teams(name, primary_color)")
    .eq("season_id", seasonId)
    .eq("driver_id", driverId)
    .maybeSingle();

  if (entryError) throw new Error(`[standings] Erro ao buscar inscrito: ${entryError.message}`);
  if (!entry) throw new Error(`Piloto não inscrito nesta temporada.`);

  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("id, name, order")
    .eq("season_id", seasonId)
    .order("order", { ascending: true });

  if (roundsError) throw new Error(`[standings] Erro ao buscar etapas: ${roundsError.message}`);

  const { data: results, error: resultsError } = await supabase
    .from("round_results")
    .select("round_id, position, points, fastest_lap, status")
    .eq("entry_id", entry.id);

  if (resultsError) throw new Error(`[standings] Erro ao buscar resultados: ${resultsError.message}`);

  const resultsMap = new Map<number, any>();
  results?.forEach((r) => resultsMap.set(r.round_id, r));

  const labels: string[] = [];
  const dataPoints: number[] = [];
  const dataPositions: (number | null)[] = [];
  let cumulativePoints = 0;
  let bestPosition = null as number | null;
  let fastestLapsCount = 0;

  rounds?.forEach((round) => {
    labels.push(round.name);
    const res = resultsMap.get(round.id);

    if (res && res.status === "COMPLETED") {
      cumulativePoints += res.points;
      dataPoints.push(cumulativePoints);
      dataPositions.push(res.position);

      if (bestPosition === null || res.position < bestPosition) {
        bestPosition = res.position;
      }
      if (res.fastest_lap) {
        fastestLapsCount++;
      }
    } else {
      dataPoints.push(cumulativePoints);
      dataPositions.push(null);
    }
  });

  const t = entry.teams as any;
  return {
    teamName: t?.name || "Independente",
    color: t?.primary_color || "#788084",
    chart: { labels, data_points: dataPoints, data_positions: dataPositions },
    stats: { total_points: cumulativePoints, best_position: bestPosition || 0, fastest_laps: fastestLapsCount },
  };
}

async function fetchRounds(supabase: SupabaseClient, seasonId: number) {
  const { data, error } = await supabase
    .from("rounds")
    .select("id, order, name, date, location")
    .eq("season_id", seasonId)
    .order("order", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getRoundWinners(supabase: SupabaseClient, seasonId: number): Promise<Record<number, string>> {
  const { data: rounds } = await supabase.from("rounds").select("id").eq("season_id", seasonId);
  if (!rounds || rounds.length === 0) return {};

  const roundIds = rounds.map((r) => r.id);

  const { data: results, error } = await supabase
    .from("round_results")
    .select("round_id, position, entry_id, driver_team_season(driver_id, drivers(name))")
    .in("round_id", roundIds)
    .eq("position", 1);

  if (error) throw error;

  const winnersMap: Record<number, string> = {};
  results?.forEach((res) => {
    const dts = res.driver_team_season as any;
    const d = dts?.drivers as any;
    if (d?.name) {
      winnersMap[res.round_id] = d.name.split(" ")[0]; // Apenas o primeiro nome
    }
  });

  return winnersMap;
}

export async function getRoundsWithWinners(supabase: SupabaseClient, seasonId: number) {
  const [rounds, winners] = await Promise.all([
    fetchRounds(supabase, seasonId),
    getRoundWinners(supabase, seasonId),
  ]);

  return rounds.map((round) => ({
    ...round,
    winner: winners[round.id] ?? null,
  }));
}

export async function getDriversListForSeason(supabase: SupabaseClient, seasonId: number) {
  const { data, error } = await supabase
    .from("driver_team_season")
    .select("id, is_guest, driver_id, drivers ( id, name )")
    .eq("season_id", seasonId)
    .order("id", { ascending: true });

  if (error) throw new Error(`[standings] Erro ao buscar lista de pilotos: ${error.message}`);

  return (data || []).map((item) => {
    const d = item.drivers as any;
    return {
      entryId: item.id,
      driverId: item.driver_id,
      driverName: d?.name || "Piloto",
      isGuest: item.is_guest,
    };
  });
}
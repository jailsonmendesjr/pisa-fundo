import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import {
  calculateCupStandings,
  type CupScoringParticipant,
  type CupScoringResult,
  type CupScoringRound,
  type CupStandingEntry,
} from "./cup-scoring";
import type { ResultStatus } from "./scoring";
import {
  buildCupParticipation,
  type CupParticipationMarker,
} from "./cup-participation";

type AppSupabaseClient = SupabaseClient<Database>;

export interface CupRoundSummary {
  id: number;
  cupOrder: number;
  name: string;
  date: string;
  location: string;
  hasResults: boolean;
}

export interface CupStandingsData {
  cup: {
    id: number;
    name: string;
    seasonId: number;
    publishedAt: string | null;
    isEnabled: boolean;
  };
  rounds: CupRoundSummary[];
  standings: Array<
    CupStandingEntry & { roundParticipation: CupParticipationMarker[] }
  >;
  finalRoundPublished: boolean;
  publishedRoundIds: number[];
}

export async function getCupStandings(
  supabase: AppSupabaseClient,
  cupId: number
): Promise<CupStandingsData | null> {
  const { data: cup, error: cupError } = await supabase
    .from("championship_cup")
    .select("id, name, season_id, published_at, is_enabled")
    .eq("id", cupId)
    .maybeSingle();

  if (cupError) {
    throw new Error(`[cup-standings] Erro ao buscar Copa: ${cupError.message}`);
  }
  if (!cup) return null;

  const [roundsResponse, entriesResponse] = await Promise.all([
    supabase
      .from("championship_cup_round")
      .select(`
        round_id,
        cup_order,
        championship_round!round_id ( id, name, date, location )
      `)
      .eq("cup_id", cupId)
      .order("cup_order"),
    supabase
      .from("championship_cup_entry")
      .select(`
        entry_id,
        first_round_id,
        championship_driverteamseason!entry_id (
          id,
          car_number,
          is_guest,
          championship_driver ( id, name ),
          championship_team ( name, primary_color )
        )
      `)
      .eq("cup_id", cupId),
  ]);

  if (roundsResponse.error) {
    throw new Error(
      `[cup-standings] Erro ao buscar etapas: ${roundsResponse.error.message}`
    );
  }
  if (entriesResponse.error) {
    throw new Error(
      `[cup-standings] Erro ao buscar participantes: ${entriesResponse.error.message}`
    );
  }

  const cupRounds: CupScoringRound[] = (roundsResponse.data ?? []).map((row) => ({
    roundId: row.round_id,
    cupOrder: row.cup_order,
  }));
  const participants: CupScoringParticipant[] = (entriesResponse.data ?? [])
    .filter((row) => !row.championship_driverteamseason.is_guest)
    .map((row) => ({
      entryId: row.entry_id,
      driverId: row.championship_driverteamseason.championship_driver.id,
      driverName: row.championship_driverteamseason.championship_driver.name,
      teamName: row.championship_driverteamseason.championship_team.name,
      teamColor:
        row.championship_driverteamseason.championship_team.primary_color,
      carNumber: row.championship_driverteamseason.car_number,
      firstRoundId: row.first_round_id,
    }));
  const roundIds = cupRounds.map((round) => round.roundId);
  const { data: results, error: resultsError } = roundIds.length
    ? await supabase
        .from("championship_roundresult")
        .select("round_id, entry_id, points, position, status")
        .in("round_id", roundIds)
    : { data: [], error: null };

  if (resultsError) {
    throw new Error(
      `[cup-standings] Erro ao buscar resultados: ${resultsError.message}`
    );
  }

  const mappedResults: CupScoringResult[] = (results ?? []).map((result) => ({
    roundId: result.round_id,
    entryId: result.entry_id,
    points: result.points,
    position: result.position,
    status: result.status as ResultStatus,
  }));
  const calculation = calculateCupStandings(
    cupRounds,
    participants,
    mappedResults
  );
  const publishedRoundIdSet = new Set(calculation.publishedRoundIds);
  const roundRowsById = new Map(
    (roundsResponse.data ?? []).map((row) => [row.round_id, row])
  );
  const participationRounds = cupRounds.map((round) => ({
    ...round,
    roundName: roundRowsById.get(round.roundId)!.championship_round.name,
  }));

  return {
    cup: {
      id: cup.id,
      name: cup.name,
      seasonId: cup.season_id,
      publishedAt: cup.published_at,
      isEnabled: cup.is_enabled,
    },
    rounds: cupRounds.map((cupRound) => {
      const row = roundRowsById.get(cupRound.roundId)!;
      return {
        id: cupRound.roundId,
        cupOrder: cupRound.cupOrder,
        name: row.championship_round.name,
        date: row.championship_round.date,
        location: row.championship_round.location,
        hasResults: publishedRoundIdSet.has(cupRound.roundId),
      };
    }),
    standings: calculation.standings.map((standing) => ({
      ...standing,
      roundParticipation: buildCupParticipation(
        participationRounds,
        standing,
        mappedResults,
        calculation.publishedRoundIds
      ),
    })),
    finalRoundPublished: calculation.finalRoundPublished,
    publishedRoundIds: calculation.publishedRoundIds,
  };
}

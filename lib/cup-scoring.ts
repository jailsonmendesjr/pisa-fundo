import type { ResultStatus } from "./scoring";

export interface CupScoringRound {
  roundId: number;
  cupOrder: number;
}

export interface CupScoringParticipant {
  entryId: number;
  driverId: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  carNumber: number | null;
  firstRoundId: number;
}

export interface CupScoringResult {
  roundId: number;
  entryId: number;
  points: number;
  position: number;
  status: ResultStatus;
}

export interface CupStandingEntry extends CupScoringParticipant {
  totalPoints: number;
  wins: number;
  podiums: number;
  resultsCounted: number;
  position: number;
  isTied: boolean;
  tieIsProvisional: boolean;
  finalRoundPosition: number | null;
  finalRoundStatus: ResultStatus | null;
}

export interface CupStandingsCalculation {
  standings: CupStandingEntry[];
  finalRoundPublished: boolean;
  publishedRoundIds: number[];
}

type MutableStanding = Omit<
  CupStandingEntry,
  "position" | "isTied" | "tieIsProvisional"
>;

function hasSamePrimaryCriteria(a: MutableStanding, b: MutableStanding) {
  return (
    a.totalPoints === b.totalPoints &&
    a.wins === b.wins &&
    a.podiums === b.podiums
  );
}

function completedFinalRound(entry: MutableStanding) {
  return entry.finalRoundStatus === "COMPLETED";
}

function hasSameFinalRoundCriterion(a: MutableStanding, b: MutableStanding) {
  const aCompleted = completedFinalRound(a);
  const bCompleted = completedFinalRound(b);

  if (!aCompleted && !bCompleted) return true;
  if (aCompleted !== bCompleted) return false;
  return a.finalRoundPosition === b.finalRoundPosition;
}

/**
 * Calcula exclusivamente a classificação individual da Mini Copa.
 * Os pontos já vêm dos resultados oficiais e nunca são recalculados aqui.
 */
export function calculateCupStandings(
  rounds: CupScoringRound[],
  participants: CupScoringParticipant[],
  results: CupScoringResult[]
): CupStandingsCalculation {
  if (rounds.length === 0) {
    return { standings: [], finalRoundPublished: false, publishedRoundIds: [] };
  }

  const orderedRounds = [...rounds].sort((a, b) => a.cupOrder - b.cupOrder);
  const roundOrderById = new Map(
    orderedRounds.map((round) => [round.roundId, round.cupOrder])
  );
  const finalRoundId = orderedRounds.find((round) => round.cupOrder === 4)?.roundId;
  const hasCompleteCalendar = orderedRounds.length === 4 && finalRoundId !== undefined;
  const publishedRoundIdSet = new Set<number>();
  const participantByEntryId = new Map<number, MutableStanding>();

  for (const participant of participants) {
    participantByEntryId.set(participant.entryId, {
      ...participant,
      totalPoints: 0,
      wins: 0,
      podiums: 0,
      resultsCounted: 0,
      finalRoundPosition: null,
      finalRoundStatus: null,
    });
  }

  for (const result of results) {
    const cupOrder = roundOrderById.get(result.roundId);
    if (cupOrder === undefined) continue;

    publishedRoundIdSet.add(result.roundId);
    const standing = participantByEntryId.get(result.entryId);
    if (!standing) continue;

    const firstEligibleOrder = roundOrderById.get(standing.firstRoundId);
    if (firstEligibleOrder === undefined || cupOrder < firstEligibleOrder) continue;

    standing.totalPoints += result.points;
    standing.resultsCounted += 1;

    if (result.status === "COMPLETED") {
      if (result.position === 1) standing.wins += 1;
      if (result.position <= 3) standing.podiums += 1;
    }

    if (finalRoundId !== undefined && result.roundId === finalRoundId) {
      standing.finalRoundPosition = result.position;
      standing.finalRoundStatus = result.status;
    }
  }

  const finalRoundPublished =
    hasCompleteCalendar && publishedRoundIdSet.has(finalRoundId);
  const sorted = Array.from(participantByEntryId.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;

    if (finalRoundPublished) {
      const aCompleted = completedFinalRound(a);
      const bCompleted = completedFinalRound(b);
      if (aCompleted !== bCompleted) return aCompleted ? -1 : 1;
      if (
        aCompleted &&
        bCompleted &&
        a.finalRoundPosition !== b.finalRoundPosition
      ) {
        return a.finalRoundPosition! - b.finalRoundPosition!;
      }
    }

    // Deterministic display only. Shared rank below prevents this fallback from
    // becoming a sporting tie-breaker.
    return a.driverName.localeCompare(b.driverName, "pt-BR");
  });

  const sameRank = (a: MutableStanding, b: MutableStanding) =>
    hasSamePrimaryCriteria(a, b) &&
    (!finalRoundPublished || hasSameFinalRoundCriterion(a, b));

  const ranked: CupStandingEntry[] = [];
  for (const [index, entry] of sorted.entries()) {
    const previousSource = sorted[index - 1];
    const previousRanked = ranked[index - 1];
    const position = previousSource && sameRank(entry, previousSource)
      ? previousRanked.position
      : index + 1;

    ranked.push({
      ...entry,
      position,
      isTied: false,
      tieIsProvisional: false,
    });
  }

  const standings = ranked.map((entry, index) => {
    const previous = sorted[index - 1];
    const next = sorted[index + 1];
    const source = sorted[index];
    const isTied =
      Boolean(previous && sameRank(source, previous)) ||
      Boolean(next && sameRank(source, next));

    return {
      ...entry,
      isTied,
      tieIsProvisional: isTied && !finalRoundPublished,
    };
  });

  return {
    finalRoundPublished,
    publishedRoundIds: orderedRounds
      .filter((round) => publishedRoundIdSet.has(round.roundId))
      .map((round) => round.roundId),
    standings,
  };
}

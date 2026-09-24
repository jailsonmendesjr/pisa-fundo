import type {
  CupScoringParticipant,
  CupScoringResult,
  CupScoringRound,
} from "./cup-scoring";
import type { ResultStatus } from "./scoring";

export const CUP_ROUND_COUNT = 4;

export type CupParticipationState =
  | "PARTICIPATED"
  | "MISSED"
  | "PENDING"
  | "NOT_ENROLLED";

export interface CupParticipationRound extends CupScoringRound {
  roundName: string;
}

export interface CupParticipationMarker {
  cupOrder: number;
  roundId: number | null;
  roundName: string | null;
  state: CupParticipationState;
  resultStatus: ResultStatus | null;
}

export function buildCupParticipation(
  rounds: CupParticipationRound[],
  participant: CupScoringParticipant,
  results: CupScoringResult[],
  publishedRoundIds: number[]
): CupParticipationMarker[] {
  const roundByOrder = new Map(
    rounds.map((round) => [round.cupOrder, round])
  );
  const orderByRoundId = new Map(
    rounds.map((round) => [round.roundId, round.cupOrder])
  );
  const firstEligibleOrder = orderByRoundId.get(participant.firstRoundId);
  const publishedRoundIdSet = new Set(publishedRoundIds);
  const resultByRoundId = new Map(
    results
      .filter((result) => result.entryId === participant.entryId)
      .map((result) => [result.roundId, result])
  );

  return Array.from({ length: CUP_ROUND_COUNT }, (_, index) => {
    const cupOrder = index + 1;
    const round = roundByOrder.get(cupOrder);

    if (!round) {
      return {
        cupOrder,
        roundId: null,
        roundName: null,
        state: "PENDING",
        resultStatus: null,
      };
    }

    if (firstEligibleOrder === undefined || cupOrder < firstEligibleOrder) {
      return {
        cupOrder,
        roundId: round.roundId,
        roundName: round.roundName,
        state: "NOT_ENROLLED",
        resultStatus: null,
      };
    }

    if (!publishedRoundIdSet.has(round.roundId)) {
      return {
        cupOrder,
        roundId: round.roundId,
        roundName: round.roundName,
        state: "PENDING",
        resultStatus: null,
      };
    }

    const result = resultByRoundId.get(round.roundId);
    const participated = result && result.status !== "DNS";

    return {
      cupOrder,
      roundId: round.roundId,
      roundName: round.roundName,
      state: participated ? "PARTICIPATED" : "MISSED",
      resultStatus: result?.status ?? null,
    };
  });
}

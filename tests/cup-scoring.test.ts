import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCupStandings,
  type CupScoringParticipant,
  type CupScoringResult,
  type CupScoringRound,
} from "../lib/cup-scoring.ts";

const rounds: CupScoringRound[] = [
  { roundId: 101, cupOrder: 1 },
  { roundId: 102, cupOrder: 2 },
  { roundId: 103, cupOrder: 3 },
  { roundId: 104, cupOrder: 4 },
];

function participant(
  entryId: number,
  driverName: string,
  firstRoundId = 101
): CupScoringParticipant {
  return {
    entryId,
    driverId: entryId,
    driverName,
    teamName: `Equipe ${entryId}`,
    teamColor: "#111111",
    carNumber: entryId,
    firstRoundId,
  };
}

test("uses official points and ignores results from non-participants", () => {
  const participants = [participant(1, "Ana"), participant(2, "Bruno")];
  const results: CupScoringResult[] = [
    { roundId: 101, entryId: 99, points: 18, position: 1, status: "COMPLETED" },
    { roundId: 101, entryId: 1, points: 15, position: 2, status: "COMPLETED" },
    { roundId: 101, entryId: 2, points: 13, position: 3, status: "COMPLETED" },
  ];

  const calculation = calculateCupStandings(rounds, participants, results);

  assert.deepEqual(
    calculation.standings.map(({ entryId, totalPoints, wins, podiums }) => ({
      entryId,
      totalPoints,
      wins,
      podiums,
    })),
    [
      { entryId: 1, totalPoints: 15, wins: 0, podiums: 1 },
      { entryId: 2, totalPoints: 13, wins: 0, podiums: 1 },
    ]
  );
});

test("late enrollment ignores every result before the selected first round", () => {
  const participants = [participant(1, "Ana"), participant(2, "Bruno", 103)];
  const results: CupScoringResult[] = [
    { roundId: 101, entryId: 1, points: 18, position: 1, status: "COMPLETED" },
    { roundId: 101, entryId: 2, points: 15, position: 2, status: "COMPLETED" },
    { roundId: 103, entryId: 2, points: 18, position: 1, status: "COMPLETED" },
  ];

  const calculation = calculateCupStandings(rounds, participants, results);
  const ana = calculation.standings.find((entry) => entry.entryId === 1)!;
  const bruno = calculation.standings.find((entry) => entry.entryId === 2)!;

  assert.equal(ana.totalPoints, 18);
  assert.equal(bruno.totalPoints, 18);
  assert.equal(bruno.resultsCounted, 1);
  assert.equal(ana.position, 1);
  assert.equal(bruno.position, 1);
  assert.equal(ana.tieIsProvisional, true);
  assert.equal(bruno.tieIsProvisional, true);
});

test("DNF and DNS never add wins or podiums even when their stored position is high", () => {
  const participants = [participant(1, "Ana"), participant(2, "Bruno")];
  const results: CupScoringResult[] = [
    { roundId: 101, entryId: 1, points: 0, position: 1, status: "DNF" },
    { roundId: 101, entryId: 2, points: 0, position: 2, status: "DNS" },
  ];

  const calculation = calculateCupStandings(rounds, participants, results);

  for (const entry of calculation.standings) {
    assert.equal(entry.totalPoints, 0);
    assert.equal(entry.wins, 0);
    assert.equal(entry.podiums, 0);
  }
});

test("sorts equal points by wins and then by podiums", () => {
  const participants = [
    participant(1, "Ana"),
    participant(2, "Bruno"),
    participant(3, "Caio"),
  ];
  const results: CupScoringResult[] = [
    { roundId: 101, entryId: 1, points: 10, position: 1, status: "COMPLETED" },
    { roundId: 102, entryId: 1, points: 10, position: 2, status: "COMPLETED" },
    { roundId: 101, entryId: 2, points: 20, position: 1, status: "COMPLETED" },
    { roundId: 101, entryId: 3, points: 10, position: 2, status: "COMPLETED" },
    { roundId: 102, entryId: 3, points: 10, position: 3, status: "COMPLETED" },
  ];

  const calculation = calculateCupStandings(rounds, participants, results);

  assert.deepEqual(
    calculation.standings.map(({ entryId, totalPoints, wins, podiums }) => ({
      entryId,
      totalPoints,
      wins,
      podiums,
    })),
    [
      { entryId: 1, totalPoints: 20, wins: 1, podiums: 2 },
      { entryId: 2, totalPoints: 20, wins: 1, podiums: 1 },
      { entryId: 3, totalPoints: 20, wins: 0, podiums: 2 },
    ]
  );
});

test("final round real position breaks a tie only after the final result exists", () => {
  const participants = [participant(1, "Ana"), participant(2, "Bruno")];
  const beforeFinal: CupScoringResult[] = [
    { roundId: 101, entryId: 1, points: 10, position: 4, status: "COMPLETED" },
    { roundId: 101, entryId: 2, points: 10, position: 5, status: "COMPLETED" },
  ];

  const provisional = calculateCupStandings(rounds, participants, beforeFinal);
  assert.equal(provisional.finalRoundPublished, false);
  assert.deepEqual(provisional.standings.map((entry) => entry.position), [1, 1]);
  assert.ok(provisional.standings.every((entry) => entry.tieIsProvisional));

  const final = calculateCupStandings(rounds, participants, [
    ...beforeFinal,
    { roundId: 104, entryId: 1, points: 0, position: 5, status: "COMPLETED" },
    { roundId: 104, entryId: 2, points: 0, position: 7, status: "COMPLETED" },
  ]);

  assert.equal(final.finalRoundPublished, true);
  assert.deepEqual(
    final.standings.map(({ entryId, position, isTied }) => ({ entryId, position, isTied })),
    [
      { entryId: 1, position: 1, isTied: false },
      { entryId: 2, position: 2, isTied: false },
    ]
  );
});

test("does not treat the latest available round as final before all four are linked", () => {
  const participants = [participant(1, "Ana"), participant(2, "Bruno")];
  const partialCalendar = rounds.slice(0, 2);
  const results: CupScoringResult[] = [
    { roundId: 102, entryId: 1, points: 10, position: 4, status: "COMPLETED" },
    { roundId: 102, entryId: 2, points: 10, position: 6, status: "COMPLETED" },
  ];

  const calculation = calculateCupStandings(
    partialCalendar,
    participants,
    results
  );

  assert.equal(calculation.finalRoundPublished, false);
  assert.deepEqual(calculation.standings.map((entry) => entry.position), [1, 1]);
  assert.ok(calculation.standings.every((entry) => entry.tieIsProvisional));
});

test("completed final result beats DNF, DNS or absence", () => {
  const participants = [
    participant(1, "Ana"),
    participant(2, "Bruno"),
    participant(3, "Caio"),
  ];
  const results: CupScoringResult[] = [
    { roundId: 104, entryId: 1, points: 0, position: 10, status: "COMPLETED" },
    { roundId: 104, entryId: 2, points: 0, position: 1, status: "DNF" },
  ];

  const calculation = calculateCupStandings(rounds, participants, results);

  assert.deepEqual(
    calculation.standings.map(({ entryId, position, isTied }) => ({ entryId, position, isTied })),
    [
      { entryId: 1, position: 1, isTied: false },
      { entryId: 2, position: 2, isTied: true },
      { entryId: 3, position: 2, isTied: true },
    ]
  );
});

test("tie remains shared when no tied driver completes the final round", () => {
  const participants = [participant(1, "Ana"), participant(2, "Bruno")];
  const results: CupScoringResult[] = [
    { roundId: 104, entryId: 1, points: 0, position: 1, status: "DNF" },
    { roundId: 104, entryId: 2, points: 0, position: 2, status: "DNS" },
  ];

  const calculation = calculateCupStandings(rounds, participants, results);

  assert.deepEqual(calculation.standings.map((entry) => entry.position), [1, 1]);
  assert.ok(calculation.standings.every((entry) => entry.isTied));
  assert.ok(calculation.standings.every((entry) => !entry.tieIsProvisional));
});
